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
      '10 URL submissions/month',
      'Google Indexing API',
      'Basic status tracking',
      'Dashboard access',
      'Community support',
    ],
    cta: 'Start Free',
    highlight: false,
  },
  {
    name: 'Pro',
    slug: 'pro',
    price: 29,
    credits: 500,
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
    cta: 'Start Pro',
    highlight: true,
  },
  {
    name: 'Agency',
    slug: 'agency',
    price: 99,
    credits: 3000,
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
    cta: 'Start Agency',
    highlight: false,
  },
]

const FAQS = [
  {
    q: 'How does Indexr get my URLs indexed?',
    a: 'Indexr uses the official Google Indexing API (via OAuth2 service account) as the primary method. This directly notifies Google of new or updated URLs. We fall back to IndexNow (Bing-compatible open protocol) and sitemap pinging if the primary method encounters limits.',
  },
  {
    q: 'How long does it take for a URL to get indexed?',
    a: 'Most URLs receive a Googlebot visit within 1–48 hours of submission. Actual indexation (appearing in search results) typically takes 24–72 hours after the crawl. Heavily linked pages or high-trust domains may be faster.',
  },
  {
    q: 'Can I submit backlinks from external sites?',
    a: "Yes. You can submit any HTTPS URL — whether it's a page on your own site or a backlink on a third-party domain. The Google Indexing API accepts any URL, not just sites you own.",
  },
  {
    q: 'What happens if a URL fails to get indexed?',
    a: 'Indexr retries with fallback methods (IndexNow, sitemap ping) and tracks the failure reason. You can see the error in your dashboard and resubmit manually. Credits are refunded for permanent failures.',
  },
  {
    q: 'Do unused credits roll over?',
    a: 'Credits do not roll over between billing months. Any unused credits expire at month end. Agency plan users can contact support for credit extensions.',
  },
  {
    q: 'Is there a REST API?',
    a: 'Yes. Generate an API key in your dashboard and POST URLs to our /api/urls endpoint. Full API docs are available after login. Supported authentication: Bearer token or X-API-Key header.',
  },
  {
    q: 'Can I use the Telegram bot?',
    a: 'Yes. Link your Telegram account in Settings, then use @IndexrBot to submit URLs and receive Googlebot visit notifications and index confirmation alerts directly in Telegram.',
  },
]

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [demoUrls, setDemoUrls] = useState('')

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(3,7,18,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, background: 'var(--green)',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#000', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>IX</span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Indexr</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href="#features" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px' }}>Features</a>
            <a href="#pricing" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px' }}>Pricing</a>
            <a href="#faq" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px' }}>FAQ</a>
            <Link href="/auth/login" className="btn btn-ghost" style={{ padding: '7px 16px', fontSize: 13 }}>Login</Link>
            <Link href="/auth/register" className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }}>Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        padding: '100px 0 80px',
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(34,197,94,0.08), transparent)',
      }}>
        {/* Grid lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: 0.3,
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)',
        }} />

        <div className="container" style={{ position: 'relative', textAlign: 'center' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 20, padding: '5px 14px',
            fontSize: 12, color: 'var(--green)', marginBottom: 32,
          }}>
            <span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', animation: 'pulse-green 2s infinite' }} />
            Google Indexing API — Official Method
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 7vw, 72px)',
            fontWeight: 800,
            lineHeight: 1.05,
            marginBottom: 24,
          }}>
            Get Your Links<br />
            <span style={{ color: 'var(--green)' }}>Indexed Fast.</span>
          </h1>

          <p style={{
            fontSize: 18, color: 'var(--text-muted)',
            maxWidth: 580, margin: '0 auto 40px',
            lineHeight: 1.7,
          }}>
            Submit backlinks and pages to Google's crawl queue via the official Indexing API.
            Track crawl status in real-time. Never leave a link unindexed.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 64 }}>
            <Link href="/auth/register" className="btn btn-primary" style={{ padding: '13px 28px', fontSize: 15 }}>
              Start Indexing Free →
            </Link>
            <a href="#pricing" className="btn btn-ghost" style={{ padding: '13px 28px', fontSize: 15 }}>
              View Pricing
            </a>
          </div>

          {/* Live demo terminal */}
          <div style={{
            maxWidth: 680, margin: '0 auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
            textAlign: 'left',
          }}>
            <div style={{
              background: 'var(--bg-elevated)',
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f85149' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e3b341' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3fb950' }} />
              <span style={{ marginLeft: 8, color: 'var(--text-dim)', fontSize: 11 }}>indexr — submit.sh</span>
            </div>
            <div style={{ padding: '20px 24px', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                <span style={{ color: 'var(--green)' }}>$</span> curl -X POST https://indexr.io/api/urls \
              </div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 16 }}>
                -H <span style={{ color: '#e3b341' }}>"X-API-Key: ixr_a8f2..."</span> \
              </div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 16, paddingLeft: 16 }}>
                -d <span style={{ color: '#58a6ff' }}>'{`"urls": ["https://site.com/backlink-page"]`}'</span>
              </div>
              <div style={{ color: 'var(--green)', marginBottom: 4 }}>{`{`}</div>
              <div style={{ paddingLeft: 16, color: '#58a6ff' }}>
                "success": <span style={{ color: '#e3b341' }}>true</span>,
              </div>
              <div style={{ paddingLeft: 16, color: '#58a6ff' }}>
                "submitted": <span style={{ color: '#e3b341' }}>1</span>,
              </div>
              <div style={{ paddingLeft: 16, color: '#58a6ff' }}>
                "creditsRemaining": <span style={{ color: '#e3b341' }}>499</span>,
              </div>
              <div style={{ paddingLeft: 16, color: '#58a6ff' }}>
                "status": <span style={{ color: '#e3b341' }}>"QUEUED"</span>
              </div>
              <div style={{ color: 'var(--green)' }}>{`}`}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
            {[
              { value: '2.4M+', label: 'URLs Indexed' },
              { value: '98.2%', label: 'Success Rate' },
              { value: '<4 hrs', label: 'Avg. Crawl Time' },
              { value: '12K+', label: 'Active Users' },
            ].map((stat, i) => (
              <div key={i} style={{
                padding: '28px 24px',
                borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--green)', marginBottom: 4 }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section id="features" style={{ padding: '100px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
              WHY INDEXR
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>
              Every method. One dashboard.
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
              Built by SEOs who were tired of manual GSC submissions and third-party indexer fees.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {[
              {
                icon: '⚡',
                title: 'Google Indexing API',
                desc: 'Official OAuth2 service account integration. Directly notifies Google — the same method Google recommends for JobPosting and BroadcastEvent schemas.',
              },
              {
                icon: '🔄',
                title: 'Multi-Method Fallback',
                desc: 'If the primary API hits limits, automatically falls back to IndexNow (Bing), sitemap pinging, and fetch triggers.',
              },
              {
                icon: '📊',
                title: 'Real-Time Status Tracking',
                desc: 'PENDING → QUEUED → SUBMITTED → CRAWLED → INDEXED. Every step visible. Background jobs confirm actual Google indexation.',
              },
              {
                icon: '📦',
                title: 'Bulk & CSV Upload',
                desc: 'Paste 500 URLs at once or upload a CSV. Duplicates are detected and skipped automatically. Credits only deducted for new submissions.',
              },
              {
                icon: '🤖',
                title: 'Telegram Bot',
                desc: 'Link your account and submit URLs via @IndexrBot. Get instant notifications when Googlebot visits your URLs and when they confirm indexed.',
              },
              {
                icon: '🔑',
                title: 'Full REST API',
                desc: 'API key management, programmatic URL submission, status polling. Integrate into your link building workflow, CMS, or automation stack.',
              },
            ].map((f, i) => (
              <div key={i} className="card" style={{ transition: 'border-color 0.2s', cursor: 'default' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-glow)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div style={{ fontSize: 28, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>{f.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '100px 0', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>PRICING</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>
              Simple, transparent pricing
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>1 credit = 1 URL submission. No hidden fees.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 960, margin: '0 auto' }}>
            {PLANS.map((plan) => (
              <div key={plan.slug} style={{
                background: plan.highlight ? 'linear-gradient(145deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))' : 'var(--bg)',
                border: plan.highlight ? '1px solid var(--green)' : '1px solid var(--border)',
                borderRadius: 10,
                padding: 28,
                position: 'relative',
              }}>
                {plan.highlight && (
                  <div style={{
                    position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--green)', color: '#000', fontSize: 11, fontWeight: 600,
                    padding: '3px 14px', borderRadius: '0 0 6px 6px',
                  }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{plan.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 40, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                      {plan.price === 0 ? 'Free' : `$${plan.price}`}
                    </span>
                    {plan.price > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>/month</span>}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                    {plan.credits.toLocaleString()} URL credits/month
                  </div>
                </div>

                <ul style={{ listStyle: 'none', marginBottom: 24 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/auth/register" className={`btn ${plan.highlight ? 'btn-primary' : 'btn-outline'}`}
                  style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ padding: '100px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700 }}>Trusted by link builders</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              {
                quote: 'Submitted 300 tier-2 links and had 87% of them crawled within 12 hours. This is the tool I\'ve been waiting for.',
                name: 'Marcus T.',
                role: 'SEO Agency Owner',
                stars: 5,
              },
              {
                quote: 'The Telegram bot is a game changer. I submit URLs from my phone and get pinged when Google visits. Incredible workflow.',
                name: 'Priya K.',
                role: 'Freelance SEO Consultant',
                stars: 5,
              },
              {
                quote: 'We integrated the API into our PBN management system. 3,000 URLs a month processed automatically. Zero manual work.',
                name: 'Derek R.',
                role: 'Growth Engineer',
                stars: 5,
              },
            ].map((t, i) => (
              <div key={i} className="card">
                <div style={{ color: 'var(--green)', fontSize: 16, marginBottom: 16 }}>
                  {'★'.repeat(t.stars)}
                </div>
                <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic' }}>
                  "{t.quote}"
                </p>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700 }}>Frequently Asked Questions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '18px 20px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', fontFamily: 'var(--font-mono)',
                    fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                  <span style={{ fontWeight: 500 }}>{faq.q}</span>
                  <span style={{ color: 'var(--green)', flexShrink: 0, marginLeft: 16 }}>
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 20px 18px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.8 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '80px 0',
        background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(34,197,94,0.06), transparent)',
        borderTop: '1px solid var(--border)',
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, marginBottom: 16 }}>
            Start indexing today.<br />
            <span style={{ color: 'var(--green)' }}>Free for 10 URLs.</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
            No credit card required. 10 free submissions on signup.
          </p>
          <Link href="/auth/register" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>
            Create Free Account →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 0' }}>
        <div className="container" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, background: 'var(--green)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#000', fontSize: 10, fontWeight: 700 }}>IX</span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Indexr</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8 }}>© {new Date().getFullYear()}</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Privacy', 'Terms', 'API Docs', 'Status'].map(l => (
              <a key={l} href="#" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
