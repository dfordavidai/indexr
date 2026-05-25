import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { createCheckoutSession, createPortalSession } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const checkoutSchema = z.object({
  planId: z.string(),
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'portal') {
    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ success: false, error: 'No billing account' }, { status: 400 })
    }
    const url = await createPortalSession(user.stripeCustomerId)
    return NextResponse.json({ success: true, data: { url } })
  }

  // Default: create checkout
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'planId required' }, { status: 400 })
  }

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } })
  if (!plan?.stripePriceId) {
    return NextResponse.json({ success: false, error: 'Plan not found or not billable' }, { status: 404 })
  }

  const url = await createCheckoutSession(
    session.userId,
    session.email,
    plan.stripePriceId,
    plan.id
  )

  return NextResponse.json({ success: true, data: { url } })
}
