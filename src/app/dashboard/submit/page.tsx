/**
 * /api/urls/link-submit
 *
 * Link Submit — sends URLs to InstantIndexer.org for indexing.
 * Supports Normal (1 credit/URL) and Instant (10 credits/URL) modes.
 * Checks user credits before submitting; deducts accordingly.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, hashApiKey } from '@/lib/auth'
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
  urls:    z.array(z.string().url()).min(1).max(500),
  instant: z.boolean().optional().default(false),
  project: z.string().optional().default('Link Submit'),
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

  const { urls, instant, project } = parsed.data

  // Accept both HTTP and HTTPS
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

  // Credits: Normal = 1 per URL, Instant = 10 per URL
  const creditsPerUrl  = instant ? 10 : 1
  const creditsNeeded  = validUrls.length * creditsPerUrl

  if (user.credits < creditsNeeded) {
    return NextResponse.json(
      {
        success: false,
        error: `Insufficient credits. Need ${creditsNeeded} (${validUrls.length} URL${validUrls.length !== 1 ? 's' : ''} × ${creditsPerUrl}), have ${user.credits}.`,
      },
      { status: 402 }
    )
  }

  // Check for duplicates
  const existingUrls = await prisma.submission.findMany({
    where: {
      userId: user.id,
      url:    { in: validUrls },
      status: { in: ['PENDING', 'QUEUED', 'SUBMITTED', 'CRAWLED', 'INDEXED'] },
    },
    select: { url: true },
  })
  const existingSet  = new Set(existingUrls.map((s: { url: string }) => s.url))
  const newUrls      = validUrls.filter(u => !existingSet.has(u))
  const duplicates   = validUrls.filter(u =>  existingSet.has(u))

  const results: SubmissionResult[] = []

  if (newUrls.length > 0) {
    const totalCost = newUrls.length * creditsPerUrl

    // ── Call InstantIndexer API ──────────────────────────────────────────────
    const instantIndexerKey = process.env.INSTANT_INDEXER_API_KEY
    if (!instantIndexerKey) {
      return NextResponse.json(
        { success: false, error: 'InstantIndexer API key not configured. Contact admin.' },
        { status: 500 }
      )
    }

    let apiError: string | null = null
    try {
      const iiRes = await fetch('https://instantindexer.org/api/submit.php', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key':    instantIndexerKey,
        },
        body: JSON.stringify({
          project,
          urls:    newUrls,
          instant,
        }),
      })

      if (!iiRes.ok) {
        const errText = await iiRes.text().catch(() => iiRes.statusText)
        apiError = `InstantIndexer returned ${iiRes.status}: ${errText}`
      }
    } catch (err) {
      apiError = `Failed to reach InstantIndexer: ${err instanceof Error ? err.message : String(err)}`
    }

    if (apiError) {
      return NextResponse.json(
        { success: false, error: apiError },
        { status: 502 }
      )
    }

    // ── Deduct credits ───────────────────────────────────────────────────────
    await prisma.user.update({
      where: { id: user.id },
      data:  { credits: { decrement: totalCost } },
    })

    await prisma.creditLog.create({
      data: {
        userId:       user.id,
        delta:        -totalCost,
        reason:       instant ? 'link_submit_instant' : 'link_submit_normal',
        balanceAfter: user.credits - totalCost,
      },
    })

    // ── Record submissions in DB ─────────────────────────────────────────────
    const source = req.headers.get('x-api-key') ? 'api' : 'dashboard'

    const submissions = await prisma.$transaction(
      newUrls.map(url =>
        prisma.submission.create({
          data: {
            userId:      user.id,
            url,
            status:      'QUEUED',
            method:      'INDEXNOW', // closest existing enum; IndexNow is what II uses under the hood
            creditsCost: creditsPerUrl,
            source,
          },
        })
      )
    )

    for (const s of submissions as { url: string; id: string }[]) {
      results.push({ url: s.url, status: 'queued', submissionId: s.id })
    }
  }

  for (const url of duplicates) {
    results.push({ url, status: 'duplicate' })
  }

  const creditsPerUrlUsed = instant ? 10 : 1

  return NextResponse.json({
    success: true,
    data: {
      submitted:        newUrls.length,
      duplicates:       duplicates.length,
      creditsUsed:      newUrls.length * creditsPerUrlUsed,
      creditsRemaining: user.credits - newUrls.length * creditsPerUrlUsed,
      indexingMode:     instant ? 'instant' : 'normal',
      results,
    },
  })
}
