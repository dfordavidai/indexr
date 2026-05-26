import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [
    totalUsers,
    newUsersThisMonth,
    totalSubmissions,
    submissionsToday,
    statusBreakdown,
    recentSubmissions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.submission.count(),
    prisma.submission.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.submission.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.submission.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      totalUsers,
      newUsersThisMonth,
      totalSubmissions,
      submissionsToday,
      statusBreakdown: Object.fromEntries(
        statusBreakdown.map((s: { status: string; _count: number }) => [s.status, s._count])
      ),
      recentSubmissions,
    },
  })
}
