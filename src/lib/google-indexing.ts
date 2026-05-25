import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/indexing']

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}')
  return new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    SCOPES
  )
}

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
  try {
    const auth = getAuth()
    const indexing = google.indexing({ version: 'v3', auth })

    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type: 'URL_UPDATED',
      },
    })

    return {
      url,
      type: 'URL_UPDATED',
      notifyTime: response.data.urlNotificationMetadata?.latestUpdate?.notifyTime ?? undefined,
      urlNotificationMetadata: response.data.urlNotificationMetadata as IndexingResult['urlNotificationMetadata'],
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { url, type: 'URL_UPDATED', error: message }
  }
}

export async function submitUrlsBatch(urls: string[]): Promise<IndexingResult[]> {
  // Google API supports up to 100 requests per batch, 200 per day
  const results: IndexingResult[] = []
  for (const url of urls) {
    const result = await submitUrlToGoogleIndexingApi(url)
    results.push(result)
    // Throttle to avoid rate limits
    await sleep(100)
  }
  return results
}

// Fallback: ping via sitemap submission to Google
export async function pingSitemapToGoogle(sitemapUrl: string): Promise<boolean> {
  try {
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
    const res = await fetch(pingUrl, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

// Fallback: IndexNow (Bing/Yandex compatible)
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
