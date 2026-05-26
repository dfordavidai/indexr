import { google } from 'googleapis'
import { prisma } from './prisma'

const SCOPES = ['https://www.googleapis.com/auth/indexing']

// ── Multi-account pool ────────────────────────────────────────────────────────

function makeAuth(credentialsJson: string) {
  const credentials = JSON.parse(credentialsJson)
  return new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    SCOPES
  )
}

/**
 * Returns the best available service account: highest priority, not at quota, healthy.
 * Falls back to the single env-var account if no DB accounts exist.
 */
export async function getActiveServiceAccount(): Promise<{
  accountId: string | null
  auth: InstanceType<typeof google.auth.JWT>
}> {
  // Check for quota reset (midnight PST = UTC+8)
  await maybeResetQuotas()

  // Prisma doesn't support field-to-field comparison in where, so fetch all active+healthy
  // and filter in JS for quotaUsed < dailyQuota
  const poolAccounts = await prisma.googleServiceAccount.findMany({
    where: { isActive: true, isHealthy: true },
    orderBy: [{ priority: 'desc' }, { quotaUsed: 'asc' }],
  }).catch(() => [])

  const account = poolAccounts.find(a => a.quotaUsed < a.dailyQuota) ?? null

  if (account) {
    return { accountId: account.id, auth: makeAuth(account.credentialsJson) }
  }

  // Fallback to env var
  const envCreds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}'
  const credentials = JSON.parse(envCreds)
  const auth = new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    SCOPES
  )
  return { accountId: null, auth }
}

async function maybeResetQuotas() {
  const now = new Date()
  // PST is UTC-8, quota resets at midnight PST = 08:00 UTC
  const needsReset = await prisma.googleServiceAccount.findMany({
    where: {
      quotaResetAt: { lt: now },
      quotaUsed: { gt: 0 },
    },
  }).catch(() => [])

  if (needsReset.length > 0) {
    const nextReset = getNextQuotaReset()
    await prisma.googleServiceAccount.updateMany({
      where: { id: { in: needsReset.map(a => a.id) } },
      data: { quotaUsed: 0, quotaResetAt: nextReset },
    }).catch(() => null)
  }
}

export function getNextQuotaReset(): Date {
  // Midnight PST = 08:00 UTC next day if past, else today
  const now = new Date()
  const reset = new Date()
  reset.setUTCHours(8, 0, 0, 0)
  if (reset <= now) reset.setUTCDate(reset.getUTCDate() + 1)
  return reset
}

async function incrementAccountQuota(accountId: string | null) {
  if (!accountId) return
  await prisma.googleServiceAccount.update({
    where: { id: accountId },
    data: { quotaUsed: { increment: 1 }, lastUsedAt: new Date() },
  }).catch(() => null)
}

async function markAccountUnhealthy(accountId: string | null) {
  if (!accountId) return
  await prisma.googleServiceAccount.update({
    where: { id: accountId },
    data: { isHealthy: false },
  }).catch(() => null)
}

// ── Indexing API ──────────────────────────────────────────────────────────────

export interface IndexingResult {
  url: string
  type: 'URL_UPDATED' | 'URL_DELETED'
  notifyTime?: string
  urlNotificationMetadata?: {
    latestUpdate?: { url: string; type: string; notifyTime: string }
    latestRemove?: { url: string; type: string; notifyTime: string }
  }
  error?: string
}

export async function submitUrlToGoogleIndexingApi(url: string): Promise<IndexingResult> {
  const { accountId, auth } = await getActiveServiceAccount()

  try {
    const indexing = google.indexing({ version: 'v3', auth })

    const response = await indexing.urlNotifications.publish({
      requestBody: { url, type: 'URL_UPDATED' },
    })

    await incrementAccountQuota(accountId)

    return {
      url,
      type: 'URL_UPDATED',
      notifyTime: response.data.urlNotificationMetadata?.latestUpdate?.notifyTime ?? undefined,
      urlNotificationMetadata: response.data.urlNotificationMetadata as IndexingResult['urlNotificationMetadata'],
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    // Mark account unhealthy if it's an auth/credential error
    if (message.includes('invalid_grant') || message.includes('PERMISSION_DENIED')) {
      await markAccountUnhealthy(accountId)
    } else {
      // Quota exhausted — still increment so we rotate away
      await incrementAccountQuota(accountId)
    }

    return { url, type: 'URL_UPDATED', error: message }
  }
}

export async function submitUrlsBatch(urls: string[]): Promise<IndexingResult[]> {
  const results: IndexingResult[] = []
  for (const url of urls) {
    const result = await submitUrlToGoogleIndexingApi(url)
    results.push(result)
    await sleep(100)
  }
  return results
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkAccountHealth(credentialsJson: string): Promise<boolean> {
  try {
    const auth = makeAuth(credentialsJson)
    const token = await auth.getAccessToken()
    return !!token.token
  } catch {
    return false
  }
}

// ── Fallback methods ──────────────────────────────────────────────────────────

export async function pingSitemapToGoogle(sitemapUrl: string): Promise<boolean> {
  try {
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
    const res = await fetch(pingUrl, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

export async function submitViaIndexNow(url: string): Promise<boolean> {
  const key = process.env.INDEXNOW_API_KEY
  if (!key) return false

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: new URL(url).hostname,
        key,
        keyLocation: `${new URL(url).origin}/${key}.txt`,
        urlList: [url],
      }),
    })
    return res.status === 200 || res.status === 202
  } catch {
    return false
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
