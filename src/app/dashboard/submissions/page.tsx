'use client'

import { useEffect, useState, useCallback } from 'react'

interface Submission {
  id: string
  url: string
  status: string
  method: string
  source: string
  createdAt: string
  updatedAt: string
  indexedAt: string | null
  lastCheckedAt: string | null
  errorMessage: string | null
  creditsCost: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'Pending',   color: 'var(--text-muted)', bg: 'var(--bg-elevated)' },
  QUEUED:    { label: 'Queued',    color: 'var(--blue)',        bg: 'rgba(88,166,255,0.1)' },
  SUBMITTED: { label: 'Submitted', color: '#c9d1d9',            bg: 'rgba(201,209,217,0.1)' },
  CRAWLED:   { label: 'Crawled',   color: 'var(--yellow)',      bg: 'rgba(227,179,65,0.1)' },
  INDEXED:   { label: 'Indexed',   color: 'var(--green)',       bg: 'var(--green-glow)' },
  FAILED:    { label: 'Failed',    color: 'var(--red)',         bg: 'rgba(248,81,73,0.1)' },
  SKIPPED:   { label: 'Skipped',   color: 'var(--text-dim)',    bg: 'var(--bg-elevated)' },
}

const METHOD_LABELS: Record<string, string> = {
  GOOGLE_API:     'Google API',
  INDEXNOW:       'IndexNow',
  SITEMAP_PING:   'Sitemap Ping',
  FETCH_AS_GOOGLE:'Fetch as Google',
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.PENDING
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 500,
      color: meta.color, background: meta.bg,
    }}>
      {meta.label}
    </span>
  )
}

const STATUSES = ['', 'PENDING', 'QUEUED', 'SUBMITTED', 'CRAWLED', 'INDEXED', 'FAILED', 'SKIPPED']

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/urls?${params}`)
    const data = await res.json()
    if (data.success) {
      setSubmissions(data.data.submissions)
      setPagination(data.data.pagination)
    }
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  function handleStatusFilter(s: string) {
    setStatusFilter(s)
    setPage(1)
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Submissions</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {pagination ? `${pagination.total.toLocaleString()} total submissions` : 'Loading...'}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button
            key={s || 'all'}
            onClick={() => handleStatusFilter(s)}
            style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)',
              cursor: 'pointer', border: '1px solid',
              background: statusFilter === s ? (s ? STATUS_META[s]?.bg ?? 'var(--green-glow)' : 'var(--green-glow)') : 'transparent',
              color: statusFilter === s ? (s ? STATUS_META[s]?.color ?? 'var(--green)' : 'var(--green)') : 'var(--text-muted)',
              borderColor: statusFilter === s ? (s ? STATUS_META[s]?.color ?? 'var(--border-glow)' : 'var(--border-glow)') : 'var(--border)',
            }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : submissions.length === 0 ? (
          <div style={{ padding: '56px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <p>No submissions{statusFilter ? ` with status "${statusFilter}"` : ''} yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['URL', 'Status', 'Method', 'Source', 'Submitted', 'Indexed'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: 11, color: 'var(--text-dim)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <>
                  <tr
                    key={s.id}
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '11px 16px', maxWidth: 360 }}>
                      <div style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-mono)',
                      }}>
                        {s.url}
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <StatusBadge status={s.status} />
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {METHOD_LABELS[s.method] ?? s.method}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {s.source}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {s.indexedAt ? new Date(s.indexedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr key={`${s.id}-expanded`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                      <td colSpan={6} style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                            <div>
                              <span style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.08em' }}>ID</span>
                              <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{s.id}</div>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.08em' }}>Last Checked</span>
                              <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                                {s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString() : 'Not yet'}
                              </div>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.08em' }}>Credits Cost</span>
                              <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{s.creditsCost}</div>
                            </div>
                            {s.errorMessage && (
                              <div>
                                <span style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.08em' }}>Error</span>
                                <div style={{ color: 'var(--red)', marginTop: 2, maxWidth: 500 }}>{s.errorMessage}</div>
                              </div>
                            )}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <a href={s.url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 12, color: 'var(--green)' }}
                              onClick={e => e.stopPropagation()}>
                              Open URL ↗
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px 14px', fontSize: 12 }}
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Page {page} of {pagination.pages}
          </span>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px 14px', fontSize: 12 }}
            disabled={page >= pagination.pages}
            onClick={() => setPage(p => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
