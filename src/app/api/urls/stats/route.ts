import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [user, statusCounts, monthlyUsage] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      include: { plan: true },
    }),
    prisma.submission.groupBy({
      by: ['status'],
      where: { userId: session.userId },
      _count: true,
    }),
    prisma.submission.count({
      where: {
        userId: session.userId,
        createdAt: { gte: startOfMonth },
      },
    }),
  ])

  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  const counts = Object.fromEntries(
    statusCounts.map((s: { status: string; _count: number }) => [s.status, s._count])
  ) as Record<string, number>

  return NextResponse.json({
    success: true,
    data: {
      totalSubmissions: Object.values(counts).reduce((a, b) => a + b, 0),
      indexedCount: counts.INDEXED ?? 0,
      pendingCount: (counts.PENDING ?? 0) + (counts.QUEUED ?? 0) + (counts.SUBMITTED ?? 0),
      crawledCount: counts.CRAWLED ?? 0,
      failedCount: counts.FAILED ?? 0,
      creditsRemaining: user.credits,
      creditsUsedThisMonth: monthlyUsage,
      planName: user.plan?.name ?? 'Free',
      planCreditsPerMonth: user.plan?.creditsPerMonth ?? 10,
    },
  })
}
