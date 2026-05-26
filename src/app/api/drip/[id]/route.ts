import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { scheduleDripCampaign } from '@/lib/queue'
import { z } from 'zod'

async function getUser(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return null
  return prisma.user.findUnique({ where: { id: session.userId } })
}

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']).optional(),
  urlsPerDay: z.number().int().min(1).max(500).optional(),
  minDelayMin: z.number().int().min(1).max(1440).optional(),
  maxDelayMin: z.number().int().min(1).max(1440).optional(),
  smartDrip: z.boolean().optional(),
  windowStartHour: z.number().int().min(0).max(23).optional(),
  windowEndHour: z.number().int().min(1).max(24).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const campaign = await prisma.dripCampaign.findUnique({ where: { id: params.id } })
  if (!campaign) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  // Only owner or admin can modify
  if (campaign.userId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  const updates = parsed.data
  const wasActive = campaign.status === 'ACTIVE'
  const nowActive = updates.status === 'ACTIVE'

  // Refund reserved credits BEFORE the main update so the response reflects the correct state
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
        reason: 'drip_cancellation_refund',
        referenceId: params.id,
        balanceAfter: userAfter?.credits ?? 0,
      },
    })
  }

  // Build final update data; zero out creditsReserved on cancellation
  const updateData = {
    ...updates,
    ...(updates.status === 'CANCELLED' ? { creditsReserved: 0 } : {}),
  }

  const updated = await prisma.dripCampaign.update({
    where: { id: params.id },
    data: updateData,
  })

  // If resuming a paused campaign, re-enqueue the drip
  if (!wasActive && nowActive && updated.creditsReserved > 0) {
    await scheduleDripCampaign(params.id, 2000)
  }

  return NextResponse.json({ success: true, data: updated })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const campaign = await prisma.dripCampaign.findUnique({
    where: { id: params.id },
    include: {
      submissions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, url: true, status: true, createdAt: true },
      },
    },
  })

  if (!campaign) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  if (campaign.userId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ success: true, data: campaign })
}
