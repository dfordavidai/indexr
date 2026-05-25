'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Stats {
  totalUsers: number
  newUsersThisMonth: number
  totalSubmissions: number
  submissionsToday: number
  statusBreakdown: Record<string, number>
  recentSubmissions: Array<{
    id: string
    url: string
    status: string
    createdAt: string
    user: { email: string }
  }>
}

interface User {
  id: string
  email: string
  name: string | null
  role: string
  credits: number
  plan: string
  submissionsCount: number
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  INDEXED: 'var(--green)',
  CRAWLED: 'var(--yellow)',
  FAILED: 'var(--red)',
  QUEUED: 'var(--blue)',
  PENDING: 'var(--text-muted)',
  SUBMITTED: '#c9d1d9',
  SKIPPED: 'var(--text-dim)',
}

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [tab, setTab] = useState<'overview' | 'users'>('overview')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editCredits, setEditCredits] = useState('')
  const [editRole, setEditRole] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => {
        if (!d.success) router.push('/dashboard')
        else setStats(d.data)
        setLoading(false)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  useEffect(() => {
    if (tab !== 'users') return
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('search', search)
    fetch(`/api/admin/users?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setUsers(d.data.users)
          setTotalPages(d.data.pagination.pages)
        }
      })
  }, [tab, page, search])

  async function saveUserEdit() {
    if (!editUser) return
    setSaving(true)
    const body: Record<string, unknown> = { userId: editUser.id }
    if (editCredits !== '') body.credits = parseInt(editCredits)
    if (editRole) body.role = editRole
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setUsers(prev => prev.map(u =>
        u.id === editUser.id
          ? { ...u, credits: data.data.credits, role: data.data.role }
          : u
      ))
      setEditUser(null)
    }
  }

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading admin panel...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
          <span style={{ color: 'var(--yellow)' }}>⚑</span> Admin Panel
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Platform overview and user management.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['overview', 'users'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 18px', fontSize: 13, fontFamily: 'var(--font-mono)',
              color: tab === t ? 'var(--green)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent',
              marginBottom: -1, textTransform: 'capitalize',
            }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total Users', value: stats.totalUsers.toLocaleString(), color: 'var(--text)' },
              { label: 'New This Month', value: stats.newUsersThisMonth.toLocaleString(), color: 'var(--green)' },
              { label: 'Total Submissions', value: stats.totalSubmissions.toLocaleString(), color: 'var(--text)' },
              { label: 'Submissions Today', value: stats.submissionsToday.toLocaleString(), color: 'var(--blue)' },
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

          {/* Status breakdown */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>Submission Status Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(stats.statusBreakdown).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                const total = Object.values(stats.statusBreakdown).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: STATUS_COLORS[status] ?? 'var(--text-muted)' }}>{status}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: 3, height: 5 }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', borderRadius: 3,
                        background: STATUS_COLORS[status] ?? 'var(--text-dim)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent submissions */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
              Recent Submissions (All Users)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['User', 'URL', 'Status', 'Date'].map(h => (
                    <th key={h} style={{
                      padding: '9px 16px', textAlign: 'left',
                      fontSize: 11, color: 'var(--text-dim)',
                      textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentSubmissions.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{s.user.email}</td>
                    <td style={{ padding: '10px 16px', maxWidth: 320 }}>
                      <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.url}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, color: STATUS_COLORS[s.status] ?? 'var(--text-muted)' }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <input
              className="input"
              placeholder="Search by email or name..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ maxWidth: 360 }}
            />
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Email', 'Plan', 'Credits', 'Submissions', 'Role', 'Joined', ''].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: 11, color: 'var(--text-dim)',
                      textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontSize: 13 }}>{u.email}</div>
                      {u.name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.name}</div>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{u.plan}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--green)', fontWeight: 600 }}>
                      {u.credits.toLocaleString()}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {u.submissionsCount.toLocaleString()}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: u.role === 'ADMIN' ? 'rgba(227,179,65,0.15)' : 'var(--bg-elevated)',
                        color: u.role === 'ADMIN' ? 'var(--yellow)' : 'var(--text-muted)',
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => { setEditUser(u); setEditCredits(String(u.credits)); setEditRole(u.role) }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }}
                disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '36px' }}>
                {page} / {totalPages}
              </span>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }}
                disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={e => { if (e.target === e.currentTarget) setEditUser(null) }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, margin: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Edit User</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{editUser.email}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label">Credits</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={editCredits}
                  onChange={e => setEditCredits(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  style={{ cursor: 'pointer' }}>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
                disabled={saving}
                onClick={saveUserEdit}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: '10px 16px' }}
                onClick={() => setEditUser(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
