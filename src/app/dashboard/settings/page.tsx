'use client'

import { useEffect, useState } from 'react'

interface User {
  id: string
  email: string
  name: string | null
  credits: number
  plan: string
  planSlug: string
  telegramChatId: string | null
}

interface Plan {
  id: string
  name: string
  slug: string
  price: number
  creditsPerMonth: number
  features: string[]
  stripePriceId?: string
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [name, setName] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [billingLoading, setBillingLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/billing/plans').then(r => r.json()),
    ]).then(([meData, plansData]) => {
      if (meData.success) {
        setUser(meData.data)
        setName(meData.data.name ?? '')
        setTelegramChatId(meData.data.telegramChatId ?? '')
      }
      if (plansData.success) setPlans(plansData.data)
    })
  }, [])

  async function saveProfile() {
    setSaveMsg('')
    setSaveError('')
    setSaving(true)

    const body: Record<string, unknown> = { name, telegramChatId: telegramChatId || null }
    if (newPassword && currentPassword) {
      body.currentPassword = currentPassword
      body.newPassword = newPassword
    }

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setSaveMsg('Settings saved successfully.')
      setCurrentPassword('')
      setNewPassword('')
    } else {
      setSaveError(data.error ?? 'Save failed')
    }
  }

  async function handleUpgrade(planId: string) {
    setBillingLoading(true)
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    })
    const data = await res.json()
    setBillingLoading(false)
    if (data.success && data.data?.url) {
      window.location.href = data.data.url
    }
  }

  async function handlePortal() {
    setBillingLoading(true)
    const res = await fetch('/api/billing?action=portal', { method: 'POST' })
    const data = await res.json()
    setBillingLoading(false)
    if (data.success && data.data?.url) {
      window.location.href = data.data.url
    }
  }

  if (!user) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manage your profile, billing, and integrations.</p>
      </div>

      {/* Profile */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Profile</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Email</label>
            <input className="input" value={user.email} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Change Password</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Current Password</label>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>
        </div>
      </div>

      {/* Telegram */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Telegram Integration</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
          Link your Telegram account to submit URLs and receive Googlebot visit notifications via bot.
          Start a chat with <strong style={{ color: 'var(--text)' }}>@IndexrBot</strong> and run <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>/start</code> to get your Chat ID.
        </p>
        <div>
          <label className="label">Telegram Chat ID</label>
          <input
            className="input"
            value={telegramChatId}
            onChange={e => setTelegramChatId(e.target.value)}
            placeholder="e.g. 123456789"
          />
        </div>
      </div>

      {/* Save button */}
      {(saveMsg || saveError) && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 6, fontSize: 13,
          background: saveMsg ? 'rgba(34,197,94,0.08)' : 'rgba(248,81,73,0.08)',
          border: `1px solid ${saveMsg ? 'rgba(34,197,94,0.3)' : 'rgba(248,81,73,0.3)'}`,
          color: saveMsg ? 'var(--green)' : 'var(--red)',
        }}>
          {saveMsg || saveError}
        </div>
      )}
      <button
        className="btn btn-primary"
        style={{ padding: '11px 24px', fontSize: 14, marginBottom: 32 }}
        disabled={saving}
        onClick={saveProfile}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>

      {/* Billing */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Billing &amp; Plan</div>
          {user.planSlug !== 'free' && (
            <button
              className="btn btn-ghost"
              style={{ padding: '7px 14px', fontSize: 12 }}
              disabled={billingLoading}
              onClick={handlePortal}>
              Manage Billing →
            </button>
          )}
        </div>

        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 8, padding: '14px 18px', marginBottom: 24,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{user.plan} Plan</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {user.credits.toLocaleString()} credits remaining
              </div>
            </div>
            <span style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 4,
              background: 'var(--green-glow)', color: 'var(--green)', fontWeight: 500,
            }}>
              Active
            </span>
          </div>
        </div>

        {plans.length > 0 && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              {user.planSlug === 'free' ? 'Upgrade to get more credits:' : 'Change your plan:'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {plans.filter(p => p.slug !== 'free').map(plan => (
                <div key={plan.id} style={{
                  border: `1px solid ${user.planSlug === plan.slug ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '16px',
                  background: user.planSlug === plan.slug ? 'var(--green-glow)' : 'var(--bg-elevated)',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 4 }}>
                    ${plan.price}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                    {plan.creditsPerMonth.toLocaleString()} credits/month
                  </div>
                  {user.planSlug === plan.slug ? (
                    <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>✓ Current plan</div>
                  ) : (
                    <button
                      className="btn btn-outline"
                      style={{ width: '100%', justifyContent: 'center', padding: '8px', fontSize: 12 }}
                      disabled={billingLoading}
                      onClick={() => handleUpgrade(plan.id)}>
                      {billingLoading ? 'Loading...' : `Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
