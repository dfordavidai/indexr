import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { engineConfig } from '@/lib/engine-config'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

async function requireAdmin(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'ADMIN') return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ success: true, data: engineConfig })
}

const schema = z.object({
  indexingMode: z.enum(['instant', 'normal']).optional(),
  enabledMethods: z.object({
    GOOGLE_API: z.boolean().optional(),
    INDEXNOW: z.boolean().optional(),
    SITEMAP_PING: z.boolean().optional(),
    FETCH_AS_GOOGLE: z.boolean().optional(),
  }).optional(),
  rateLimits: z.object({
    GOOGLE_API: z.number().int().min(1).optional(),
    INDEXNOW: z.number().int().min(1).optional(),
    SITEMAP_PING: z.number().int().min(1).optional(),
  }).optional(),
  defaultMethodByPlan: z.object({
    free: z.string().optional(),
    pro: z.string().optional(),
    enterprise: z.string().optional(),
  }).optional(),
  retryAttempts: z.number().int().min(1).max(10).optional(),
  retryDelaySeconds: z.number().int().min(30).optional(),
  creditCostPerUrl: z.number().int().min(1).optional(),
  blacklistedDomains: z.array(z.string()).optional(),
  instantModeMaxUrls: z.number().int().min(1).max(500).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  const updates = parsed.data
  if (updates.indexingMode) engineConfig.indexingMode = updates.indexingMode
  if (updates.enabledMethods) Object.assign(engineConfig.enabledMethods, updates.enabledMethods)
  if (updates.rateLimits) Object.assign(engineConfig.rateLimits, updates.rateLimits)
  if (updates.defaultMethodByPlan) Object.assign(engineConfig.defaultMethodByPlan, updates.defaultMethodByPlan)
  if (updates.retryAttempts !== undefined) engineConfig.retryAttempts = updates.retryAttempts
  if (updates.retryDelaySeconds !== undefined) engineConfig.retryDelaySeconds = updates.retryDelaySeconds
  if (updates.creditCostPerUrl !== undefined) engineConfig.creditCostPerUrl = updates.creditCostPerUrl
  if (updates.blacklistedDomains !== undefined) engineConfig.blacklistedDomains = updates.blacklistedDomains
  if (updates.instantModeMaxUrls !== undefined) engineConfig.instantModeMaxUrls = updates.instantModeMaxUrls

  return NextResponse.json({ success: true, data: engineConfig })
}
