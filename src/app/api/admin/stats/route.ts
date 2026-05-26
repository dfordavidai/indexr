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
  if (!session) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - 6)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalUsers,
    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,
    totalSubmissions,
    submissionsToday,
    submissionsThisWeek,
    submissionsThisMonth,
    statusBreakdown,
    methodBreakdown,
    recentSubmissions,
    recentUsers,
    dailySubmissions,
    totalCreditsConsumed,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.submission.count(),
    prisma.submission.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.submission.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.submission.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.submission.groupBy({ by: ['status'], _count: true }),
    prisma.submission.groupBy({ by: ['method'], _count: true }),
    prisma.submission.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, plan: { select: { name: true } }, createdAt: true },
    }),
    prisma.$queryRaw`
      SELECT DATE("createdAt") as day, COUNT(*) as count
      FROM "Submission"
      WHERE "createdAt" >= ${startOfWeek}
      GROUP BY DATE("createdAt")
      ORDER BY day ASC
    `,
    prisma.creditLog.aggregate({
      _sum: { delta: true },
      where: { delta: { lt: 0 }, createdAt: { gte: startOfMonth } },
    }),
  ])

  const indexedCount = statusBreakdown.find((s: { status: string }) => s.status === 'INDEXED')?._count ?? 0
  const failedCount = statusBreakdown.find((s: { status: string }) => s.status === 'FAILED')?._count ?? 0
  const processedCount = statusBreakdown
    .filter((s: { status: string }) => !['PENDING', 'QUEUED'].includes(s.status))
    .reduce((sum: number, s: { _count: number }) => sum + s._count, 0)
  const successRate = processedCount > 0 ? Math.round((indexedCount / processedCount) * 100) : 0

  return NextResponse.json({
    success: true,
    data: {
      users: { total: totalUsers, today: newUsersToday, thisWeek: newUsersThisWeek, thisMonth: newUsersThisMonth },
      submissions: { total: totalSubmissions, today: submissionsToday, thisWeek: submissionsThisWeek, thisMonth: submissionsThisMonth },
      indexing: {
        successRate, indexed: indexedCount, failed: failedCount,
        statusBreakdown: Object.fromEntries(statusBreakdown.map((s: { status: string; _count: number }) => [s.status, s._count])),
        methodBreakdown: Object.fromEntries(methodBreakdown.map((s: { method: string; _count: number }) => [s.method, s._count])),
      },
      credits: { consumedThisMonth: Math.abs(totalCreditsConsumed._sum.delta ?? 0) },
      recentSubmissions,
      recentUsers,
      dailySubmissions: (dailySubmissions as { day: string; count: bigint }[]).map(d => ({ day: String(d.day), count: Number(d.count) })),
    },
  })
}
