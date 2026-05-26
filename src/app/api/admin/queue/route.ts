import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  const status = searchParams.get('status') ?? 'all'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 30

  const where = status !== 'all'
    ? { status: status.toUpperCase() as 'PENDING' }
    : {}

  const [total, jobs, pending, queued, failed, processing] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    }),
    prisma.submission.count({ where: { status: 'PENDING' } }),
    prisma.submission.count({ where: { status: 'QUEUED' } }),
    prisma.submission.count({ where: { status: 'FAILED' } }),
    prisma.submission.count({ where: { status: 'SUBMITTED' } }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      counts: { pending, queued, failed, processing },
      jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  })
}
