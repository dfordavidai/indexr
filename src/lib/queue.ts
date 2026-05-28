import Bull from 'bull'
import { prisma } from './prisma'
import {
  submitUrlToGoogleIndexingApi,
  submitViaIndexNow,
  pingSitemapToGoogle,
} from './google-indexing'
import { sendTelegramNotification } from './telegram'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

export const indexingQueue = new Bull('url-indexing', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

export const statusCheckQueue = new Bull('status-check', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
  },
})

export const dripQueue = new Bull('drip-scheduler', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
    removeOnFail: 20,
  },
})

export interface IndexingJob {
  submissionId: string
  url: string
  userId: string
  method: string
  /** If true, skip GSC ownership check — submit via shortlink on your domain instead */
  generalMode?: boolean
}

export interface DripJob {
  campaignId: string
}

// ── Random 5-letter pronounceable word title (CVCVC) ─────────────────────────

function generateWordTitle(): string {
  const consonants = 'bcdfghjklmnpqrstvwxyz'
  const vowels     = 'aeiou'
  const pattern    = ['c', 'v', 'c', 'v', 'c'] as const

  return pattern
    .map(type =>
      type === 'c'
        ? consonants[Math.floor(Math.random() * consonants.length)]
        : vowels[Math.floor(Math.random() * vowels.length)]
    )
    .join('')
}

// ── Random 5-char alphanumeric shortcode ──────────────────────────────────────

function generateShortcode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ── Submit the shortlink itself to Google Indexing API + IndexNow + sitemap ───
//
// SHORT_DOMAIN is your GSC-verified domain, so submitting shortlinks on it
// is a legitimate Indexing API call. Google crawls → follows 301 → indexes destination.

async function submitShortlinkToSearchEngines(shortUrl: string): Promise<void> {
  const shortDomain = process.env.SHORT_DOMAIN
  if (!shortDomain) return

  // 1. Google Indexing API
  try {
    await submitUrlToGoogleIndexingApi(shortUrl)
  } catch {
    // non-fatal
  }

  // 2. IndexNow — instant ping to Google, Bing, Yandex
  try {
    await submitViaIndexNow(shortUrl)
  } catch {
    // non-fatal
  }

  // 3. Sitemap ping — tells Google to re-crawl sitemap-links.xml
  try {
    await pingSitemapToGoogle(shortDomain.replace(/\/$/, '') + '/sitemap-links.xml')
  } catch {
    // non-fatal
  }
}

// ── Webhook: POST to receive-link.php, returns the shortlink URL ──────────────

async function notifyLinkPage(
  url: string,
  shortcode: string
): Promise<{ shortUrl: string | null }> {
  const webhookUrl    = process.env.LINK_PAGE_WEBHOOK_URL    // https://yourdomain.com/receive-link.php
  const webhookSecret = process.env.LINK_PAGE_WEBHOOK_SECRET // must match WEBHOOK_SECRET in receive-link.php
  const shortDomain   = process.env.SHORT_DOMAIN             // https://yourdomain.com

  if (!webhookUrl || !webhookSecret || !shortDomain) {
    return { shortUrl: null }
  }

  const title    = generateWordTitle()
  const shortUrl = shortDomain.replace(/\/$/, '') + '/link/' + shortcode + '/'

  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Webhook-Secret': webhookSecret,
      },
      body: JSON.stringify({ url, title, shortcode }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // non-fatal — don't block indexing if PHP server is unreachable
  }

  return { shortUrl }
}


// ── XenForo: create a new thread for every submitted URL ─────────────────────
//
// Env vars required:
//   XENFORO_BASE_URL    = https://latestupdates.infinityfreeapp.com
//   XENFORO_API_KEY     = your XenForo API key (Admin → API Keys)
//   XENFORO_NODE_ID     = forum node ID where threads will be posted (number)
//
// Optional:
//   XENFORO_STICKY      = "true" to pin every thread (shows in header area)

