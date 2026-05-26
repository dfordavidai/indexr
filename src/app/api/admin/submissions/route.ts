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

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 40
  const status = searchParams.get('status')
  const method = searchParams.get('method')
  const userId = searchParams.get('userId')
  const search = searchParams.get('search') ?? ''

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (method) where.method = method
  if (userId) where.userId = userId
  if (search) where.url = { contains: search }

  const [total, submissions] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true } } },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      submissions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  })
}

const patchSchema = z.object({
  submissionId: z.string(),
  status: z.enum(['PENDING', 'QUEUED', 'SUBMITTED', 'CRAWLED', 'INDEXED', 'FAILED', 'SKIPPED']).optional(),
  errorMessage: z.string().optional().nullable(),
})

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })

  const { submissionId, status, errorMessage } = parsed.data
  const updates: Record<string, unknown> = {}
  if (status !== undefined) updates.status = status
  if (errorMessage !== undefined) updates.errorMessage = errorMessage
  if (status === 'INDEXED') updates.indexedAt = new Date()

  const submission = await prisma.submission.update({ where: { id: submissionId }, data: updates })
  return NextResponse.json({ success: true, data: submission })
}

const deleteSchema = z.object({
  submissionIds: z.array(z.string()).min(1),
})

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 })

  const { count } = await prisma.submission.deleteMany({
    where: { id: { in: parsed.data.submissionIds } },
  })

  return NextResponse.json({ success: true, data: { deleted: count } })
}
