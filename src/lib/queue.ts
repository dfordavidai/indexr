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

export interface IndexingJob {
  submissionId: string
  url: string
  userId: string
  method: string
}

// Process indexing jobs
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
        // Fallback to IndexNow
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
    // Notify via Telegram if user has it connected
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

    // Schedule status check in 24 hours
    await statusCheckQueue.add(
      { submissionId, url, userId },
      { delay: 24 * 60 * 60 * 1000 }
    )
  }

  return { success, submissionId, url }
})

// Process status check jobs — confirm if actually indexed
statusCheckQueue.process(3, async job => {
  const { submissionId, url, userId } = job.data

  try {
    // Check via Google search for site: query
    const indexed = await checkIfIndexed(url)

    if (indexed) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: 'INDEXED',
          indexedAt: new Date(),
          lastCheckedAt: new Date(),
        },
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

async function checkIfIndexed(url: string): Promise<boolean> {
  // Use a headless request to check site: operator result
  // In production, integrate with GSC API or use a SERP API
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
