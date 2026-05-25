import TelegramBot from 'node-telegram-bot-api'
import { prisma } from './prisma'
import { enqueueUrl } from './queue'

let bot: TelegramBot | null = null

export function getTelegramBot(): TelegramBot | null {
  if (!process.env.TELEGRAM_BOT_TOKEN) return null

  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })
    setupBotHandlers(bot)
  }

  return bot
}

function setupBotHandlers(bot: TelegramBot) {
  // /start command
  bot.onText(/\/start/, async msg => {
    const chatId = msg.chat.id
    await bot.sendMessage(
      chatId,
      `👋 Welcome to *Indexr Bot*!\n\n` +
      `To link your account, go to your dashboard Settings and enter your Telegram Chat ID:\n\n` +
      `Your Chat ID: \`${chatId}\`\n\n` +
      `Once linked, you can:\n` +
      `• Submit URLs for indexing\n` +
      `• Get notified when Googlebot visits your URLs\n` +
      `• Get notified when URLs are confirmed indexed\n\n` +
      `Use /help to see all commands.`,
      { parse_mode: 'Markdown' }
    )
  })

  // /help command
  bot.onText(/\/help/, async msg => {
    const chatId = msg.chat.id
    await bot.sendMessage(
      chatId,
      `*Indexr Bot Commands*\n\n` +
      `/submit <url> — Submit a URL for indexing\n` +
      `/status — Check your recent submissions\n` +
      `/credits — Check your credit balance\n` +
      `/chatid — Get your Telegram Chat ID\n`,
      { parse_mode: 'Markdown' }
    )
  })

  // /chatid command
  bot.onText(/\/chatid/, async msg => {
    await bot.sendMessage(msg.chat.id, `Your Chat ID: \`${msg.chat.id}\``, {
      parse_mode: 'Markdown',
    })
  })

  // /submit command
  bot.onText(/\/submit (.+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const url = match?.[1]?.trim()

    if (!url || !isValidUrl(url)) {
      await bot.sendMessage(chatId, '❌ Invalid URL. Please provide a valid URL starting with https://')
      return
    }

    const user = await prisma.user.findFirst({
      where: { telegramChatId: chatId.toString() },
      include: { plan: true },
    })

    if (!user) {
      await bot.sendMessage(
        chatId,
        '❌ Your Telegram account is not linked. Go to your dashboard → Settings to link it.'
      )
      return
    }

    if (user.credits < 1) {
      await bot.sendMessage(
        chatId,
        `❌ Insufficient credits. You have ${user.credits} credits remaining.\n\nUpgrade your plan at ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`
      )
      return
    }

    // Check for duplicate
    const existing = await prisma.submission.findFirst({
      where: {
        userId: user.id,
        url,
        status: { in: ['PENDING', 'QUEUED', 'SUBMITTED', 'CRAWLED', 'INDEXED'] },
      },
    })

    if (existing) {
      await bot.sendMessage(chatId, `⚠️ URL already submitted (${existing.status}):\n${url}`)
      return
    }

    // Create submission and deduct credit
    const [submission] = await prisma.$transaction([
      prisma.submission.create({
        data: { userId: user.id, url, source: 'telegram', status: 'PENDING' },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { credits: { decrement: 1 } },
      }),
      prisma.creditLog.create({
        data: {
          userId: user.id,
          delta: -1,
          reason: 'submission',
          balanceAfter: user.credits - 1,
        },
      }),
    ])

    await enqueueUrl(submission.id, url, user.id)

    await bot.sendMessage(
      chatId,
      `✅ URL queued for indexing!\n\n🔗 ${url}\n📊 Status: QUEUED\n💳 Credits remaining: ${user.credits - 1}`
    )
  })

  // /status command
  bot.onText(/\/status/, async msg => {
    const chatId = msg.chat.id

    const user = await prisma.user.findFirst({
      where: { telegramChatId: chatId.toString() },
    })

    if (!user) {
      await bot.sendMessage(chatId, '❌ Account not linked.')
      return
    }

    const recent = await prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    if (recent.length === 0) {
      await bot.sendMessage(chatId, 'No submissions yet.')
      return
    }

    const lines = recent.map(s => {
      const statusEmoji = {
        PENDING: '⏳', QUEUED: '🔄', SUBMITTED: '📤',
        CRAWLED: '🕷️', INDEXED: '✅', FAILED: '❌', SKIPPED: '⏭️',
      }[s.status] ?? '❓'
      return `${statusEmoji} ${s.status} — ${s.url.substring(0, 50)}...`
    })

    await bot.sendMessage(chatId, `*Recent Submissions*\n\n${lines.join('\n')}`, {
      parse_mode: 'Markdown',
    })
  })

  // /credits command
  bot.onText(/\/credits/, async msg => {
    const chatId = msg.chat.id

    const user = await prisma.user.findFirst({
      where: { telegramChatId: chatId.toString() },
      include: { plan: true },
    })

    if (!user) {
      await bot.sendMessage(chatId, '❌ Account not linked.')
      return
    }

    await bot.sendMessage(
      chatId,
      `💳 *Credits*\n\nBalance: *${user.credits}* credits\nPlan: *${user.plan?.name ?? 'Free'}*`,
      { parse_mode: 'Markdown' }
    )
  })
}

export async function sendTelegramNotification(chatId: string, message: string): Promise<void> {
  const b = getTelegramBot()
  if (!b) return
  try {
    await b.sendMessage(chatId, message)
  } catch (err) {
    console.error('Telegram notification error:', err)
  }
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}