async function postToXenForo(
  url: string,
  title: string,
  shortUrl: string | null
): Promise<void> {
  const baseUrl = process.env.XENFORO_BASE_URL
  const apiKey  = process.env.XENFORO_API_KEY
  const nodeId  = process.env.XENFORO_NODE_ID
  if (!baseUrl || !apiKey || !nodeId) return

  const sticky    = process.env.XENFORO_STICKY === 'true' ? 1 : 0
  const shortLine = shortUrl ? `\n\n🔗 Short URL: ${shortUrl}` : ''
  const message   = `📌 New URL submitted for indexing:\n\n${url}${shortLine}\n\n[Submitted via Indexr]`

  try {
    await fetch(`${baseUrl.replace(/\/$/,'')}/api/threads`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'XF-Api-Key':    apiKey,
        'XF-Api-User':   '1',
      },
      body: JSON.stringify({
        node_id:   parseInt(nodeId, 10),
        title:     title || url,
        message,
        sticky,
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // non-fatal — XenForo posting should never block indexing
  }
}

// ── Indexing processor ────────────────────────────────────────────────────────

indexingQueue.process(5, async job => {
  const { submissionId, url, userId, method, generalMode = false } = job.data as IndexingJob

  await prisma.submission.update({
    where: { id: submissionId },
    data:  { status: 'SUBMITTED' },
  })

  let success      = false
  let errorMessage: string | undefined

  try {
    if (generalMode) {
      // General mode: destination URL is not in GSC.
      // We create a shortlink on OUR domain → submit the shortlink → Google follows 301.
      // Skip direct Google API / IndexNow submission of the raw URL — the shortlink does it.
      success = true
    } else if (method === 'GOOGLE_API') {
      const result = await submitUrlToGoogleIndexingApi(url)
      if (result.error) {
        // Fallback to IndexNow if Google API fails
        success = await submitViaIndexNow(url)
        if (!success) errorMessage = result.error
      } else {
        success = true
      }
    } else if (method === 'INDEXNOW') {
      success = await submitViaIndexNow(url)
      if (!success) errorMessage = 'IndexNow submission failed'
    } else if (method === 'SITEMAP_PING') {
      success = await pingSitemapToGoogle(url)
      if (!success) errorMessage = 'Sitemap ping failed'
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Processing error'
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status:        success ? 'CRAWLED' : 'FAILED',
      errorMessage:  errorMessage ?? null,
      lastCheckedAt: new Date(),
    },
  })

  if (success) {
    // ── Create shortlink + fire webhook → receive-link.php stores it ─────────
    const shortcode        = generateShortcode()
    const title            = generateWordTitle()
    const { shortUrl }     = await notifyLinkPage(url, shortcode)

    // ── Post to XenForo ───────────────────────────────────────────────────────
    await postToXenForo(url, title, shortUrl)

    // ── Submit shortlink to Google Indexing API + IndexNow + sitemap ping ────
    // This fires for ALL submissions (GSC mode AND general mode).
    // In GSC mode: both the original URL AND the shortlink get submitted.
    // In general mode: only the shortlink gets submitted (the 301 does the rest).
    if (shortUrl) {
      await submitShortlinkToSearchEngines(shortUrl)
    }

    // ── Telegram notification ─────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { telegramChatId: true },
    })
    if (user?.telegramChatId) {
      const shortInfo = shortUrl ? `\n🔗 Shortlink: ${shortUrl}` : ''
      await sendTelegramNotification(
        user.telegramChatId,
        `✅ Googlebot visit triggered for:\n${url}${shortInfo}\n\nStatus: Crawl requested`
      )
    }

    // ── Schedule index status check in 24h ───────────────────────────────────
    await statusCheckQueue.add(
      { submissionId, url, userId },
      { delay: 24 * 60 * 60 * 1000 }
    )
  }

  return { success, submissionId, url }
})

// ── Status check processor ────────────────────────────────────────────────────

statusCheckQueue.process(3, async job => {
  const { submissionId, url, userId } = job.data

  try {
    const indexed = await checkIfIndexed(url)

    if (indexed) {
      await prisma.submission.update({
        where: { id: submissionId },
        data:  { status: 'INDEXED', indexedAt: new Date(), lastCheckedAt: new Date() },
      })

      const user = await prisma.user.findUnique({
        where:  { id: userId },
        select: { telegramChatId: true },
      })
      if (user?.telegramChatId) {
        await sendTelegramNotification(
          user.telegramChatId,
          `🎉 URL confirmed indexed in Google:\n${url}`
        )
      }
    } else {
      await prisma.submission.update({
        where: { id: submissionId },
        data:  { lastCheckedAt: new Date() },
      })
    }
  } catch (err) {
    console.error('Status check error:', err)
  }
})

