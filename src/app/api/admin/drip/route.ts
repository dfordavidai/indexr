import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scheduleDripCampaign } from '@/lib/queue'
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
  const status = searchParams.get('status') ?? 'all'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 25
  const skip = (page - 1) * limit

  const where = status !== 'all' ? { status: status as 'ACTIVE' } : {}

  const [total, campaigns] = await Promise.all([
    prisma.dripCampaign.count({ where }),
    prisma.dripCampaign.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, id: true } } },
    }),
  ])

  const counts = await Promise.all([
    prisma.dripCampaign.count({ where: { status: 'ACTIVE' } }),
    prisma.dripCampaign.count({ where: { status: 'PAUSED' } }),
    prisma.dripCampaign.count({ where: { status: 'COMPLETED' } }),
    prisma.dripCampaign.count({ where: { status: 'CANCELLED' } }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      campaigns,
      counts: { active: counts[0], paused: counts[1], completed: counts[2], cancelled: counts[3] },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  })
}

const patchSchema = z.object({
  campaignId: z.string(),
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']).optional(),
  urlsPerDay: z.number().int().min(1).max(500).optional(),
  minDelayMin: z.number().int().min(1).max(1440).optional(),
  maxDelayMin: z.number().int().min(1).max(1440).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  const { campaignId, ...updates } = parsed.data

  const campaign = await prisma.dripCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  const wasActive = campaign.status === 'ACTIVE'
  const nowActive = updates.status === 'ACTIVE'

  // Handle cancellation refund before main update so response is consistent
  if (updates.status === 'CANCELLED' && campaign.creditsReserved > 0) {
    await prisma.user.update({
      where: { id: campaign.userId },
      data: { credits: { increment: campaign.creditsReserved } },
    })
    const userAfter = await prisma.user.findUnique({ where: { id: campaign.userId }, select: { credits: true } })
    await prisma.creditLog.create({
      data: {
        userId: campaign.userId,
        delta: campaign.creditsReserved,
        reason: 'drip_admin_cancellation_refund',
        referenceId: campaignId,
        balanceAfter: userAfter?.credits ?? 0,
      },
    })
  }

  // Consolidate creditsReserved: 0 into the main update on cancellation
  const updateData = {
    ...updates,
    ...(updates.status === 'CANCELLED' ? { creditsReserved: 0 } : {}),
  }

  const updated = await prisma.dripCampaign.update({
    where: { id: campaignId },
    data: updateData,
    include: { user: { select: { email: true } } },
  })

  if (!wasActive && nowActive && updated.creditsReserved > 0) {
    await scheduleDripCampaign(campaignId, 2000)
  }

  return NextResponse.json({ success: true, data: updated })
}
