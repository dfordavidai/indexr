import Stripe from 'stripe'
import { prisma } from './prisma'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2023-10-16',
})

export async function createCheckoutSession(
  userId: string,
  email: string,
  priceId: string,
  planId: string
): Promise<string> {
  let customerId: string

  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (user?.stripeCustomerId) {
    customerId = user.stripeCustomerId
  } else {
    const customer = await stripe.customers.create({ email, metadata: { userId } })
    customerId = customer.id
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    })
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?upgrade=cancelled`,
    metadata: { userId, planId },
    subscription_data: {
      metadata: { userId, planId },
    },
  })

  return session.url!
}

export async function createPortalSession(stripeCustomerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
  })
  return session.url
}

export async function handleWebhook(
  body: string,
  signature: string
): Promise<void> {
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err}`)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      const userId = session.metadata?.userId
      const planId = session.metadata?.planId
      if (!userId || !planId) break

      const plan = await prisma.plan.findUnique({ where: { id: planId } })
      if (!plan) break

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            planId,
            stripeSubscriptionId: session.subscription as string,
            credits: { increment: plan.creditsPerMonth },
          },
        }),
        prisma.creditLog.create({
          data: {
            userId,
            delta: plan.creditsPerMonth,
            reason: 'subscription_renewal',
            referenceId: session.subscription as string,
            balanceAfter: 0, // will be recalculated
          },
        }),
      ])
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = invoice.subscription as string
      if (!subscriptionId) break

      const user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
        include: { plan: true },
      })
      if (!user?.plan) break

      // Monthly renewal — top up credits
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { credits: { increment: user.plan.creditsPerMonth } },
        }),
        prisma.creditLog.create({
          data: {
            userId: user.id,
            delta: user.plan.creditsPerMonth,
            reason: 'subscription_renewal',
            referenceId: invoice.id,
            balanceAfter: user.credits + user.plan.creditsPerMonth,
          },
        }),
      ])
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      })
      if (!user) break

      await prisma.user.update({
        where: { id: user.id },
        data: { planId: null, stripeSubscriptionId: null },
      })
      break
    }
  }
}
