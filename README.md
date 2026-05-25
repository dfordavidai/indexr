# Indexr — Fast URL Indexing SaaS

A production-ready backlink and URL indexing SaaS built with Next.js 14, PostgreSQL, Redis, and Bull queues. Submit URLs to Google's crawl queue via the official Indexing API, track status in real-time, and manage everything from a sleek dark dashboard.

---

## Features

- **Google Indexing API** — official OAuth2 service account method (primary)
- **IndexNow fallback** — Bing/Yandex compatible open protocol
- **Sitemap ping fallback** — additional coverage
- **Bulk URL submission** — paste or CSV upload, up to 500 URLs/batch
- **Credit system** — 1 credit per URL, refills on subscription renewal
- **Real-time status tracking** — Pending → Queued → Submitted → Crawled → Indexed
- **REST API** — API key auth, full programmatic access
- **Telegram bot** — submit URLs and receive Googlebot visit notifications
- **Stripe billing** — subscriptions, checkout sessions, portal, webhook handling
- **Admin panel** — user management, credit adjustment, platform stats
- **Email notifications** — welcome email + weekly indexing reports (Resend or SMTP)
- **Rate limiting** — per-IP and per-API-key abuse protection
- **Docker Compose** — one-command deployment

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18 |
| Backend | Next.js API Routes |
| Database | PostgreSQL + Prisma ORM |
| Queue | Bull + Redis |
| Auth | JWT (jose) + bcryptjs |
| Payments | Stripe |
| Email | Resend / Nodemailer |
| Indexing | Google Indexing API (googleapis), IndexNow |
| Notifications | Telegram Bot API |
| Styling | CSS variables, JetBrains Mono, Syne |

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/yourorg/indexr.git
cd indexr
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in all required values. See the comments in `.env.example` for where to get each key.

**Required for core functionality:**
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string  
- `JWT_SECRET` — random secret for session tokens
- `GOOGLE_SERVICE_ACCOUNT_JSON` — Google service account JSON (for Indexing API)

**Required for payments:**
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY` — Stripe Price IDs for paid plans

**Optional but recommended:**
- `RESEND_API_KEY` or SMTP config — for email
- `TELEGRAM_BOT_TOKEN` — for Telegram bot

### 3. Set up the database

```bash
# Apply schema migrations
npx prisma migrate deploy

# Or push schema directly (dev only)
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed plans and admin user
npm run db:seed
```

### 4. Run the app

**Development (Next.js dev server):**
```bash
npm run dev
```

**Workers (in a separate terminal):**
```bash
npm run workers:start
```

App runs at `http://localhost:3000`.

---

## Docker Deployment

The easiest way to run everything in production:

```bash
# Copy and fill in environment variables
cp .env.example .env
nano .env

# Start all services (postgres, redis, app, workers)
docker compose up -d

# Run migrations and seed (first time only)
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed
```

Services:
- **app** → `http://localhost:3000`
- **postgres** → `localhost:5432`
- **redis** → `localhost:6379`
- **workers** → background process (no port)

---

## Project Structure

```
indexr/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page
│   │   ├── layout.tsx                  # Root layout + metadata
│   │   ├── globals.css                 # Global styles + CSS variables
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx              # Dashboard shell with sidebar
│   │   │   ├── page.tsx                # Overview / stats
│   │   │   ├── submit/page.tsx         # URL submission form
│   │   │   ├── submissions/page.tsx    # Submission history
│   │   │   ├── api-keys/page.tsx       # API key management
│   │   │   └── settings/page.tsx       # Profile, billing, Telegram
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx                # Admin panel
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/route.ts
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── me/route.ts
│   │       ├── urls/
│   │       │   ├── route.ts            # POST (submit), GET (list)
│   │       │   └── stats/route.ts      # GET dashboard stats
│   │       ├── api-keys/
│   │       │   ├── route.ts            # GET (list), POST (create)
│   │       │   └── [id]/route.ts       # DELETE (revoke)
│   │       ├── billing/
│   │       │   ├── route.ts            # POST (checkout / portal)
│   │       │   └── plans/route.ts      # GET available plans
│   │       ├── settings/route.ts       # PATCH profile/password/telegram
│   │       ├── admin/
│   │       │   ├── stats/route.ts
│   │       │   └── users/route.ts
│   │       └── webhooks/
│   │           └── stripe/route.ts
│   ├── lib/
│   │   ├── auth.ts                     # JWT, sessions, API key hashing
│   │   ├── prisma.ts                   # Prisma client singleton
│   │   ├── queue.ts                    # Bull queues + processors
│   │   ├── google-indexing.ts          # Google Indexing API + IndexNow
│   │   ├── stripe.ts                   # Stripe checkout + webhook handler
│   │   ├── email.ts                    # Resend / Nodemailer email sender
│   │   ├── telegram.ts                 # Telegram bot
│   │   └── rate-limit.ts               # In-memory rate limiter
│   └── types/
│       └── index.ts                    # Shared TypeScript types
├── prisma/
│   └── schema.prisma                   # Database schema
├── scripts/
│   ├── seed.ts                         # DB seed (plans + admin user)
│   └── workers.ts                      # Queue worker entry point
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── next.config.js
├── tsconfig.json
└── package.json
```

---

## API Reference

All endpoints require authentication via session cookie (dashboard) or API key header.

**API Key header:** `X-API-Key: ixr_<your-key>`

### Submit URLs
```
POST /api/urls
Content-Type: application/json

{
  "urls": ["https://example.com/page-1", "https://example.com/page-2"],
  "method": "GOOGLE_API"  // GOOGLE_API | INDEXNOW | SITEMAP_PING
}
```

### List submissions
```
GET /api/urls?page=1&limit=20&status=INDEXED
```

### Get stats
```
GET /api/urls/stats
```

**Indexing methods:** `GOOGLE_API` (default, fastest) · `INDEXNOW` · `SITEMAP_PING`

**Submission statuses:** `PENDING` → `QUEUED` → `SUBMITTED` → `CRAWLED` → `INDEXED` · `FAILED` · `SKIPPED`

---

## Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create two recurring products with monthly prices:
   - **Pro** — $29/month
   - **Agency** — $99/month
3. Copy the Price IDs into `.env` as `STRIPE_PRICE_PRO` and `STRIPE_PRICE_AGENCY`
4. Add a webhook endpoint in Stripe dashboard pointing to `https://yourdomain.com/api/webhooks/stripe`
5. Subscribe to events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`
6. Copy the webhook signing secret into `.env` as `STRIPE_WEBHOOK_SECRET`
7. Run `npm run db:seed` to create plan records in the database

---

## Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or use existing)
3. Enable the **Web Search Indexing API**
4. Go to IAM → Service Accounts → Create Service Account
5. Download the JSON key file
6. Go to [Google Search Console](https://search.google.com/search-console)
7. For each property you want to index, add the service account email as an **Owner**
8. Paste the entire JSON key (single-line) into `.env` as `GOOGLE_SERVICE_ACCOUNT_JSON`

---

## Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Run `/newbot` and follow prompts
3. Copy the bot token into `.env` as `TELEGRAM_BOT_TOKEN`
4. Users link their account via Dashboard → Settings → Telegram Chat ID
5. They get their Chat ID by messaging your bot and running `/chatid`

---

## License

MIT
