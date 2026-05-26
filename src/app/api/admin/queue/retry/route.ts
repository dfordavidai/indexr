import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enqueueUrl } from '@/lib/queue'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

async function requireAdmin(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'ADMIN') return null
  return session
}

const schema = z.object({
  submissionIds: z.array(z.string()).optional(), // empty = retry ALL failed
  retryAll: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 })

  const { submissionIds, retryAll } = parsed.data

  let submissions
  if (retryAll) {
    submissions = await prisma.submission.findMany({
      where: { status: 'FAILED' },
      take: 500,
    })
  } else if (submissionIds?.length) {
    submissions = await prisma.submission.findMany({
      where: { id: { in: submissionIds } },
    })
  } else {
    return NextResponse.json({ success: false, error: 'No submissions specified' }, { status: 400 })
  }

  // Reset to PENDING and re-enqueue
  await prisma.submission.updateMany({
    where: { id: { in: submissions.map((s: { id: string }) => s.id) } },
    data: { status: 'PENDING', errorMessage: null },
  })

  await Promise.all(
    submissions.map((s: { id: string; url: string; userId: string; method: string }) =>
      enqueueUrl(s.id, s.url, s.userId, s.method)
    )
  )

  return NextResponse.json({ success: true, data: { retried: submissions.length } })
}
