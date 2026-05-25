/**
 * Workers entry point — run separately from the Next.js server:
 *   npm run workers:start
 *
 * Imports queue.ts which registers Bull processors for:
 *  - indexingQueue  (5 concurrent workers)
 *  - statusCheckQueue (3 concurrent workers)
 *
 * Also optionally boots the Telegram bot if TELEGRAM_BOT_TOKEN is set.
 */

import '../src/lib/queue'   // registers indexingQueue & statusCheckQueue processors
import { getTelegramBot } from '../src/lib/telegram'

console.log('🚀 Indexr workers starting...')

// Boot Telegram bot if configured
const bot = getTelegramBot()
if (bot) {
  console.log('✓ Telegram bot active')
} else {
  console.log('⚠ Telegram bot skipped (TELEGRAM_BOT_TOKEN not set)')
}

console.log('✓ Queue processors registered')
console.log('  › indexingQueue  — 5 concurrent workers')
console.log('  › statusCheckQueue — 3 concurrent workers')
console.log('')
console.log('Workers running. Press Ctrl+C to stop.')

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down workers...')
  process.exit(0)
})
