import { google } from 'googleapis'
import { prisma } from './prisma'

const SCOPES = ['https://www.googleapis.com/auth/indexing']

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAuth(credentialsJson: string) {
  const credentials = JSON.parse(credentialsJson)
  return new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    SCOPES
  )
}

// ── Quota helpers ─────────────────────────────────────────────────────────────

async function maybeResetQuotas() {
  const now = new Date()
  const needsReset = await prisma.googleServiceAccount.findMany({
    where: { quotaResetAt: { lt: now }, quotaUsed: { gt: 0 } },
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

// ── Single best account (legacy / rotation mode) ──────────────────────────────

export async function getActiveServiceAccount(): Promise<{
  accountId: string | null
  auth: InstanceType<typeof google.auth.JWT>
}> {
  await maybeResetQuotas()

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

// ── ALL active Google accounts (for simultaneous multi-account firing) ────────

export async function getAllActiveGoogleAccounts(): Promise<Array<{
  accountId: string | null
  auth: InstanceType<typeof google.auth.JWT>
  label: string
}>> {
  await maybeResetQuotas()

  const accounts = await prisma.googleServiceAccount.findMany({
    where: { isActive: true, isHealthy: true },
    orderBy: [{ priority: 'desc' }, { quotaUsed: 'asc' }],
  }).catch(() => [])

  const withQuota = accounts.filter(a => a.quotaUsed < a.dailyQuota)

  if (withQuota.length > 0) {
    return withQuota.map(a => ({
      accountId: a.id,
      auth: makeAuth(a.credentialsJson),
      label: a.label,
    }))
  }

  // Fallback: env var single account
  const envCreds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}'
  try {
    const credentials = JSON.parse(envCreds)
    if (credentials.client_email) {
      const auth = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        SCOPES
      )
      return [{ accountId: null, auth, label: 'env-fallback' }]
    }
  } catch { /* no env creds */ }

  return []
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
  accountLabel?: string
}

/** Submit to a single GSA (used internally). */
async function submitToOneGoogleAccount(
  url: string,
  accountId: string | null,
  auth: InstanceType<typeof google.auth.JWT>,
  label = ''
): Promise<IndexingResult> {
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
      accountLabel: label,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('invalid_grant') || message.includes('PERMISSION_DENIED')) {
      await markAccountUnhealthy(accountId)
    } else {
      await incrementAccountQuota(accountId)
    }
    return { url, type: 'URL_UPDATED', error: message, accountLabel: label }
  }
}

/**
 * Submit a URL to ALL active Google service accounts simultaneously.
 * Returns true if at least one account succeeded.
 */
export async function submitUrlToGoogleIndexingApi(url: string): Promise<IndexingResult> {
  const accounts = await getAllActiveGoogleAccounts()

  if (accounts.length === 0) {
    return { url, type: 'URL_UPDATED', error: 'No active Google service accounts' }
  }

  if (accounts.length === 1) {
    // Single account — original path
    return submitToOneGoogleAccount(url, accounts[0].accountId, accounts[0].auth, accounts[0].label)
  }

  // Multiple accounts — fire all simultaneously
  const results = await Promise.allSettled(
    accounts.map(a => submitToOneGoogleAccount(url, a.accountId, a.auth, a.label))
  )

  const settled = results.map(r => r.status === 'fulfilled' ? r.value : { url, type: 'URL_UPDATED' as const, error: 'Promise rejected' })
  const firstSuccess = settled.find(r => !r.error)

  // Return first success, or the last error if all failed
  return firstSuccess ?? settled[settled.length - 1]
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

// ── Sitemap ping ──────────────────────────────────────────────────────────────

export async function pingSitemapToGoogle(sitemapUrl: string): Promise<boolean> {
  try {
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
    const res = await fetch(pingUrl, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

// ── IndexNow — ALL keys simultaneously ───────────────────────────────────────
//
// Each IndexNow key is tied to a specific host domain where the key file lives.
// We fire every active key in parallel. Returns true if ANY key succeeded.

interface IndexNowKeyRecord {
  id: string
  label: string
  apiKey: string
  host: string
  keyLocation: string
}

async function submitViaOneIndexNowKey(url: string, key: IndexNowKeyRecord): Promise<boolean> {
  try {
    // host MUST match the domain of the URL being submitted — not the key's domain.
    // IndexNow silently rejects (or ignores) submissions where host ≠ url domain.
    const urlHost = new URL(url).hostname

    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host:        urlHost,
        key:         key.apiKey,
        keyLocation: key.keyLocation,
        urlList:     [url],
      }),
      signal: AbortSignal.timeout(10000),
    })
    const ok = res.status === 200 || res.status === 202
    if (!ok) console.error(`[IndexNow] Key "${key.label}" failed for ${url} — HTTP ${res.status}`)
    return ok
  } catch (err) {
    console.error(`[IndexNow] Key "${key.label}" error for ${url}:`, err)
    return false
  }
}

export async function submitViaIndexNow(url: string): Promise<boolean> {
  // 1. Try DB keys first — fire ALL active ones simultaneously
  const dbKeys = await prisma.indexNowKey.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  }).catch(() => [] as IndexNowKeyRecord[])

  if (dbKeys.length > 0) {
    const results = await Promise.allSettled(
      dbKeys.map(key => submitViaOneIndexNowKey(url, key))
    )

    // Bump usage counts for all keys (fire-and-forget)
    const now = new Date()
    Promise.all(
      dbKeys.map(key =>
        prisma.indexNowKey.update({
          where: { id: key.id },
          data: { usageCount: { increment: 1 }, lastUsedAt: now },
        }).catch(() => null)
      )
    )

    const anySuccess = results.some(r => r.status === 'fulfilled' && r.value === true)
    return anySuccess
  }

  // 2. Fallback to env var single key (legacy)
  const envKey = process.env.INDEXNOW_API_KEY
  if (!envKey) return false

  const shortDomain = process.env.SHORT_DOMAIN
  if (!shortDomain) {
    const urlHost   = new URL(url).hostname
    const urlOrigin = new URL(url).origin
    try {
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host:        urlHost,
          key:         envKey,
          keyLocation: `${urlOrigin}/${envKey}.txt`,
          urlList:     [url],
        }),
      })
      return res.status === 200 || res.status === 202
    } catch {
      return false
    }
  }

  const shortOrigin = shortDomain.replace(/\/$/, '')
  const shortHost   = new URL(shortOrigin).hostname

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host:        shortHost,
        key:         envKey,
        keyLocation: `${shortOrigin}/${envKey}.txt`,
        urlList:     [url],
      }),
    })
    return res.status === 200 || res.status === 202
  } catch {
    return false
  }
}

// ── submitShortlinkToSearchEngines (used by queue.ts) ─────────────────────────
// Re-exported here so queue.ts doesn't need to change its import.

export async function submitShortlinkToAllEngines(shortUrl: string): Promise<void> {
  const shortDomain = process.env.SHORT_DOMAIN
  if (!shortDomain) return

  await Promise.allSettled([
    submitUrlToGoogleIndexingApi(shortUrl).catch(() => null),
    submitViaIndexNow(shortUrl).catch(() => null),
    pingSitemapToGoogle(shortDomain.replace(/\/$/, '') + '/sitemap-links.xml').catch(() => null),
  ])
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
