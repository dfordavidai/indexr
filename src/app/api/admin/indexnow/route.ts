import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

async function requireAdmin(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'ADMIN') return null
  return session
}

// ── GET — list all keys ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const keys = await prisma.indexNowKey.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, label: true, apiKey: true, host: true,
      keyLocation: true, isActive: true, usageCount: true,
      lastUsedAt: true, createdAt: true,
    },
  })

  return NextResponse.json({ success: true, data: { keys } })
}

// ── POST — add a key ──────────────────────────────────────────────────────────

const createSchema = z.object({
  label:       z.string().min(1).max(100),
  apiKey:      z.string().min(8).max(256),
  host:        z.string().min(3).max(253),   // just the hostname e.g. example.com
  keyLocation: z.string().url(),              // full URL e.g. https://example.com/abc.txt
})

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Quick reachability check on the key file
  let reachable = false
  try {
    const res = await fetch(parsed.data.keyLocation, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const text = await res.text()
      reachable = text.trim() === parsed.data.apiKey.trim()
    }
  } catch { /* non-fatal */ }

  const key = await prisma.indexNowKey.create({
    data: {
      label:       parsed.data.label,
      apiKey:      parsed.data.apiKey,
      host:        parsed.data.host.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      keyLocation: parsed.data.keyLocation,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      id:          key.id,
      label:       key.label,
      host:        key.host,
      reachable,   // tells the UI whether the key file was reachable
    },
  })
}

// ── PATCH — update a key ──────────────────────────────────────────────────────

const patchSchema = z.object({
  id:       z.string(),
  label:    z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { id, ...updates } = parsed.data
  const key = await prisma.indexNowKey.findUnique({ where: { id } })
  if (!key) return NextResponse.json({ success: false, error: 'Key not found' }, { status: 404 })

  const updated = await prisma.indexNowKey.update({
    where: { id },
    data: updates,
    select: { id: true, label: true, host: true, isActive: true, usageCount: true, lastUsedAt: true },
  })

  return NextResponse.json({ success: true, data: updated })
}

// ── DELETE — remove a key ─────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })

  await prisma.indexNowKey.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