// ── Drip processor ────────────────────────────────────────────────────────────

dripQueue.process(2, async job => {
  const { campaignId } = job.data as DripJob

  const campaign = await prisma.dripCampaign.findUnique({
    where: { id: campaignId },
  })

  if (!campaign || campaign.status !== 'ACTIVE') return { skipped: true }

  if (campaign.creditsReserved <= 0) {
    await prisma.dripCampaign.update({
      where: { id: campaignId },
      data:  { status: 'CANCELLED' },
    })
    return { cancelled: true, reason: 'no_credits_reserved' }
  }

  const submitted = campaign.urlsSubmitted
  const remaining = campaign.urls.slice(submitted)

  if (remaining.length === 0) {
    await prisma.dripCampaign.update({
      where: { id: campaignId },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    })
    return { completed: true }
  }

  const urlToSubmit = remaining[0]

  const submission = await prisma.submission.create({
    data: {
      userId:         campaign.userId,
      url:            urlToSubmit,
      status:         'PENDING',
      method:         campaign.method,
      creditsCost:    1,
      source:         'drip',
      dripCampaignId: campaignId,
    },
  })

  await prisma.dripCampaign.update({
    where: { id: campaignId },
    data: {
      urlsSubmitted:   { increment: 1 },
      creditsReserved: { decrement: 1 },
    },
  })

  await enqueueUrl(submission.id, urlToSubmit, campaign.userId, campaign.method)

  const newSubmitted      = submitted + 1
  const totalUrls         = campaign.urls.length
  const nextCampaignState = await prisma.dripCampaign.findUnique({ where: { id: campaignId } })

  if (newSubmitted < totalUrls && nextCampaignState?.status === 'ACTIVE') {
    const delayMs   = computeDripDelay(campaign)
    const nextRunAt = new Date(Date.now() + delayMs)

    await prisma.dripCampaign.update({
      where: { id: campaignId },
      data:  { nextRunAt },
    })

    await dripQueue.add({ campaignId }, { delay: delayMs })
  } else if (newSubmitted >= totalUrls) {
    await prisma.dripCampaign.update({
      where: { id: campaignId },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    })
  }

  return { submitted: urlToSubmit, submissionId: submission.id }
})

function computeDripDelay(campaign: {
  smartDrip:       boolean
  minDelayMin:     number
  maxDelayMin:     number
  windowStartHour: number
  windowEndHour:   number
  userTimezone:    string
  urlsPerDay:      number
}): number {
  const { minDelayMin, maxDelayMin, smartDrip, windowStartHour, windowEndHour, urlsPerDay } = campaign

  if (smartDrip) {
    const windowMinutes = (windowEndHour - windowStartHour) * 60
    const baseInterval  = Math.max(minDelayMin, Math.floor(windowMinutes / urlsPerDay))
    const jitter        = Math.floor(Math.random() * (maxDelayMin - minDelayMin + 1))
    const delayMin      = Math.min(baseInterval + jitter, maxDelayMin)
    return delayMin * 60 * 1000
  }

  const delayMin = minDelayMin + Math.floor(Math.random() * (maxDelayMin - minDelayMin + 1))
  return delayMin * 60 * 1000
}

async function checkIfIndexed(url: string): Promise<boolean> {
  try {
    const query = `site:${url}`
    const res   = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return false
    const data = await res.json()
    return (data.searchInformation?.totalResults ?? '0') !== '0'
  } catch {
    return false
  }
}

export async function enqueueUrl(
  submissionId: string,
  url:          string,
  userId:       string,
  method      = 'GOOGLE_API',
  generalMode = false
) {
  await indexingQueue.add({ submissionId, url, userId, method, generalMode })
  await prisma.submission.update({
    where: { id: submissionId },
    data:  { status: 'QUEUED' },
  })
}

export async function scheduleDripCampaign(campaignId: string, initialDelayMs = 0) {
  await dripQueue.add({ campaignId }, { delay: initialDelayMs })
}
