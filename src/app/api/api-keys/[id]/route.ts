import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const key = await prisma.apiKey.findUnique({
    where: { id: params.id },
  })

  if (!key || key.userId !== session.userId) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  await prisma.apiKey.update({
    where: { id: params.id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
