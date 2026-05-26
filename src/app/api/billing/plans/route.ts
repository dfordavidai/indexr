import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      creditsPerMonth: true,
      features: true,
      stripePriceId: true,
    },
  })

  return NextResponse.json({ success: true, data: plans })
}
