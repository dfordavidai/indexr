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
}

export interface DripJob {
  campaignId: string
}

// ── Webhook: fires to your Namecheap link directory after each successful submission ──

async function notifyLinkPage(url: string): Promise<void> {
  const webhookUrl    = process.env.LINK_PAGE_WEBHOOK_URL    // https://yourdomain.com/receive-link.php
  const webhookSecret = process.env.LINK_PAGE_WEBHOOK_SECRET // must match WEBHOOK_SECRET in receive-link.php

  if (!webhookUrl || !webhookSecret) return

  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'X-Webhook-Secret':  webhookSecret,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // Non-fatal — don't block the indexing job if the link page is unreachable
  }
}

// ── Indexing processor ────────────────────────────────────────────────────────

indexingQueue.process(5, async job => {
  const { submissionId, url, userId, method } = job.data as IndexingJob

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'SUBMITTED' },
  })

  let success = false
  let errorMessage: string | undefined

  try {
    if (method === 'GOOGLE_API') {
      const result = await submitUrlToGoogleIndexingApi(url)
      if (result.error) {
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
      status: success ? 'CRAWLED' : 'FAILED',
      errorMessage: errorMessage ?? null,
      lastCheckedAt: new Date(),
    },
  })

  if (success) {
    // ── Fire webhook to Namecheap link directory ──
    await notifyLinkPage(url)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    })
    if (user?.telegramChatId) {
      await sendTelegramNotification(
        user.telegramChatId,
        `✅ Googlebot visit triggered for:\n${url}\n\nStatus: Crawl requested`
      )
    }

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
        data: { status: 'INDEXED', indexedAt: new Date(), lastCheckedAt: new Date() },
      })

      const user = await prisma.user.findUnique({
        where: { id: userId },
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
        data: { lastCheckedAt: new Date() },
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
      data: { status: 'CANCELLED' },
    })
    return { cancelled: true, reason: 'no_credits_reserved' }
  }

  const submitted = campaign.urlsSubmitted
  const remaining = campaign.urls.slice(submitted)

  if (remaining.length === 0) {
    await prisma.dripCampaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    return { completed: true }
  }

  const urlToSubmit = remaining[0]

  const submission = await prisma.submission.create({
    data: {
      userId: campaign.userId,
      url: urlToSubmit,
      status: 'PENDING',
      method: campaign.method,
      creditsCost: 1,
      source: 'drip',
      dripCampaignId: campaignId,
    },
  })

  await prisma.dripCampaign.update({
    where: { id: campaignId },
    data: {
      urlsSubmitted: { increment: 1 },
      creditsReserved: { decrement: 1 },
    },
  })

  await enqueueUrl(submission.id, urlToSubmit, campaign.userId, campaign.method)

  const newSubmitted = submitted + 1
  const totalUrls = campaign.urls.length
  const nextCampaignState = await prisma.dripCampaign.findUnique({ where: { id: campaignId } })

  if (newSubmitted < totalUrls && nextCampaignState?.status === 'ACTIVE') {
    const delayMs = computeDripDelay(campaign)
    const nextRunAt = new Date(Date.now() + delayMs)

    await prisma.dripCampaign.update({
      where: { id: campaignId },
      data: { nextRunAt },
    })

    await dripQueue.add({ campaignId }, { delay: delayMs })
  } else if (newSubmitted >= totalUrls) {
    await prisma.dripCampaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
  }

  return { submitted: urlToSubmit, submissionId: submission.id }
})

function computeDripDelay(campaign: {
  smartDrip: boolean
  minDelayMin: number
  maxDelayMin: number
  windowStartHour: number
  windowEndHour: number
  userTimezone: string
  urlsPerDay: number
}): number {
  const { minDelayMin, maxDelayMin, smartDrip, windowStartHour, windowEndHour, urlsPerDay } = campaign

  if (smartDrip) {
    const windowMinutes = (windowEndHour - windowStartHour) * 60
    const baseInterval = Math.max(minDelayMin, Math.floor(windowMinutes / urlsPerDay))
    const jitter = Math.floor(Math.random() * (maxDelayMin - minDelayMin + 1))
    const delayMin = Math.min(baseInterval + jitter, maxDelayMin)
    return delayMin * 60 * 1000
  }

  const delayMin = minDelayMin + Math.floor(Math.random() * (maxDelayMin - minDelayMin + 1))
  return delayMin * 60 * 1000
}

async function checkIfIndexed(url: string): Promise<boolean> {
  try {
    const query = `site:${url}`
    const res = await fetch(
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
  url: string,
  userId: string,
  method = 'GOOGLE_API'
) {
  await indexingQueue.add({ submissionId, url, userId, method })
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'QUEUED' },
  })
}

export async function scheduleDripCampaign(campaignId: string, initialDelayMs = 0) {
  await dripQueue.add({ campaignId }, { delay: initialDelayMs })
}
