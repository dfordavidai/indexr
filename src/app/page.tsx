'use client'

import { useState } from 'react'
import Link from 'next/link'

const PLANS = [
  {
    name: 'Starter',
    slug: 'starter',
    price: 0,
    credits: 10,
    features: [
      '10 backlink submissions/month',
      'Google Indexing API',
      'Real-time crawl tracking',
      'Dashboard access',
      'Community support',
    ],
    cta: 'Start Free — No Card Needed',
    highlight: false,
  },
  {
    name: 'Pro',
    slug: 'pro',
    price: 29,
    credits: 500,
    features: [
      '500 backlink submissions/month',
      'Google Indexing API (primary)',
      'IndexNow multi-engine fallback',
      'Real-time status tracking',
      'Bulk CSV upload (500 URLs)',
      'REST API + API key access',
      'Telegram bot notifications',
      'Email indexing reports',
      'Priority support',
    ],
    cta: 'Start Pro',
    highlight: true,
  },
  {
    name: 'Agency',
    slug: 'agency',
    price: 99,
    credits: 3000,
    features: [
      '3,000 backlink submissions/month',
      'All Pro features included',
      'Multi-method indexing engine',
      'Drip-feed scheduling',
      'Webhook callbacks',
      'White-label PDF reports',
      'Admin API access',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    cta: 'Start Agency',
    highlight: false,
  },
]

const FAQS = [
  {
    q: 'What is BestBacklinkIndexer and how does it work?',
    a: 'BestBacklinkIndexer is a professional backlink indexing service that uses the official Google Indexing API to notify Google about your backlinks directly. When you submit a URL, we send a crawl request to Googlebot via the same API channel Google uses for structured data updates. This is the fastest, most reliable method to get backlinks indexed — far better than manual Google Search Console submissions.',
  },
  {
    q: 'How fast does BestBacklinkIndexer get backlinks indexed?',
    a: 'Most backlinks submitted through BestBacklinkIndexer receive a Googlebot visit within 1–12 hours of submission. Actual appearance in Google search results typically follows within 24–72 hours. Pages on high-authority domains or those with strong internal linking may index within minutes. Our 98.2% crawl success rate is the best in the industry.',
  },
  {
    q: 'Can I index backlinks from third-party sites I don\'t own?',
    a: 'Yes — this is one of the biggest advantages of BestBacklinkIndexer. Unlike Google Search Console (which only works for sites you own), our Google Indexing API integration can submit any publicly accessible HTTPS URL. Whether it\'s a guest post, forum link, Web 2.0 property, tier-2 link, or PBN page — we can request indexing for it.',
  },
  {
    q: 'What makes BestBacklinkIndexer better than other backlink indexers?',
    a: 'Most backlink indexers rely on mass-pinging and Web 2.0 tricks that Google largely ignores. BestBacklinkIndexer uses the official Google Indexing API as the primary method — the same direct channel used by Google\'s own structured data tools. We also fall back to IndexNow (Bing/Yandex protocol) and sitemap pinging for maximum coverage. Plus, we give you real-time crawl status tracking so you know exactly what\'s been visited.',
  },
  {
    q: 'What happens if a backlink fails to get indexed?',
    a: 'BestBacklinkIndexer automatically retries failed submissions with fallback methods (IndexNow, sitemap ping, crawl triggers). If a URL still fails after all methods, we show you the exact failure reason in your dashboard and refund the credit. You can also manually resubmit any URL at no additional cost.',
  },
  {
    q: 'Is there a bulk backlink indexer / CSV upload feature?',
    a: 'Yes. Pro and Agency users can upload a CSV file with up to 500 URLs at once, or paste them directly into the bulk submission field. BestBacklinkIndexer automatically detects and skips duplicate URLs, so you only spend credits on fresh submissions.',
  },
  {
    q: 'Do you support IndexNow for backlink indexing?',
    a: 'Yes. IndexNow is our secondary indexing method. When the Google Indexing API has already processed a URL or hits quota limits, we automatically fall back to IndexNow, which simultaneously notifies Bing, Yandex, and other IndexNow-compatible search engines. This maximizes your backlink\'s visibility across all major search engines.',
  },
  {
    q: 'Is there a REST API for automated backlink indexing?',
    a: 'Yes. Generate an API key in your dashboard and POST URLs to our /api/urls endpoint. You can integrate BestBacklinkIndexer directly into your link building workflow, CMS, GSA Search Engine Ranker, RankerX, or any automation stack. Full API documentation is available after login. Authentication via Bearer token or X-API-Key header.',
  },
  {
    q: 'Can I use the Telegram bot to submit backlinks?',
    a: 'Yes. Link your Telegram account in your BestBacklinkIndexer settings, then use our Telegram bot to submit URLs on the go and receive instant notifications when Googlebot visits your backlinks or when a link is confirmed indexed.',
  },
  {
    q: 'Do unused backlink indexing credits roll over?',
    a: 'Credits reset monthly and do not roll over. Agency plan users can contact support for custom credit arrangements. We recommend using all credits before your billing date for maximum value.',
  },
]

const FEATURES = [
  {
    icon: '⚡',
    title: 'Google Indexing API — Official Method',
    desc: 'We use Google\'s official OAuth2 Indexing API as our primary engine. This directly signals Googlebot to crawl your backlinks — no tricks, no pinging spam. Just the fastest, most authoritative indexing method available.',
    keyword: 'google indexing api backlinks',
  },
  {
    icon: '🔄',
    title: 'Multi-Method Indexing Fallback',
    desc: 'If the primary Google API hits quota, we automatically cascade to IndexNow (notifies Bing, Yandex simultaneously), sitemap pinging, and crawl trigger techniques. Your backlinks always have maximum indexing coverage.',
    keyword: 'indexnow backlink indexer',
  },
  {
    icon: '📊',
    title: 'Real-Time Backlink Crawl Tracking',
    desc: 'Watch your backlinks move through every stage: PENDING → QUEUED → SUBMITTED → CRAWLED → INDEXED. Background verification jobs confirm actual Google indexation — not just crawl confirmation.',
    keyword: 'track backlink indexing status',
  },
  {
    icon: '📦',
    title: 'Bulk Backlink Indexer (CSV Upload)',
    desc: 'Submit 500 backlinks at once via CSV upload or bulk paste. Perfect for mass tier-2 link indexing, PBN submissions, or post-outreach campaign indexing. Duplicate detection included — pay only for new submissions.',
    keyword: 'bulk backlink indexer csv',
  },
  {
    icon: '⏱️',
    title: 'Drip-Feed Backlink Scheduling',
    desc: 'Avoid suspicious indexing spikes. Schedule backlink submissions to drip-feed over days or weeks, mimicking natural link discovery patterns. Essential for PBN operators and tiered link campaigns.',
    keyword: 'drip feed backlink indexer',
  },
  {
    icon: '🤖',
    title: 'Telegram Bot Backlink Notifications',
    desc: 'Submit backlinks via @BestBacklinkIndexerBot and get instant Telegram alerts when Googlebot visits your URLs and when links are confirmed indexed. Manage your entire indexing workflow from your phone.',
    keyword: 'telegram backlink indexer bot',
  },
  {
    icon: '🔑',
    title: 'REST API for Link Builders',
    desc: 'Full programmatic access via REST API. Integrate directly into GSA SER, RankerX, Money Robot, your CMS, or any custom automation. Submit URLs, check status, and pull reports — all via authenticated API calls.',
    keyword: 'backlink indexer api',
  },
  {
    icon: '📄',
    title: 'White-Label Indexing Reports',
    desc: 'Agency users get branded PDF reports showing indexing rates, crawl timelines, and success metrics per campaign. Send professional backlink indexing reports straight to clients without revealing your toolstack.',
    keyword: 'white label backlink indexer agency',
  },
]

const TESTIMONIALS = [
  {
    quote: 'Submitted 400 tier-2 links and had 91% of them crawled within 8 hours. BestBacklinkIndexer is the only backlink indexer that actually uses the Google API properly. Nothing else comes close.',
    name: 'Marcus T.',
    role: 'SEO Agency Owner, London',
    stars: 5,
  },
  {
    quote: 'I\'ve tried every backlink indexer out there — OneHourIndexing, Linklicious, all of them. BestBacklinkIndexer gets 3x the indexing rate because of the direct API method. Game changer for my PBN.',
    name: 'Derek R.',
    role: 'PBN Operator & Growth Engineer',
    stars: 5,
  },
  {
    quote: 'The Telegram bot is incredible for my agency workflow. I submit client backlinks from my phone, get pinged when Google crawls them, and the white-label reports make client updates effortless.',
    name: 'Priya K.',
    role: 'Freelance SEO Consultant',
    stars: 5,
  },
  {
    quote: 'We integrated the REST API into our RankerX campaigns. Every link we build now gets auto-submitted. 3,000 URLs a month indexed with zero manual effort. ROI is insane.',
    name: 'James W.',
    role: 'Link Building Agency Founder',
    stars: 5,
  },
  {
    quote: 'The drip-feed scheduling feature alone makes this worth the Agency plan. Our tiered link builds look completely natural — no sudden indexing spikes that trigger filters.',
    name: 'Sophia L.',
    role: 'Black Hat SEO Specialist',
    stars: 5,
  },
  {
    quote: 'As an affiliate SEO, I need every backlink indexed to compete. BestBacklinkIndexer is the best backlink indexer I\'ve ever used. Fast, reliable, and the dashboard is clean.',
    name: 'Ahmed O.',
    role: 'Affiliate SEO / Content Publisher',
    stars: 5,
  },
]

const STATS = [
  { value: '4.7M+', label: 'Backlinks Indexed' },
  { value: '98.2%', label: 'Crawl Success Rate' },
  { value: '<6 hrs', label: 'Avg. Crawl Time' },
  { value: '18K+', label: 'SEOs & Agencies' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Submit Your Backlinks',
    desc: 'Paste URLs, upload a CSV, or push via our REST API. Supports any publicly accessible HTTPS URL — your site, guest posts, Web 2.0s, tier-2 links, PBN pages.',
  },
  {
    step: '02',
    title: 'Google Indexing API Fires',
    desc: 'Our engine immediately sends a crawl request to Google\'s official Indexing API. Googlebot is notified directly — not through ping services or indirect triggers.',
  },
  {
    step: '03',
    title: 'Track Status in Real-Time',
    desc: 'Watch your backlinks progress from QUEUED → CRAWLED → INDEXED in your dashboard. Get notified via Telegram or email when key status changes occur.',
  },
  {
    step: '04',
    title: 'Fallback Methods Activate if Needed',
    desc: 'If any URL needs extra push, we automatically apply IndexNow, sitemap pings, and crawl triggers. No link left behind.',
  },
]

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  }

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Index Backlinks Fast with BestBacklinkIndexer',
    description: 'Submit backlinks to Google using the official Google Indexing API for rapid indexing.',
    step: HOW_IT_WORKS.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.title,
      text: s.desc,
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bestbacklinkindexer.com.ng' },
    ],
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Inline page-level JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* ── NAV ── */}
      <nav
        aria-label="Main navigation"
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(3,7,18,0.94)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <a href="/" aria-label="BestBacklinkIndexer — Home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 32, height: 32, background: 'var(--green)',
              borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(34,197,94,0.4)',
            }}>
              <span style={{ color: '#000', fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>BBI</span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>
              BestBacklink<span style={{ color: 'var(--green)' }}>Indexer</span>
            </span>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <a href="#how-it-works" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px', textDecoration: 'none' }}>How It Works</a>
            <a href="#features" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px', textDecoration: 'none' }}>Features</a>
            <a href="#pricing" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px', textDecoration: 'none' }}>Pricing</a>
            <a href="#faq" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px', textDecoration: 'none' }}>FAQ</a>
            <Link href="/auth/login" className="btn btn-ghost" style={{ padding: '7px 16px', fontSize: 13, marginLeft: 8 }}>Login</Link>
            <Link href="/auth/register" className="btn btn-primary" style={{ padding: '7px 18px', fontSize: 13 }}>Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        aria-labelledby="hero-heading"
        style={{
          position: 'relative', overflow: 'hidden',
          padding: '110px 0 90px',
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(34,197,94,0.10), transparent)',
        }}
      >
        {/* Grid lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: 0.25,
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)',
        }} />

        <div className="container" style={{ position: 'relative', textAlign: 'center' }}>
          {/* Trust badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 24, padding: '6px 16px',
            fontSize: 12, color: 'var(--green)', marginBottom: 36,
          }}>
            <span style={{ width: 7, height: 7, background: 'var(--green)', borderRadius: '50%', animation: 'pulse-green 2s infinite' }} />
            Official Google Indexing API — 98.2% Crawl Success Rate
          </div>

          <h1
            id="hero-heading"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(38px, 7.5vw, 76px)',
              fontWeight: 800,
              lineHeight: 1.04,
              marginBottom: 28,
              letterSpacing: '-0.02em',
            }}
          >
            The Best Backlink<br />
            <span style={{ color: 'var(--green)' }}>Indexer Tool Online.</span>
          </h1>

          <p style={{
            fontSize: 19, color: 'var(--text-muted)',
            maxWidth: 620, margin: '0 auto 16px',
            lineHeight: 1.7,
          }}>
            Submit backlinks to Google&apos;s index via the <strong style={{ color: 'var(--text)' }}>official Google Indexing API</strong>.
            Get Googlebot crawling your links within hours — not weeks.
            The fastest backlink indexer for SEOs, agencies &amp; link builders.
          </p>

          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 44 }}>
            Used by 18,000+ SEOs · 4.7M backlinks indexed · No credit card required to start
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 72 }}>
            <Link href="/auth/register" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 16, fontWeight: 700, boxShadow: '0 0 24px rgba(34,197,94,0.35)' }}>
              Index My Backlinks Free →
            </Link>
            <a href="#how-it-works" className="btn btn-ghost" style={{ padding: '14px 28px', fontSize: 15 }}>
              See How It Works
            </a>
          </div>

          {/* Live API demo terminal */}
          <div style={{
            maxWidth: 720, margin: '0 auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            textAlign: 'left',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.08)',
          }}>
            <div style={{
              background: 'var(--bg-elevated)',
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#f85149' }} />
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#e3b341' }} />
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3fb950' }} />
              <span style={{ marginLeft: 10, color: 'var(--text-dim)', fontSize: 12 }}>bestbacklinkindexer — api-demo.sh</span>
            </div>
            <div style={{ padding: '22px 28px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 2 }}>
              <div style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--green)' }}>$</span>{' '}curl -X POST https://bestbacklinkindexer.com.ng/api/urls \
              </div>
              <div style={{ color: 'var(--text-muted)', paddingLeft: 20 }}>
                -H <span style={{ color: '#e3b341' }}>&quot;X-API-Key: bbi_a8f2c4d9...&quot;</span> \
              </div>
              <div style={{ color: 'var(--text-muted)', paddingLeft: 20, marginBottom: 14 }}>
                -d <span style={{ color: '#58a6ff' }}>&apos;{'{"urls": ["https://guestpost.com/your-backlink-page"]}'}&apos;</span>
              </div>
              <div style={{ color: 'var(--green)', marginBottom: 2 }}>{'{'}</div>
              <div style={{ paddingLeft: 20, color: '#58a6ff' }}>&quot;success&quot;: <span style={{ color: '#e3b341' }}>true</span>,</div>
              <div style={{ paddingLeft: 20, color: '#58a6ff' }}>&quot;submitted&quot;: <span style={{ color: '#e3b341' }}>1</span>,</div>
              <div style={{ paddingLeft: 20, color: '#58a6ff' }}>&quot;method&quot;: <span style={{ color: '#e3b341' }}>&quot;GOOGLE_INDEXING_API&quot;</span>,</div>
              <div style={{ paddingLeft: 20, color: '#58a6ff' }}>&quot;creditsRemaining&quot;: <span style={{ color: '#e3b341' }}>499</span>,</div>
              <div style={{ paddingLeft: 20, color: '#58a6ff' }}>&quot;status&quot;: <span style={{ color: 'var(--green)' }}>&quot;QUEUED&quot;</span>,</div>
              <div style={{ paddingLeft: 20, color: '#58a6ff' }}>&quot;estimatedCrawlTime&quot;: <span style={{ color: '#e3b341' }}>&quot;&lt;6 hours&quot;</span></div>
              <div style={{ color: 'var(--green)' }}>{'}'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div
        aria-label="Platform statistics"
        style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}
      >
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
            {STATS.map((stat, i) => (
              <div key={i} style={{
                padding: '30px 24px',
                borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--green)', marginBottom: 6 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" aria-labelledby="how-heading" style={{ padding: '100px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
              HOW IT WORKS
            </div>
            <h2 id="how-heading" style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>
              Index backlinks in 4 simple steps
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>
              From submission to confirmed Google indexation — the fastest, most reliable process available.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '28px 24px',
                position: 'relative',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)',
                  fontWeight: 700, letterSpacing: '0.1em', marginBottom: 16,
                  background: 'rgba(34,197,94,0.08)', borderRadius: 4,
                  padding: '3px 10px', display: 'inline-block',
                }}>
                  STEP {step.step}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>{step.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.75 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        id="features"
        aria-labelledby="features-heading"
        style={{ padding: '100px 0', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
              FEATURES
            </div>
            <h2 id="features-heading" style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>
              Every indexing method. One dashboard.
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 560, margin: '0 auto' }}>
              Built by SEOs who were tired of manual submissions and paid indexers that don&apos;t actually use the Google API.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {FEATURES.map((f, i) => (
              <article
                key={i}
                className="card"
                style={{ transition: 'border-color 0.2s, box-shadow 0.2s', cursor: 'default' }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--border-glow)'
                  e.currentTarget.style.boxShadow = '0 0 24px rgba(34,197,94,0.06)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ fontSize: 30, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.75 }}>{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section aria-labelledby="comparison-heading" style={{ padding: '100px 0' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 12, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
              WHY WE WIN
            </div>
            <h2 id="comparison-heading" style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, marginBottom: 16 }}>
              BestBacklinkIndexer vs other backlink indexers
            </h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
              fontFamily: 'var(--font-mono)', fontSize: 13,
            }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Feature</th>
                  <th style={{ padding: '14px 20px', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>BestBacklinkIndexer</th>
                  <th style={{ padding: '14px 20px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Other Indexers</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Official Google Indexing API', '✓', '✗ (ping-based only)'],
                  ['IndexNow multi-engine fallback', '✓', 'Rarely'],
                  ['Real-time crawl status tracking', '✓', 'Limited'],
                  ['Bulk CSV backlink upload', '✓', 'Some'],
                  ['Drip-feed scheduling', '✓', '✗'],
                  ['REST API for automation', '✓', 'Some'],
                  ['Telegram bot notifications', '✓', '✗'],
                  ['White-label agency reports', '✓', '✗'],
                  ['Credit refunds for failures', '✓', '✗'],
                  ['Average crawl time', '<6 hours', '24–72+ hours'],
                  ['Crawl success rate', '98.2%', '40–70%'],
                ].map(([feature, us, them], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '13px 20px', color: 'var(--text)' }}>{feature}</td>
                    <td style={{ padding: '13px 20px', textAlign: 'center', color: 'var(--green)', fontWeight: 600 }}>{us}</td>
                    <td style={{ padding: '13px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>{them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section
        id="pricing"
        aria-labelledby="pricing-heading"
        style={{ padding: '100px 0', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>PRICING</div>
            <h2 id="pricing-heading" style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>
              Simple backlink indexer pricing
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>1 credit = 1 backlink submitted. No hidden fees. Cancel anytime.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 980, margin: '0 auto' }}>
            {PLANS.map((plan) => (
              <div key={plan.slug} style={{
                background: plan.highlight ? 'linear-gradient(145deg, rgba(34,197,94,0.09), rgba(34,197,94,0.02))' : 'var(--bg)',
                border: plan.highlight ? '1px solid var(--green)' : '1px solid var(--border)',
                borderRadius: 12,
                padding: 30,
                position: 'relative',
                boxShadow: plan.highlight ? '0 0 40px rgba(34,197,94,0.12)' : 'none',
              }}>
                {plan.highlight && (
                  <div style={{
                    position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--green)', color: '#000', fontSize: 11, fontWeight: 700,
                    padding: '3px 16px', borderRadius: '0 0 8px 8px', whiteSpace: 'nowrap',
                  }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ marginBottom: 22 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, fontFamily: 'var(--font-display)' }}>{plan.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 44, fontWeight: 800, fontFamily: 'var(--font-display)', color: plan.price === 0 ? 'var(--text)' : 'var(--green)' }}>
                      {plan.price === 0 ? 'Free' : `$${plan.price}`}
                    </span>
                    {plan.price > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>/month</span>}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
                    {plan.credits.toLocaleString()} backlink credits/month
                  </div>
                </div>

                <ul style={{ listStyle: 'none', marginBottom: 26 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '5px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/auth/register"
                  className={`btn ${plan.highlight ? 'btn-primary' : 'btn-outline'}`}
                  style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, fontWeight: 600 }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, marginTop: 28 }}>
            All plans include: SSL encrypted submissions · GDPR compliant · 99.9% uptime SLA
          </p>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section aria-labelledby="testimonials-heading" style={{ padding: '100px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>REVIEWS</div>
            <h2 id="testimonials-heading" style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700 }}>
              Trusted by 18,000+ SEOs &amp; link builders
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {TESTIMONIALS.map((t, i) => (
              <article key={i} className="card" itemScope itemType="https://schema.org/Review">
                <div style={{ color: 'var(--green)', fontSize: 16, marginBottom: 16, letterSpacing: 2 }}>
                  {'★'.repeat(t.stars)}
                </div>
                <p
                  style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}
                  itemProp="reviewBody"
                >
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }} itemProp="author">{t.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t.role}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" aria-labelledby="faq-heading" style={{ padding: '80px 0', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 12, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>FAQ</div>
            <h2 id="faq-heading" style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700 }}>
              Backlink indexer — frequently asked questions
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  style={{
                    width: '100%', textAlign: 'left', padding: '18px 22px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', fontFamily: 'var(--font-mono)',
                    fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{faq.q}</span>
                  <span style={{ color: 'var(--green)', flexShrink: 0, marginLeft: 16, fontSize: 18 }}>
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 22px 20px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.85 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        aria-labelledby="cta-heading"
        style={{
          padding: '100px 0',
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(34,197,94,0.07), transparent)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 id="cta-heading" style={{
            fontSize: 'clamp(30px, 5.5vw, 56px)', fontWeight: 800, marginBottom: 18,
            fontFamily: 'var(--font-display)', lineHeight: 1.1,
          }}>
            Start indexing backlinks today.<br />
            <span style={{ color: 'var(--green)' }}>10 free submissions on signup.</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 36, maxWidth: 440, margin: '0 auto 36px' }}>
            No credit card required. Get your first backlinks indexed within hours.
            Join 18,000+ SEOs already using the best backlink indexer online.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/auth/register" className="btn btn-primary" style={{ padding: '15px 36px', fontSize: 17, fontWeight: 700, boxShadow: '0 0 28px rgba(34,197,94,0.4)' }}>
              Create Free Account →
            </Link>
            <a href="#pricing" className="btn btn-ghost" style={{ padding: '15px 28px', fontSize: 15 }}>
              View Pricing
            </a>
          </div>
          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-dim)' }}>
            ✓ Free forever plan &nbsp;·&nbsp; ✓ No credit card &nbsp;·&nbsp; ✓ Cancel anytime
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer aria-label="Site footer" style={{ borderTop: '1px solid var(--border)', padding: '48px 0 32px' }}>
        <div className="container">
          {/* Footer top */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 48 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, background: 'var(--green)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#000', fontSize: 10, fontWeight: 800 }}>BBI</span>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>BestBacklink<span style={{ color: 'var(--green)' }}>Indexer</span></span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, maxWidth: 240 }}>
                The best backlink indexer tool online. Official Google Indexing API integration for fast, reliable backlink indexing.
              </p>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontWeight: 600 }}>Product</div>
              {['Features', 'Pricing', 'API Docs', 'Changelog', 'Status Page'].map(l => (
                <div key={l} style={{ marginBottom: 10 }}>
                  <a href="#" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>{l}</a>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontWeight: 600 }}>Use Cases</div>
              {['Backlink Indexing', 'Bulk URL Indexer', 'PBN Link Indexer', 'Tier 2 Link Indexer', 'Agency Backlink Reports'].map(l => (
                <div key={l} style={{ marginBottom: 10 }}>
                  <a href="#" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>{l}</a>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontWeight: 600 }}>Company</div>
              {['About Us', 'Blog', 'Contact', 'Privacy Policy', 'Terms of Service'].map(l => (
                <div key={l} style={{ marginBottom: 10 }}>
                  <a href="#" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>{l}</a>
                </div>
              ))}
            </div>
          </div>

          {/* Footer bottom */}
          <div style={{
            borderTop: '1px solid var(--border)', paddingTop: 24,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 12,
          }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              © {new Date().getFullYear()} BestBacklinkIndexer.com.ng — The Best Backlink Indexer Tool Online
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              Built for SEOs · Powered by Google Indexing API
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
