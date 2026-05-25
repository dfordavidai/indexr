import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  telegramChatId: z.string().optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(100).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, telegramChatId, currentPassword, newPassword } = parsed.data

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  const updates: { name?: string; telegramChatId?: string | null; passwordHash?: string } = {}

  if (name !== undefined) updates.name = name
  if (telegramChatId !== undefined) updates.telegramChatId = telegramChatId

  if (newPassword && currentPassword) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 })
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 12)
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: updates,
  })

  return NextResponse.json({
    success: true,
    data: { name: updated.name, telegramChatId: updated.telegramChatId },
  })
}
