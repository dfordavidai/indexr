'use client'

import { useState, useEffect, useRef } from 'react'

interface DripCampaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED'
  method: string
  urlsTotal: number
  urlsSubmitted: number
  urlsPerDay: number
  minDelayMin: number
  maxDelayMin: number
  smartDrip: boolean
  windowStartHour: number
  windowEndHour: number
  userTimezone: string
  creditsReserved: number
  nextRunAt: string | null
  completedAt: string | null
  createdAt: string
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--green)',
  PAUSED: 'var(--yellow)',
  CANCELLED: 'var(--red)',
  COMPLETED: 'var(--blue)',
}

const METHOD_COLOR: Record<string, string> = {
  GOOGLE_API: 'var(--blue)',
  INDEXNOW: 'var(--green)',
  SITEMAP_PING: 'var(--yellow)',
  FETCH_AS_GOOGLE: '#c9d1d9',
}

const METHODS = [
  { value: 'GOOGLE_API', label: 'Google Indexing API', desc: 'Official, fastest' },
  { value: 'INDEXNOW', label: 'IndexNow', desc: 'Bing/Yandex compatible' },
  { value: 'SITEMAP_PING', label: 'Sitemap Ping', desc: 'XML sitemap submission' },
]

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Australia/Sydney',
]

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 7px', borderRadius: 4,
      background: `${color ?? 'var(--text-dim)'}22`,
      color: color ?? 'var(--text-muted)',
      border: `1px solid ${color ?? 'var(--text-dim)'}44`,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function ProgressBar({ value, total, color = 'var(--green)' }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'var(--text-dim)' }}>
        <span>{value.toLocaleString()} / {total.toLocaleString()} URLs</span>
        <span>{pct}%</span>
      </div>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function DripPage() {
  const [campaigns, setCampaigns] = useState<DripCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Create form state
  const [form, setForm] = useState({
    name: '',
    urlText: '',
    method: 'GOOGLE_API',
    urlsPerDay: 50,
    minDelayMin: 5,
    maxDelayMin: 60,
    smartDrip: true,
    windowStartHour: 9,
    windowEndHour: 17,
    userTimezone: 'UTC',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const loadCampaigns = () => {
    fetch('/api/drip')
      .then(r => r.json())
      .then(d => { if (d.success) setCampaigns(d.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadCampaigns() }, [])

  function parseUrls(text: string): string[] {
    return text.split(/[\n,\s]+/).map(u => u.trim()).filter(u => u.startsWith('http'))
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const urls = text.match(/https?:\/\/[^\s,"\\n]+/g) ?? []
      setForm(f => {
        const existing = new Set(f.urlText.split('\n').map(u => u.trim()).filter(Boolean))
        const newOnes = urls.filter(u => !existing.has(u))
        return { ...f, urlText: f.urlText ? f.urlText + '\n' + newOnes.join('\n') : newOnes.join('\n') }
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function createCampaign() {
    setCreateError('')
    const urls = parseUrls(form.urlText)
    if (!form.name.trim()) { setCreateError('Campaign name is required'); return }
    if (urls.length === 0) { setCreateError('No valid URLs found'); return }
    if (form.minDelayMin > form.maxDelayMin) { setCreateError('Min delay must be ≤ max delay'); return }
    if (form.windowStartHour >= form.windowEndHour) { setCreateError('Window start must be before end'); return }

    setCreating(true)
    try {
      const res = await fetch('/api/drip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, urls }),
      })
      const data = await res.json()
      if (!data.success) {
        setCreateError(data.error ?? 'Failed to create campaign')
      } else {
        notify(`Campaign created! ${data.data.urlsTotal} URLs queued, ${data.data.creditsReserved} credits reserved.`)
        setShowCreate(false)
        setForm({ name: '', urlText: '', method: 'GOOGLE_API', urlsPerDay: 50, minDelayMin: 5, maxDelayMin: 60, smartDrip: true, windowStartHour: 9, windowEndHour: 17, userTimezone: 'UTC' })
        loadCampaigns()
      }
    } catch {
      setCreateError('Network error')
    } finally {
      setCreating(false)
    }
  }

  async function updateCampaign(id: string, updates: { status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED'; urlsPerDay?: number; minDelayMin?: number; maxDelayMin?: number; smartDrip?: boolean; windowStartHour?: number; windowEndHour?: number }) {
    const res = await fetch(`/api/drip/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (data.success) {
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...data.data } : c))
      notify(updates.status === 'PAUSED' ? 'Campaign paused' : updates.status === 'ACTIVE' ? 'Campaign resumed' : 'Campaign cancelled')
    } else {
      notify(data.error ?? 'Error', false)
    }
  }

  const urlCount = parseUrls(form.urlText).length

  if (loading) return (<div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>)

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? 'var(--green)' : 'var(--red)',
          color: '#000', padding: '10px 18px', borderRadius: 8,
          fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            <span style={{ color: 'var(--green)' }}>⏱</span> Drip Campaigns
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Schedule URL batches to be indexed gradually over time</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '10px 20px' }} onClick={() => setShowCreate(true)}>
          + New Campaign
        </button>
      </div>

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏱</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>No drip campaigns yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Submit large URL batches naturally over days or weeks
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Your First Campaign</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {campaigns.map(c => (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                    <Badge label={c.status} color={STATUS_COLOR[c.status]} />
                    <Badge label={c.method} color={METHOD_COLOR[c.method]} />
                    {c.smartDrip && <Badge label="Smart Drip" color="var(--blue)" />}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    Created {fmtDate(c.createdAt)}
                    {c.nextRunAt && c.status === 'ACTIVE' && ` · Next run ${fmtDate(c.nextRunAt)}`}
                    {c.completedAt && ` · Completed ${fmtDate(c.completedAt)}`}
                  </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                  {c.status === 'ACTIVE' && (
                    <button className="btn btn-ghost" style={{ padding: '5px 14px', fontSize: 12 }}
                      onClick={() => updateCampaign(c.id, { status: 'PAUSED' })}>
                      ⏸ Pause
                    </button>
                  )}
                  {c.status === 'PAUSED' && (
                    <button className="btn btn-outline" style={{ padding: '5px 14px', fontSize: 12 }}
                      onClick={() => updateCampaign(c.id, { status: 'ACTIVE' })}>
                      ▶ Resume
                    </button>
                  )}
                  {(c.status === 'ACTIVE' || c.status === 'PAUSED') && (
                    <button className="btn btn-ghost" style={{ padding: '5px 14px', fontSize: 12, color: 'var(--red)' }}
                      onClick={() => { if (confirm('Cancel campaign? Unused credits will be refunded.')) updateCampaign(c.id, { status: 'CANCELLED' }) }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <ProgressBar
                value={c.urlsSubmitted}
                total={c.urlsTotal}
                color={c.status === 'COMPLETED' ? 'var(--blue)' : STATUS_COLOR[c.status]}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 16 }}>
                <div style={{ fontSize: 11 }}>
                  <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>PACE</div>
                  <div style={{ color: 'var(--text)' }}>{c.urlsPerDay}/day</div>
                </div>
                <div style={{ fontSize: 11 }}>
                  <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>DELAY</div>
                  <div style={{ color: 'var(--text)' }}>{c.minDelayMin}–{c.maxDelayMin} min</div>
                </div>
                {c.smartDrip && (
                  <div style={{ fontSize: 11 }}>
                    <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>WINDOW</div>
                    <div style={{ color: 'var(--text)' }}>{c.windowStartHour}:00–{c.windowEndHour}:00 {c.userTimezone}</div>
                  </div>
                )}
                <div style={{ fontSize: 11 }}>
                  <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>CREDITS LEFT</div>
                  <div style={{ color: 'var(--yellow)' }}>{c.creditsReserved}</div>
                </div>
                <div style={{ fontSize: 11 }}>
                  <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>ETA</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {c.status === 'COMPLETED' ? 'Done' :
                      c.urlsPerDay > 0
                        ? `~${Math.ceil((c.urlsTotal - c.urlsSubmitted) / c.urlsPerDay)}d`
                        : '—'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '40px 16px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: 640 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>New Drip Campaign</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Credits are reserved upfront and refunded if cancelled.</div>

            {createError && (
              <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
                {createError}
              </div>
            )}

            <div style={{ display: 'grid', gap: 16 }}>
              {/* Name */}
              <div>
                <label className="label">Campaign Name</label>
                <input className="input" placeholder="e.g. Blog Posts October Batch" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* URLs */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="label" style={{ margin: 0 }}>URLs (one per line)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {urlCount > 0 && <span style={{ fontSize: 12, color: 'var(--green)' }}>{urlCount.toLocaleString()} URLs</span>}
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => fileRef.current?.click()}>Upload CSV</button>
                    <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCsvUpload} style={{ display: 'none' }} />
                  </div>
                </div>
                <textarea className="input" value={form.urlText} onChange={e => setForm(f => ({ ...f, urlText: e.target.value }))}
                  placeholder="https://example.com/page-1&#10;https://example.com/page-2"
                  style={{ minHeight: 140, resize: 'vertical', lineHeight: 1.6 }} />
              </div>

              {/* Method */}
              <div>
                <label className="label">Indexing Method</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {METHODS.map(m => (
                    <label key={m.value} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
                      background: form.method === m.value ? 'var(--green-glow)' : 'var(--bg-elevated)',
                      border: `1px solid ${form.method === m.value ? 'var(--border-glow)' : 'var(--border)'}`,
                      flex: '1 1 auto',
                    }}>
                      <input type="radio" name="drip-method" value={m.value} checked={form.method === m.value} onChange={() => setForm(f => ({ ...f, method: m.value }))} style={{ accentColor: 'var(--green)' }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: form.method === m.value ? 'var(--green)' : 'var(--text)' }}>{m.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pacing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label className="label">URLs per day</label>
                  <input className="input" type="number" min={1} max={500} value={form.urlsPerDay} onChange={e => setForm(f => ({ ...f, urlsPerDay: parseInt(e.target.value) || 50 }))} />
                </div>
                <div>
                  <label className="label">Min delay (min)</label>
                  <input className="input" type="number" min={1} max={1440} value={form.minDelayMin} onChange={e => setForm(f => ({ ...f, minDelayMin: parseInt(e.target.value) || 5 })) } />
                </div>
                <div>
                  <label className="label">Max delay (min)</label>
                  <input className="input" type="number" min={1} max={1440} value={form.maxDelayMin} onChange={e => setForm(f => ({ ...f, maxDelayMin: parseInt(e.target.value) || 60 })) } />
                </div>
              </div>

              {/* Smart drip */}
              <div className="card" style={{ background: 'var(--bg-elevated)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: form.smartDrip ? 14 : 0 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>🧠 Smart Drip</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Randomize submission times within a daily window to appear organic</div>
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, smartDrip: !f.smartDrip }))} style={{
                    padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: form.smartDrip ? 'var(--green)' : 'var(--bg-card)', color: form.smartDrip ? '#000' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  }}>{form.smartDrip ? 'ON' : 'OFF'}</button>
                </div>

                {form.smartDrip && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <div>
                      <label className="label">Window start (hour)</label>
                      <input className="input" type="number" min={0} max={23} value={form.windowStartHour} onChange={e => setForm(f => ({ ...f, windowStartHour: parseInt(e.target.value) || 9 })) } />
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>e.g. 9 = 9:00 AM</div>
                    </div>
                    <div>
                      <label className="label">Window end (hour)</label>
                      <input className="input" type="number" min={1} max={24} value={form.windowEndHour} onChange={e => setForm(f => ({ ...f, windowEndHour: parseInt(e.target.value) || 17 })) } />
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>e.g. 17 = 5:00 PM</div>
                    </div>
                    <div>
                      <label className="label">Timezone</label>
                      <select className="input" value={form.userTimezone} onChange={e => setForm(f => ({ ...f, userTimezone: e.target.value }))} style={{ cursor: 'pointer' }}>
                        {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              {urlCount > 0 && (
                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text)' }}>Summary: </strong>
                  {urlCount.toLocaleString()} URLs at {form.urlsPerDay}/day ≈ {Math.ceil(urlCount / form.urlsPerDay)} days
                  {' · '}Delays {form.minDelayMin}–{form.maxDelayMin} min
                  {form.smartDrip && ` · Window ${form.windowStartHour}:00–${form.windowEndHour}:00 ${form.userTimezone}`}
                  {' · '}<strong style={{ color: 'var(--yellow)' }}>{urlCount} credits will be reserved</strong>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px' }} disabled={creating || urlCount === 0 || !form.name.trim()} onClick={createCampaign}>
                  {creating ? 'Creating...' : `Reserve ${urlCount} Credits & Start Campaign`}
                </button>
                <button className="btn btn-ghost" style={{ padding: '11px 18px' }} onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
