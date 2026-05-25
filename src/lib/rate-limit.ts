import { NextRequest, NextResponse } from 'next/server'

interface RateLimitStore {
  count: number
  resetAt: number
}

// In-memory store — replace with Redis in production via ioredis
const store = new Map<string, RateLimitStore>()

interface RateLimitOptions {
  windowMs: number   // time window in ms
  max: number        // max requests per window
  keyFn?: (req: NextRequest) => string
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyFn } = options

  return function check(req: NextRequest): { success: boolean; remaining: number; resetAt: number } {
    const key = keyFn ? keyFn(req) : getIp(req)
    const now = Date.now()

    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      const newEntry: RateLimitStore = { count: 1, resetAt: now + windowMs }
      store.set(key, newEntry)
      return { success: true, remaining: max - 1, resetAt: newEntry.resetAt }
    }

    if (entry.count >= max) {
      return { success: false, remaining: 0, resetAt: entry.resetAt }
    }

    entry.count++
    return { success: true, remaining: max - entry.count, resetAt: entry.resetAt }
  }
}

export function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

export function rateLimitResponse(resetAt: number): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Rate limit exceeded' },
    {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
        'X-RateLimit-Reset': resetAt.toString(),
      },
    }
  )
}

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 10 * 60 * 1000)
