import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken, setSessionCookie } from '@/lib/auth'
import { sendWelcomeEmail } from '@/lib/email'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { z } from 'zod'

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 })

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100).optional(),
})

export async function POST(req: NextRequest) {
  const limit = limiter(req)
  if (!limit.success) return rateLimitResponse(limit.resetAt)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  const { email, password, name } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'An account with this email already exists' },
      { status: 409 }
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Give free plan credits on signup
  const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } })
  const signupCredits = freePlan?.creditsPerMonth ?? 10

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name ?? null,
        planId: freePlan?.id ?? null,
        credits: signupCredits,
      },
    }),
  ])

  await prisma.creditLog.create({
    data: {
      userId:      user.id,
      delta:       signupCredits,
      reason:      'signup_bonus',
      balanceAfter: signupCredits,
    },
  })

  const token = await signToken({ userId: user.id, email: user.email, role: user.role })
  setSessionCookie(token)

  // Fire welcome email in background
  sendWelcomeEmail(user.email, user.name ?? '').catch(console.error)

  return NextResponse.json({
    success: true,
    data: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
}
