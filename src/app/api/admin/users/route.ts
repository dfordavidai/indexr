import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

async function requireAdmin(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'ADMIN') return null
  return session
}

// GET /api/admin/users
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 50
  const skip = (page - 1) * limit
  const search = searchParams.get('search') ?? ''

  const where = search
    ? { OR: [{ email: { contains: search } }, { name: { contains: search } }] }
    : {}

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
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        credits: u.credits,
        plan: u.plan?.name ?? 'Free',
        submissionsCount: u._count.submissions,
        createdAt: u.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  })
}

// PATCH /api/admin/users — adjust credits, change role
const patchSchema = z.object({
  userId: z.string(),
  credits: z.number().int().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 })
  }

  const { userId, credits, role } = parsed.data

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  const updates: { credits?: number; role?: 'USER' | 'ADMIN' } = {}
  if (credits !== undefined) updates.credits = credits
  if (role !== undefined) updates.role = role

  const updated = await prisma.user.update({ where: { id: userId }, data: updates })

  if (credits !== undefined) {
    await prisma.creditLog.create({
      data: {
        userId,
        delta: credits - user.credits,
        reason: 'manual_adjustment',
        referenceId: session.userId,
        balanceAfter: credits,
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: { id: updated.id, credits: updated.credits, role: updated.role },
  })
}
