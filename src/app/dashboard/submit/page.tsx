'use client'

import { useState, useRef, useEffect } from 'react'

interface SubmissionResult {
  url: string
  status: 'queued' | 'duplicate' | 'invalid' | 'insufficient_credits'
  submissionId?: string
}

interface SubmitResponse {
  submitted: number
  duplicates: number
  creditsUsed: number
  creditsRemaining: number
  results: SubmissionResult[]
}

const METHODS = [
  { value: 'GOOGLE_API',   label: 'Google Indexing API', desc: 'Official method, fastest' },
  { value: 'INDEXNOW',     label: 'IndexNow',            desc: 'Bing/Yandex compatible'  },
  { value: 'SITEMAP_PING', label: 'Sitemap Ping',        desc: 'XML sitemap submission'  },
]

export default function SubmitPage() {
  const [urlText,     setUrlText]     = useState('')
  const [method,      setMethod]      = useState('GOOGLE_API')
  const [generalMode, setGeneralMode] = useState(true)   // default ON for all users
  const [isAdmin,     setIsAdmin]     = useState(false)  // only admins see the toggle
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState<SubmitResponse | null>(null)
  const [error,       setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.role === 'ADMIN') {
          setIsAdmin(true)
        }
      })
      .catch(() => {})
  }, [])

  function parseUrls(text: string): string[] {
    return text
      .split(/[\n,\s]+/)
      .map(u => u.trim())
      .filter(u => u.length > 0 && u.startsWith('http'))
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const urls = text.match(/https?:\/\/[^\s,"\\n]+/g) ?? []
      setUrlText(prev => {
        const existing = new Set(prev.split('\n').map(u => u.trim()).filter(Boolean))
        const newOnes  = urls.filter(u => !existing.has(u))
        return prev ? prev + '\n' + newOnes.join('\n') : newOnes.join('\n')
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleSubmit() {
    setError('')
    setResult(null)

    const urls = parseUrls(urlText)
    if (urls.length === 0) {
      setError('No valid URLs found. Enter one URL per line starting with http:// or https://')
      return
    }
    if (urls.length > 500) {
      setError('Maximum 500 URLs per batch. Please split into multiple submissions.')
      return
    }

    setLoading(true)

    try {
      const endpoint = generalMode ? '/api/urls/general' : '/api/urls'
      const body: Record<string, unknown> = { urls }
      if (!generalMode) body.method = method

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error ?? 'Submission failed')
        return
      }

      setResult(data.data)
      setUrlText('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const urlCount = parseUrls(urlText).length

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Submit URLs</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Bulk paste or upload a CSV. Up to 500 URLs per batch.
        </p>
      </div>

      {/* ── Mode toggle — admin only ──────────────────────────────────────── */}
      {isAdmin && (
        <div style={{
          display: 'flex', gap: 0, marginBottom: 28,
          border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
          width: 'fit-content',
        }}>
          <button
            onClick={() => setGeneralMode(true)}
            style={{
              padding: '9px 22px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              border: 'none', outline: 'none',
              background:  generalMode ? 'var(--green)'     : 'var(--bg-elevated)',
              color:        generalMode ? '#000'              : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>
            General Submit
          </button>
          <button
            onClick={() => setGeneralMode(false)}
            style={{
              padding: '9px 22px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              border: 'none', borderLeft: '1px solid var(--border)', outline: 'none',
              background: !generalMode ? 'var(--green)'     : 'var(--bg-elevated)',
              color:      !generalMode ? '#000'              : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>
            GSC Submit
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>

        {/* ── Main form ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label className="label" style={{ margin: 0 }}>URLs (one per line)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {urlCount > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--green)' }}>
                    {urlCount} URL{urlCount !== 1 ? 's' : ''} detected
                  </span>
                )}
                <button
                  className="btn btn-ghost"
                  style={{ padding: '5px 12px', fontSize: 12 }}
                  onClick={() => fileRef.current?.click()}>
                  Upload CSV
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsvUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
            <textarea
              className="input"
              value={urlText}
              onChange={e => setUrlText(e.target.value)}
              placeholder={`https://example.com/page-1\nhttps://example.com/page-2\nhttps://another-site.com/backlink`}
              style={{ minHeight: 280, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
              borderRadius: 6, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 8, padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>
                    {result.submitted}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Queued</div>
                </div>
                {result.duplicates > 0 && (
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--yellow)', fontFamily: 'var(--font-display)' }}>
                      {result.duplicates}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Duplicates skipped</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                    {result.creditsRemaining}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Credits remaining</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                ✓ URLs are queued for indexing. Check status in Submissions.
              </p>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || urlCount === 0}
            style={{ padding: '13px', fontSize: 15, justifyContent: 'center' }}>
            {loading
              ? 'Submitting...'
              : `Submit ${urlCount > 0 ? urlCount + ' URL' + (urlCount !== 1 ? 's' : '') : 'URLs'} →`}
          </button>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Indexing method — admin + GSC mode only */}
          {isAdmin && !generalMode && (
            <div className="card">
              <div className="label" style={{ marginBottom: 14 }}>Indexing Method</div>
              {METHODS.map(m => (
                <label key={m.value} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 6,
                  background: method === m.value ? 'var(--green-glow)'  : 'var(--bg-elevated)',
                  border:     `1px solid ${method === m.value ? 'var(--border-glow)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                }}>
                  <input
                    type="radio"
                    name="method"
                    value={m.value}
                    checked={method === m.value}
                    onChange={() => setMethod(m.value)}
                    style={{ marginTop: 2, accentColor: 'var(--green)' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: method === m.value ? 'var(--green)' : 'var(--text)' }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Tips */}
          <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Tips</div>
              <div>• One URL per line</div>
              <div>• HTTP and HTTPS accepted</div>
              <div>• Max 500 per batch</div>
              <div>• 1 credit per URL</div>
              <div>• Duplicates are skipped</div>
              <div>• CSV: one URL per row or column</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
