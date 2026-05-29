'use client'

import { useState, useEffect } from 'react'

interface UserCredits {
  credits: number
  plan: string
}

type IndexingMode = 'normal' | 'instant'

interface SubmissionResult {
  url: string
  status: 'queued' | 'duplicate'
  submissionId?: string
}

interface ApiResponse {
  success: boolean
  error?: string
  data?: {
    submitted: number
    duplicates: number
    creditsUsed: number
    creditsRemaining: number
    indexingMode: string
    results: SubmissionResult[]
  }
}

export default function SubmitPage() {
  const [urls, setUrls]           = useState('')
  const [mode, setMode]           = useState<IndexingMode>('normal')
  const [project, setProject]     = useState('Link Submit')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<ApiResponse | null>(null)
  const [user, setUser]           = useState<UserCredits | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.success) setUser({ credits: d.data.credits, plan: d.data.plan }) })
      .catch(() => {})
  }, [])

  const urlList = urls
    .split(/[\n,]+/)
    .map(u => u.trim())
    .filter(u => u.length > 0)

  const creditsPerUrl   = mode === 'instant' ? 10 : 1
  const creditsNeeded   = urlList.length * creditsPerUrl
  const canAfford       = user ? user.credits >= creditsNeeded : true
  const urlCountValid   = urlList.length >= 1 && urlList.length <= 500

  async function handleSubmit() {
    if (!urlCountValid || loading) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/urls/link-submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ urls: urlList, instant: mode === 'instant', project }),
      })
      const data: ApiResponse = await res.json()
      setResult(data)
      if (data.success && data.data) {
        setUser(prev => prev ? { ...prev, credits: data.data!.creditsRemaining } : null)
        if (data.data.submitted > 0) setUrls('')
      }
    } catch {
      setResult({ success: false, error: 'Network error — please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const card: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '24px',
  }

  const label: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 8,
    fontFamily: 'var(--font-mono)',
  }

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', margin: '0 0 6px' }}>
          Submit URLs
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Send URLs to InstantIndexer.org for fast Google indexing.
        </p>
      </div>

      {/* Mode selector */}
      <div style={{ ...card, marginBottom: 16 }}>
        <span style={label}>Indexing Mode</span>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['normal', 'instant'] as const).map(m => {
            const active = mode === m
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 7, cursor: 'pointer',
                  background: active ? 'var(--green-glow)' : 'var(--bg-elevated)',
                  border: active ? '1px solid var(--border-glow)' : '1px solid var(--border)',
                  color: active ? 'var(--green)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 3 }}>
                  {m === 'normal' ? '⊕ Normal' : '⚡ Instant'}
                </div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  {m === 'normal' ? '1 credit / URL — standard speed' : '10 credits / URL — priority queue'}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* URL input */}
      <div style={{ ...card, marginBottom: 16 }}>
        <label style={label} htmlFor="urls">
          URLs <span style={{ color: 'var(--text-dim)', textTransform: 'none', letterSpacing: 0 }}>
            — one per line or comma-separated (max 500)
          </span>
        </label>
        <textarea
          id="urls"
          value={urls}
          onChange={e => setUrls(e.target.value)}
          placeholder={'https://example.com/page-1\nhttps://example.com/page-2'}
          rows={10}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 7, color: 'var(--text)', fontFamily: 'var(--font-mono)',
            fontSize: 12, padding: '12px 14px', resize: 'vertical',
            outline: 'none', lineHeight: 1.6,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
          <span>
            {urlList.length > 0
              ? `${urlList.length} URL${urlList.length !== 1 ? 's' : ''} detected`
              : 'Paste or type URLs above'}
          </span>
          {urlList.length > 500 && (
            <span style={{ color: 'var(--red)' }}>⚠ Max 500 URLs per submission</span>
          )}
        </div>
      </div>

      {/* Project name */}
      <div style={{ ...card, marginBottom: 16 }}>
        <label style={label} htmlFor="project">Project Label (optional)</label>
        <input
          id="project"
          type="text"
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="Link Submit"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 7, color: 'var(--text)', fontFamily: 'var(--font-mono)',
            fontSize: 13, padding: '10px 14px', outline: 'none',
          }}
        />
      </div>

      {/* Cost summary + submit */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 13 }}>
            {urlList.length > 0 ? (
              <span>
                Cost:{' '}
                <strong style={{ color: canAfford ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                  {creditsNeeded.toLocaleString()} credit{creditsNeeded !== 1 ? 's' : ''}
                </strong>
                {user && (
                  <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                    ({user.credits.toLocaleString()} available)
                  </span>
                )}
              </span>
            ) : (
              <span style={{ color: 'var(--text-dim)' }}>Enter URLs above to see cost</span>
            )}
            {!canAfford && urlList.length > 0 && (
              <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>
                Insufficient credits — need {creditsNeeded - (user?.credits ?? 0)} more
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !urlCountValid || !canAfford}
            style={{
              padding: '10px 24px', borderRadius: 7, cursor: (loading || !urlCountValid || !canAfford) ? 'not-allowed' : 'pointer',
              background: (loading || !urlCountValid || !canAfford) ? 'var(--bg-elevated)' : 'var(--green)',
              border: '1px solid transparent',
              color: (loading || !urlCountValid || !canAfford) ? 'var(--text-dim)' : '#000',
              fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-mono)',
              transition: 'all 0.15s',
            }}
          >
            {loading ? 'Submitting…' : `Submit ${urlList.length > 0 ? urlList.length + ' URL' + (urlList.length !== 1 ? 's' : '') : 'URLs'}`}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{
          ...card,
          borderColor: result.success ? 'var(--border-glow)' : 'rgba(248,81,73,0.35)',
          background: result.success ? 'var(--green-glow)' : 'rgba(248,81,73,0.06)',
        }}>
          {result.success && result.data ? (
            <>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
                {[
                  { label: 'Queued',     value: result.data.submitted,  color: 'var(--green)' },
                  { label: 'Duplicates', value: result.data.duplicates, color: 'var(--text-muted)' },
                  { label: 'Credits used', value: result.data.creditsUsed, color: 'var(--yellow)' },
                  { label: 'Credits left', value: result.data.creditsRemaining, color: 'var(--blue)' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'var(--font-display)' }}>{s.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              {result.data.results.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  {result.data.results.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: r.status === 'queued' ? 'var(--green)' : 'var(--text-dim)', flexShrink: 0 }}>
                        {r.status === 'queued' ? '✓' : '~'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url}</span>
                      <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--red)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              ✕ {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
