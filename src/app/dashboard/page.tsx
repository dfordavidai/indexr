'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  totalSubmissions: number
  indexedCount: number
  pendingCount: number
  crawledCount: number
  failedCount: number
  creditsRemaining: number
  creditsUsedThisMonth: number
  planName: string
  planCreditsPerMonth: number
}

interface Submission {
  id: string
  url: string
  status: string
  createdAt: string
  indexedAt: string | null
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

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<Submission[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/urls/stats').then(r => r.json()),
      fetch('/api/urls?limit=8').then(r => r.json()),
    ]).then(([statsData, urlsData]) => {
      if (statsData.success) setStats(statsData.data)
      if (urlsData.success) setRecent(urlsData.data.submissions)
    })
  }, [])

  const indexRate = stats && stats.totalSubmissions > 0
    ? Math.round((stats.indexedCount / stats.totalSubmissions) * 100)
    : 0

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Overview</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Your indexing performance at a glance</p>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Credits Remaining', value: stats?.creditsRemaining?.toLocaleString() ?? '—', color: 'var(--green)' },
          { label: 'Total Submitted', value: stats?.totalSubmissions?.toLocaleString() ?? '—', color: 'var(--text)' },
          { label: 'Indexed', value: stats?.indexedCount?.toLocaleString() ?? '—', color: 'var(--green)' },
          { label: 'Pending / In Progress', value: stats?.pendingCount?.toLocaleString() ?? '—', color: 'var(--blue)' },
          { label: 'Failed', value: stats?.failedCount?.toLocaleString() ?? '—', color: 'var(--red)' },
          { label: 'Index Rate', value: `${indexRate}%`, color: indexRate > 80 ? 'var(--green)' : indexRate > 50 ? 'var(--yellow)' : 'var(--red)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Credits progress */}
      {stats && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Credits Usage This Month</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {stats.creditsUsedThisMonth} used of {stats.planCreditsPerMonth} ({stats.planName} plan)
              </div>
            </div>
            <Link href="/dashboard/settings" className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }}>
              Upgrade Plan
            </Link>
          </div>
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: 'var(--green)',
              width: `${Math.min(100, (stats.creditsUsedThisMonth / stats.planCreditsPerMonth) * 100)}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
        <Link href="/dashboard/submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '12px' }}>
          ⊕ Submit URLs
        </Link>
        <Link href="/dashboard/submissions" className="btn btn-ghost" style={{ justifyContent: 'center', padding: '12px' }}>
          ≡ View All Submissions
        </Link>
        <Link href="/dashboard/api-keys" className="btn btn-ghost" style={{ justifyContent: 'center', padding: '12px' }}>
          ⌗ Manage API Keys
        </Link>
      </div>

      {/* Recent submissions */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recent Submissions</h2>
          <Link href="/dashboard/submissions" style={{ fontSize: 12, color: 'var(--green)' }}>View all →</Link>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <p>No submissions yet.</p>
            <Link href="/dashboard/submit" style={{ color: 'var(--green)', display: 'block', marginTop: 8 }}>
              Submit your first URL →
            </Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['URL', 'Status', 'Submitted', 'Indexed'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 20px', maxWidth: 400 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text)' }}>
                      {s.url}
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {s.indexedAt ? new Date(s.indexedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
