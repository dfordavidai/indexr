'use client'

import { useState } from 'react'
import Link from 'next/link'

const PLANS = [
  {
    name: 'Starter',
    slug: 'starter',
    price: 5,
    credits: 500,
    perLink: '$0.010',
    badge: null,
    features: [
      '500 backlink credits (never expire)',
      'Google Indexing API',
      'Real-time crawl tracking',
      'Bulk paste (up to 50 URLs)',
      'Email notifications',
    ],
    cta: 'Buy Starter →',
    highlight: false,
  },
  {
    name: 'Pro',
    slug: 'pro',
    price: 39,
    credits: 5000,
    perLink: '$0.0078',
    badge: 'MOST POPULAR',
    features: [
      '5,000 backlink credits (never expire)',
      'Google Indexing API + IndexNow fallback',
      'Bulk CSV upload (up to 500 URLs)',
      'REST API + API key access',
      'Telegram bot notifications',
      'Priority support',
    ],
    cta: 'Buy Pro →',
    highlight: true,
  },
  {
    name: 'Agency',
    slug: 'agency',
    price: 149,
    credits: 20000,
    perLink: '$0.0075',
    badge: null,
    features: [
      '20,000 backlink credits (never expire)',
      'All Pro features',
      'Drip-feed scheduling',
      'White-label PDF reports',
      'Admin API access',
      'Dedicated account manager',
    ],
    cta: 'Buy Agency →',
    highlight: false,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    price: 349,
    credits: 60000,
    perLink: '$0.0058',
    badge: 'BEST VALUE',
    features: [
      '60,000 backlink credits (never expire)',
      'All Agency features',
      'Priority indexing queue',
      'Multi-seat dashboard (10 seats)',
      'White-label client portal',
      'Custom SLA & invoicing',
    ],
    cta: 'Buy Enterprise →',
    highlight: false,
  },
]

