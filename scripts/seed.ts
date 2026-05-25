import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Plans
  const plans = [
    {
      name: 'Free',
      slug: 'free',
      price: 0,
      creditsPerMonth: 10,
      stripePriceId: null,
      features: [
        '10 URL submissions/month',
        'Google Indexing API',
        'Basic status tracking',
        'Dashboard access',
        'Community support',
      ],
    },
    {
      name: 'Pro',
      slug: 'pro',
      price: 2900, // cents
      creditsPerMonth: 500,
      stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
      features: [
        '500 URL submissions/month',
        'Google Indexing API',
        'IndexNow fallback',
        'Real-time status tracking',
        'API access',
        'Telegram bot notifications',
        'CSV bulk upload',
        'Email reports',
        'Priority support',
      ],
    },
    {
      name: 'Agency',
      slug: 'agency',
      price: 9900, // cents
      creditsPerMonth: 3000,
      stripePriceId: process.env.STRIPE_PRICE_AGENCY ?? null,
      features: [
        '3,000 URL submissions/month',
        'All Pro features',
        'Multi-method indexing',
        'Admin API access',
        'Webhook callbacks',
        'White-label reports',
        'Dedicated support',
        'SLA guarantee',
      ],
    },
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: { ...plan },
      create: { ...plan },
    })
    console.log(`  ✓ Plan: ${plan.name}`)
  }

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@indexr.io'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin-change-me-123'

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 12)
    const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } })
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Admin',
        role: 'ADMIN',
        planId: freePlan?.id ?? null,
        credits: 9999,
      },
    })
    console.log(`  ✓ Admin user: ${adminEmail}`)
  } else {
    // Ensure existing user is ADMIN
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } })
    console.log(`  ✓ Admin user already exists: ${adminEmail}`)
  }

  console.log('✅ Seed complete.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
