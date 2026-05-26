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

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const plans = await prisma.plan.findMany({
    orderBy: { price: 'asc' },
    include: { _count: { select: { users: true } } },
  })

  return NextResponse.json({ success: true, data: plans })
}

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  price: z.number().int().min(0),
  creditsPerMonth: z.number().int().min(0),
  features: z.array(z.string()),
  stripePriceId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  const plan = await prisma.plan.create({ data: parsed.data })
  return NextResponse.json({ success: true, data: plan }, { status: 201 })
}

const patchSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  price: z.number().int().min(0).optional(),
  creditsPerMonth: z.number().int().min(0).optional(),
  features: z.array(z.string()).optional(),
  stripePriceId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  const { id, ...updates } = parsed.data
  const plan = await prisma.plan.update({ where: { id }, data: updates })
  return NextResponse.json({ success: true, data: plan })
}
