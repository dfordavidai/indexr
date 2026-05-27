/**
 * /api/urls/general
 *
 * General URL submission — no GSC ownership required.
 * Works for ANY URL (third-party backlinks, client sites, etc.)
 * Each URL gets shortlinked on your domain → submitted to Google via shortlink.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, hashApiKey } from '@/lib/auth'
import { enqueueUrl } from '@/lib/queue'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { z } from 'zod'
import type { SubmissionResult } from '@/types'

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyFn: req => {
    const apiKey = req.headers.get('x-api-key')
    return apiKey ?? req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  },
})

const schema = z.object({
  urls: z.array(z.string().url()).min(1).max(500),
})

async function getUserFromRequest(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (session) {
    return prisma.user.findUnique({ where: { id: session.userId } })
  }

  const apiKey = req.headers.get('x-api-key')
  if (apiKey) {
    const keyHash = await hashApiKey(apiKey)
    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    })
    if (key?.isActive) {
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
      })
      return key.user
    }
  }

  return null
}

export async function POST(req: NextRequest) {
  const limit = limiter(req)
  if (!limit.success) return rateLimitResponse(limit.resetAt)

  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  const { urls } = parsed.data

  // Accept both HTTP and HTTPS for general mode
  const validUrls = urls.filter(u => {
    try {
      const proto = new URL(u).protocol
      return proto === 'https:' || proto === 'http:'
    } catch {
      return false
    }
  })

  if (validUrls.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid URLs provided' },
      { status: 400 }
    )
  }

  if (user.credits < validUrls.length) {
    return NextResponse.json(
      {
        success: false,
        error: `Insufficient credits. Need ${validUrls.length}, have ${user.credits}.`,
      },
      { status: 402 }
    )
  }

  // Check for duplicates
  const existingUrls = await prisma.submission.findMany({
    where: {
      userId: user.id,
      url: { in: validUrls },
      status: { in: ['PENDING', 'QUEUED', 'SUBMITTED', 'CRAWLED', 'INDEXED'] },
    },
    select: { url: true },
  })
  const existingSet = new Set(existingUrls.map((s: { url: string }) => s.url))

  const newUrls   = validUrls.filter(u => !existingSet.has(u))
  const duplicates = validUrls.filter(u => existingSet.has(u))

  const results: SubmissionResult[] = []

  if (newUrls.length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data:  { credits: { decrement: newUrls.length } },
    })

    await prisma.creditLog.create({
      data: {
        userId:       user.id,
        delta:        -newUrls.length,
        reason:       'general_submission',
        balanceAfter: user.credits - newUrls.length,
      },
    })

    const submissions = await prisma.$transaction(
      newUrls.map(url =>
        prisma.submission.create({
          data: {
            userId:     user.id,
            url,
            status:     'PENDING',
            method:     'INDEXNOW',   // IndexNow as base method; shortlink does the heavy lifting
            creditsCost: 1,
            source:     req.headers.get('x-api-key') ? 'api' : 'dashboard',
          },
        })
      )
    )

    // Enqueue with generalMode = true (skips GSC ownership check)
    await Promise.all(
      submissions.map((s: { id: string; url: string }) =>
        enqueueUrl(s.id, s.url, user.id, 'INDEXNOW', true)
      )
    )

    for (const s of submissions as { url: string; id: string }[]) {
      results.push({ url: s.url, status: 'queued', submissionId: s.id })
    }
  }

  for (const url of duplicates) {
    results.push({ url, status: 'duplicate' })
  }

  return NextResponse.json({
    success: true,
    data: {
      submitted:        newUrls.length,
      duplicates:       duplicates.length,
      creditsUsed:      newUrls.length,
      creditsRemaining: user.credits - newUrls.length,
      results,
    },
  })
}
