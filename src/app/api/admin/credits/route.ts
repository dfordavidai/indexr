import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

async function requireAdmin(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'ADMIN') return null
  return session
}

const schema = z.object({
  userId: z.string().optional(),         // specific user, or omit for all
  amount: z.number().int().min(1),
  reason: z.string().default('admin_grant'),
  grantAll: z.boolean().optional(),     // true = grant to ALL users
  planSlug: z.string().optional(),      // grant only to users on this plan
})

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  const { userId, amount, reason, grantAll, planSlug } = parsed.data

  let users: { id: string; credits: number }[] = []

  if (grantAll || planSlug) {
    const planFilter = planSlug
      ? { plan: { slug: planSlug } }
      : {}
    users = await prisma.user.findMany({
      where: planFilter,
      select: { id: true, credits: true },
    })
  } else if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, credits: true } })
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    users = [user]
  } else {
    return NextResponse.json({ success: false, error: 'Specify userId, grantAll, or planSlug' }, { status: 400 })
  }

  // Bulk update credits
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: users.map(u => u.id) } },
      data: { credits: { increment: amount } },
    }),
    ...users.map(u =>
      prisma.creditLog.create({
        data: {
          userId: u.id,
          delta: amount,
          reason,
          referenceId: session.userId,
          balanceAfter: u.credits + amount,
        },
      })
    ),
  ])

  return NextResponse.json({ success: true, data: { granted: users.length, amount, totalCredits: users.length * amount } })
}
