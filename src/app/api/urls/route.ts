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
  method: z.enum(['GOOGLE_API', 'SITEMAP_PING', 'FETCH_AS_GOOGLE', 'INDEXNOW']).optional(),
})

async function getUserFromRequest(req: NextRequest) {
  // Try session cookie first
  const session = await getSessionFromRequest(req)
  if (session) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    return user
  }

  // Try API key
  const apiKey = req.headers.get('x-api-key')
  if (apiKey) {
    const keyHash = await hashApiKey(apiKey)
    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    })
    if (key?.isActive) {
      // Update usage stats
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

  const { urls, method = 'GOOGLE_API' } = parsed.data

  // Filter only HTTPS URLs
  const validUrls = urls.filter(u => {
    try {
      return new URL(u).protocol === 'https:'
    } catch {
      return false
    }
  })

  if (validUrls.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid HTTPS URLs provided' },
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

  // Check for duplicates already submitted
  const existingUrls = await prisma.submission.findMany({
    where: {
      userId: user.id,
      url: { in: validUrls },
      status: { in: ['PENDING', 'QUEUED', 'SUBMITTED', 'CRAWLED', 'INDEXED'] },
    },
    select: { url: true },
  })
  const existingSet = new Set(existingUrls.map(s => s.url))

  const newUrls = validUrls.filter(u => !existingSet.has(u))
  const duplicates = validUrls.filter(u => existingSet.has(u))

  const results: SubmissionResult[] = []

  if (newUrls.length > 0) {
    // Deduct credits atomically
    await prisma.user.update({
      where: { id: user.id },
      data: { credits: { decrement: newUrls.length } },
    })

    await prisma.creditLog.create({
      data: {
        userId: user.id,
        delta: -newUrls.length,
        reason: 'submission',
        balanceAfter: user.credits - newUrls.length,
      },
    })

    // Create submissions
    const submissions = await prisma.$transaction(
      newUrls.map(url =>
        prisma.submission.create({
          data: {
            userId: user.id,
            url,
            status: 'PENDING',
            method: method as 'GOOGLE_API',
            creditsCost: 1,
            source: req.headers.get('x-api-key') ? 'api' : 'dashboard',
          },
        })
      )
    )

    // Enqueue all
    await Promise.all(
      submissions.map(s => enqueueUrl(s.id, s.url, user.id, method))
    )

    for (const s of submissions) {
      results.push({ url: s.url, status: 'queued', submissionId: s.id })
    }
  }

  for (const url of duplicates) {
    results.push({ url, status: 'duplicate' })
  }

  return NextResponse.json({
    success: true,
    data: {
      submitted: newUrls.length,
      duplicates: duplicates.length,
      creditsUsed: newUrls.length,
      creditsRemaining: user.credits - newUrls.length,
      results,
    },
  })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const status = searchParams.get('status')
  const skip = (page - 1) * limit

  const where = {
    userId: user.id,
    ...(status ? { status: status as 'PENDING' } : {}),
  }

  const [total, submissions] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        url: true,
        status: true,
        method: true,
        source: true,
        createdAt: true,
        updatedAt: true,
        indexedAt: true,
        lastCheckedAt: true,
        errorMessage: true,
        creditsCost: true,
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      submissions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  })
}