const FAQS = [
  {
    q: 'How does BestBacklinkIndexer work?',
    a: 'We use the official Google Indexing API to directly notify Googlebot to crawl your backlinks — the same channel Google uses internally. This gets links crawled in hours, not weeks.',
  },
  {
    q: 'Can I index backlinks from sites I don\'t own?',
    a: 'Yes. Unlike Google Search Console, our API integration submits any publicly accessible URL — guest posts, Web 2.0s, tier-2 links, PBN pages, forum profiles.',
  },
  {
    q: 'Do credits expire?',
    a: 'Never. Buy once and use at your own pace — no monthly resets, no subscriptions. Credits are yours until you use them.',
  },
  {
    q: 'What if a backlink fails to index?',
    a: 'We automatically retry with fallback methods (IndexNow, sitemap ping). If a URL still fails, we show you the exact reason and refund the credit.',
  },
  {
    q: 'Is there a REST API?',
    a: 'Yes — Pro and above. Generate an API key in your dashboard and POST URLs to /api/urls. Works with GSA SER, RankerX, or any custom automation stack.',
  },
]

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(3,7,18,0.94)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 32, height: 32, background: 'var(--green)',
              borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(34,197,94,0.4)',
            }}>
              <span style={{ color: '#000', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>BBI</span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17 }}>
              BestBacklink<span style={{ color: 'var(--green)' }}>Indexer</span>
            </span>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <a href="#pricing" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px', textDecoration: 'none' }}>Pricing</a>
            <a href="#faq" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px', textDecoration: 'none' }}>FAQ</a>
            <Link href="/auth/login" className="btn btn-ghost" style={{ padding: '7px 16px', fontSize: 13, marginLeft: 8 }}>Login</Link>
            <Link href="/auth/register" className="btn btn-primary" style={{ padding: '7px 18px', fontSize: 13 }}>Get Started →</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        padding: '100px 0 80px',
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(34,197,94,0.10), transparent)',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: 0.2,
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)',
        }} />

        <div className="container" style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 24, padding: '6px 16px',
            fontSize: 12, color: 'var(--green)', marginBottom: 32,
          }}>
            <span style={{ width: 7, height: 7, background: 'var(--green)', borderRadius: '50%' }} />
            Official Google Indexing API · 98.2% Crawl Success Rate
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 7vw, 70px)',
            fontWeight: 800, lineHeight: 1.05,
            marginBottom: 24, letterSpacing: '-0.02em',
          }}>
            The Best Backlink<br />
            <span style={{ color: 'var(--green)' }}>Indexer Tool Online.</span>
          </h1>

          <p style={{
            fontSize: 18, color: 'var(--text-muted)',
            maxWidth: 580, margin: '0 auto 40px',
            lineHeight: 1.7,
          }}>
            Get Googlebot crawling your backlinks within hours using the{' '}
            <strong style={{ color: 'var(--text)' }}>official Google Indexing API</strong>.
            Credits never expire. No subscriptions.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/auth/register" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 16, fontWeight: 700, boxShadow: '0 0 24px rgba(34,197,94,0.35)' }}>
              Start Indexing — From $5 →
            </Link>
            <a href="#pricing" className="btn btn-ghost" style={{ padding: '14px 28px', fontSize: 15 }}>
              View Pricing
            </a>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 20 }}>
            Trusted by 300+ SEOs · 87K+ backlinks indexed · Pay via USDT or Bitcoin
          </p>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{
        padding: '80px 0',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>PRICING</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, marginBottom: 12 }}>
              Pay once. Use forever.
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
              1 credit = 1 backlink submitted.{' '}
              <strong style={{ color: 'var(--green)' }}>Credits never expire</strong>. No monthly resets.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, maxWidth: 1080, margin: '0 auto' }}>
            {PLANS.map(plan => (
              <div key={plan.slug} style={{
                background: plan.highlight ? 'linear-gradient(145deg, rgba(34,197,94,0.09), rgba(34,197,94,0.02))' : 'var(--bg)',
                border: plan.highlight ? '1px solid var(--green)' : '1px solid var(--border)',
                borderRadius: 12, padding: 26, position: 'relative',
                boxShadow: plan.highlight ? '0 0 40px rgba(34,197,94,0.12)' : 'none',
              }}>
                {plan.badge && (
                  <div style={{
                    position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                    background: plan.highlight ? 'var(--green)' : 'var(--bg-elevated)',
                    color: plan.highlight ? '#000' : 'var(--text-muted)',
                    border: plan.highlight ? 'none' : '1px solid var(--border)',
                    fontSize: 10, fontWeight: 700,
                    padding: '3px 14px', borderRadius: '0 0 8px 8px', whiteSpace: 'nowrap',
                  }}>
                    {plan.badge}
                  </div>
                )}

                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, fontFamily: 'var(--font-display)' }}>{plan.name}</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--green)' }}>
                    ${plan.price}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>one-time</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 2 }}>
                  {plan.credits.toLocaleString()} credits
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 20 }}>
                  {plan.perLink} per link · <span style={{ color: 'var(--green)' }}>never expire</span>
                </div>

                <ul style={{ listStyle: 'none', marginBottom: 22 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--green)', flexShrink: 0, fontWeight: 700 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/auth/register"
                  className={`btn ${plan.highlight ? 'btn-primary' : 'btn-outline'}`}
                  style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 13, fontWeight: 600 }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Crypto payment box */}
          <div style={{
            maxWidth: 600, margin: '36px auto 0',
            background: 'var(--bg-elevated)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 10, padding: '24px 28px',
            textAlign: 'center',
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>
              We accept <strong style={{ color: 'var(--text)' }}>USDT (TRC20)</strong> and{' '}
              <strong style={{ color: 'var(--text)' }}>Bitcoin</strong>. Message us on Telegram to complete your purchase — credits added instantly after confirmation.
            </p>
            <a
              href="https://t.me/Bestbacklinkindexer"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ padding: '11px 24px', fontSize: 13, fontWeight: 700, gap: 8 }}
            >
              ✈ @Bestbacklinkindexer on Telegram
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '80px 0' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>FAQ</div>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 700 }}>
              Frequently asked questions
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, overflow: 'hidden',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '16px 20px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', fontSize: 14,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{faq.q}</span>
                  <span style={{ color: 'var(--green)', flexShrink: 0, marginLeft: 16, fontSize: 18 }}>
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 20px 18px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.85 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 0' }}>
        <div className="container" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12,
        }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            © {new Date().getFullYear()} BestBacklinkIndexer.com.ng
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Privacy Policy', 'Terms of Service', 'Contact'].map(l => (
              <a key={l} href="#" style={{ color: 'var(--text-dim)', fontSize: 12, textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            Powered by Google Indexing API
          </span>
        </div>
      </footer>

    </div>
  )
}
