import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkAccountHealth, getNextQuotaReset } from '@/lib/google-indexing'
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

  const accounts = await prisma.googleServiceAccount.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true, label: true, clientEmail: true, isActive: true, isHealthy: true,
      dailyQuota: true, quotaUsed: true, quotaResetAt: true,
      lastHealthCheck: true, lastUsedAt: true, priority: true, createdAt: true,
    },
  })

  const nextReset = getNextQuotaReset()

  return NextResponse.json({
    success: true,
    data: { accounts, nextQuotaReset: nextReset },
  })
}

const createSchema = z.object({
  label: z.string().min(1).max(100),
  credentialsJson: z.string().min(10), // raw JSON string of service account key
  dailyQuota: z.number().int().min(1).max(10000).default(200),
  priority: z.number().int().min(0).max(100).default(0),
})

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  // Validate the JSON is a real service account
  let credentials: { client_email?: string; private_key?: string; type?: string }
  try {
    credentials = JSON.parse(parsed.data.credentialsJson)
    if (!credentials.client_email || !credentials.private_key) {
      return NextResponse.json({ success: false, error: 'Invalid service account JSON: missing client_email or private_key' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON credentials' }, { status: 400 })
  }

  // Health check before saving
  const healthy = await checkAccountHealth(parsed.data.credentialsJson)

  const account = await prisma.googleServiceAccount.create({
    data: {
      label: parsed.data.label,
      credentialsJson: parsed.data.credentialsJson,
      clientEmail: credentials.client_email!,
      dailyQuota: parsed.data.dailyQuota,
      priority: parsed.data.priority,
      isHealthy: healthy,
      lastHealthCheck: new Date(),
      quotaResetAt: getNextQuotaReset(),
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      id: account.id,
      label: account.label,
      clientEmail: account.clientEmail,
      isHealthy: account.isHealthy,
      dailyQuota: account.dailyQuota,
      priority: account.priority,
    },
  })
}

const patchSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  dailyQuota: z.number().int().min(1).max(10000).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  forceActive: z.boolean().optional(), // force this account to be the top-priority active one
  resetQuota: z.boolean().optional(), // manually reset quota counter
  runHealthCheck: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  const { id, forceActive, resetQuota, runHealthCheck, ...updates } = parsed.data

  const account = await prisma.googleServiceAccount.findUnique({ where: { id } })
  if (!account) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 })

  const data: Record<string, unknown> = { ...updates }

  if (forceActive) {
    // Lower priority of all others, set this one highest
    await prisma.googleServiceAccount.updateMany({
      where: { id: { not: id } },
      data: { priority: 0 },
    })
    data.priority = 100
    data.isActive = true
  }

  if (resetQuota) {
    data.quotaUsed = 0
    data.quotaResetAt = getNextQuotaReset()
  }

  if (runHealthCheck) {
    const healthy = await checkAccountHealth(account.credentialsJson)
    data.isHealthy = healthy
    data.lastHealthCheck = new Date()
  }

  const updated = await prisma.googleServiceAccount.update({
    where: { id },
    data,
    select: {
      id: true, label: true, clientEmail: true, isActive: true, isHealthy: true,
      dailyQuota: true, quotaUsed: true, quotaResetAt: true,
      lastHealthCheck: true, lastUsedAt: true, priority: true,
    },
  })

  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })

  await prisma.googleServiceAccount.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
