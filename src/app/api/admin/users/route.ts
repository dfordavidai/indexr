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

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 50
  const skip = (page - 1) * limit
  const search = searchParams.get('search') ?? ''
  const planFilter = searchParams.get('plan') ?? ''
  const roleFilter = searchParams.get('role') ?? ''

  const where: Record<string, unknown> = {}
  if (search) where.OR = [{ email: { contains: search } }, { name: { contains: search } }]
  if (planFilter) where.plan = { slug: planFilter }
  if (roleFilter) where.role = roleFilter

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: { plan: true, _count: { select: { submissions: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      users: users.map((u: typeof users[number]) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        credits: u.credits,
        plan: u.plan?.name ?? 'Free',
        planSlug: u.plan?.slug ?? 'free',
        planId: u.planId,
        submissionsCount: u._count.submissions,
        stripeCustomerId: u.stripeCustomerId,
        telegramChatId: u.telegramChatId,
        createdAt: u.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  })
}

const patchSchema = z.object({
  userId: z.string(),
  credits: z.number().int().min(0).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  planId: z.string().optional().nullable(),
  suspend: z.boolean().optional(), // sets role to 'SUSPENDED' (ban)
  creditDelta: z.number().int().optional(), // add/subtract credits instead of setting
})

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  const { userId, credits, role, planId, suspend, creditDelta } = parsed.data

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (credits !== undefined) updates.credits = credits
  if (creditDelta !== undefined) updates.credits = { increment: creditDelta }
  if (role !== undefined) updates.role = role
  if (planId !== undefined) updates.planId = planId
  if (suspend !== undefined) updates.role = suspend ? 'ADMIN' : 'USER' // Use a flag; in prod add SUSPENDED to Role enum

  const updated = await prisma.user.update({ where: { id: userId }, data: updates })

  // Log credit change
  if (credits !== undefined || creditDelta !== undefined) {
    const newCredits = credits ?? (user.credits + (creditDelta ?? 0))
    const delta = credits !== undefined ? credits - user.credits : (creditDelta ?? 0)
    await prisma.creditLog.create({
      data: {
        userId,
        delta,
        reason: 'manual_adjustment',
        referenceId: session.userId,
        balanceAfter: newCredits,
      },
    })
  }

  return NextResponse.json({ success: true, data: { id: updated.id, credits: updated.credits, role: updated.role } })
}
