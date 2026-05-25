import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, generateApiKey, hashApiKey } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.userId, isActive: true },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      usageCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: keys })
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const count = await prisma.apiKey.count({
    where: { userId: session.userId, isActive: true },
  })

  if (count >= 10) {
    return NextResponse.json(
      { success: false, error: 'Maximum of 10 API keys allowed' },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
  }

  const { key, prefix } = generateApiKey()
  const keyHash = await hashApiKey(key)

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: session.userId,
      name: parsed.data.name,
      keyHash,
      keyPrefix: prefix,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      id: apiKey.id,
      name: apiKey.name,
      key, // Only returned once on creation
      keyPrefix: prefix,
      createdAt: apiKey.createdAt,
    },
  })
}
