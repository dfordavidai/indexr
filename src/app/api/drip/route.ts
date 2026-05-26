import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, hashApiKey } from '@/lib/auth'
import { scheduleDripCampaign } from '@/lib/queue'
import { z } from 'zod'

async function getUserFromRequest(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (session) {
    return prisma.user.findUnique({ where: { id: session.userId } })
  }
  const apiKey = req.headers.get('x-api-key')
  if (apiKey) {
    const keyHash = await hashApiKey(apiKey)
    const key = await prisma.apiKey.findUnique({ where: { keyHash }, include: { user: true } })
    if (key?.isActive) return key.user
  }
  return null
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  urls: z.array(z.string().url()).min(1).max(10000),
  method: z.enum(['GOOGLE_API', 'SITEMAP_PING', 'FETCH_AS_GOOGLE', 'INDEXNOW']).default('GOOGLE_API'),
  urlsPerDay: z.number().int().min(1).max(500).default(50),
  minDelayMin: z.number().int().min(1).max(1440).default(5),
  maxDelayMin: z.number().int().min(1).max(1440).default(60),
  smartDrip: z.boolean().default(true),
  windowStartHour: z.number().int().min(0).max(23).default(9),
  windowEndHour: z.number().int().min(1).max(24).default(17),
  userTimezone: z.string().default('UTC'),
  // Admin-only: create on behalf of user
  targetUserId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  const data = parsed.data

  // Resolve target user (admin can create on behalf of another user)
  let targetUserId = user.id
  if (data.targetUserId && user.role === 'ADMIN') {
    targetUserId = data.targetUserId
  }

  const targetUser = targetUserId !== user.id
    ? await prisma.user.findUnique({ where: { id: targetUserId } })
    : user

  if (!targetUser) return NextResponse.json({ success: false, error: 'Target user not found' }, { status: 404 })

  // Filter valid HTTPS URLs
  const validUrls = data.urls.filter(u => {
    try { return new URL(u).protocol === 'https:' } catch { return false }
  })

  if (validUrls.length === 0) return NextResponse.json({ success: false, error: 'No valid HTTPS URLs' }, { status: 400 })

  // Check credits and reserve upfront
  if (targetUser.credits < validUrls.length) {
    return NextResponse.json({
      success: false,
      error: `Insufficient credits. Need ${validUrls.length}, have ${targetUser.credits}.`,
    }, { status: 402 })
  }

  // Reserve credits upfront
  await prisma.user.update({
    where: { id: targetUserId },
    data: { credits: { decrement: validUrls.length } },
  })

  await prisma.creditLog.create({
    data: {
      userId: targetUserId,
      delta: -validUrls.length,
      reason: 'drip_reservation',
      balanceAfter: targetUser.credits - validUrls.length,
    },
  })

  const campaign = await prisma.dripCampaign.create({
    data: {
      userId: targetUserId,
      name: data.name,
      urls: validUrls,
      urlsTotal: validUrls.length,
      method: data.method,
      urlsPerDay: data.urlsPerDay,
      minDelayMin: data.minDelayMin,
      maxDelayMin: data.maxDelayMin,
      smartDrip: data.smartDrip,
      windowStartHour: data.windowStartHour,
      windowEndHour: data.windowEndHour,
      userTimezone: data.userTimezone,
      creditsReserved: validUrls.length,
      nextRunAt: new Date(),
    },
  })

  // Start drip immediately (first URL after a short ramp)
  await scheduleDripCampaign(campaign.id, 5000)

  return NextResponse.json({
    success: true,
    data: {
      campaignId: campaign.id,
      urlsTotal: validUrls.length,
      creditsReserved: validUrls.length,
      creditsRemaining: targetUser.credits - validUrls.length,
    },
  })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const campaigns = await prisma.dripCampaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, status: true, method: true,
      urlsTotal: true, urlsSubmitted: true, urlsPerDay: true,
      minDelayMin: true, maxDelayMin: true, smartDrip: true,
      windowStartHour: true, windowEndHour: true, userTimezone: true,
      creditsReserved: true, nextRunAt: true, completedAt: true, createdAt: true,
    },
  })

  return NextResponse.json({ success: true, data: campaigns })
}
