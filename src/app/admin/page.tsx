'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  users: { total: number; today: number; thisWeek: number; thisMonth: number }
  submissions: { total: number; today: number; thisWeek: number; thisMonth: number }
  indexing: {
    successRate: number; indexed: number; failed: number
    statusBreakdown: Record<string, number>
    methodBreakdown: Record<string, number>
  }
  credits: { consumedThisMonth: number }
  recentSubmissions: Array<{ id: string; url: string; status: string; method: string; createdAt: string; user: { email: string } }>
  recentUsers: Array<{ id: string; email: string; name: string | null; plan: { name: string } | null; createdAt: string }>
  dailySubmissions: Array<{ day: string; count: number }>
}

interface User {
  id: string; email: string; name: string | null; role: string
  credits: number; plan: string; planSlug: string; planId: string | null
  submissionsCount: number; stripeCustomerId: string | null; telegramChatId: string | null
  createdAt: string
}

interface QueueJob {
  id: string; url: string; status: string; method: string; errorMessage: string | null
  createdAt: string; updatedAt: string; user: { email: string }; userId: string
}

interface EngineConfig {
  indexingMode: 'instant' | 'normal'
  enabledMethods: Record<string, boolean>
  rateLimits: Record<string, number>
  defaultMethodByPlan: Record<string, string>
  retryAttempts: number
  retryDelaySeconds: number
  creditCostPerUrl: number
  blacklistedDomains: string[]
  instantModeMaxUrls: number
}

interface Plan {
  id: string; name: string; slug: string; price: number
  creditsPerMonth: number; features: string[]; stripePriceId: string | null
  isActive: boolean; _count: { users: number }
}

interface DripCampaign {
  id: string; name: string; status: string; method: string
  urlsTotal: number; urlsSubmitted: number; urlsPerDay: number
  minDelayMin: number; maxDelayMin: number; smartDrip: boolean
  creditsReserved: number; nextRunAt: string | null; completedAt: string | null
  createdAt: string; user: { email: string; id: string }
}

interface GSAccount {
  id: string; label: string; clientEmail: string
  isActive: boolean; isHealthy: boolean
  dailyQuota: number; quotaUsed: number; quotaResetAt: string | null
  lastHealthCheck: string | null; lastUsedAt: string | null; priority: number; createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  INDEXED: 'var(--green)', CRAWLED: 'var(--yellow)', FAILED: 'var(--red)',
  QUEUED: 'var(--blue)', PENDING: 'var(--text-muted)', SUBMITTED: '#c9d1d9', SKIPPED: 'var(--text-dim)',
  ACTIVE: 'var(--green)', PAUSED: 'var(--yellow)', CANCELLED: 'var(--red)', COMPLETED: 'var(--blue)',
}
const METHOD_COLOR: Record<string, string> = {
  GOOGLE_API: 'var(--blue)', INDEXNOW: 'var(--green)', SITEMAP_PING: 'var(--yellow)', FETCH_AS_GOOGLE: '#c9d1d9',
}

const TABS = ['overview', 'users', 'queue', 'engine', 'plans', 'submissions', 'drip', 'gsa'] as const
type Tab = typeof TABS[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '10px 14px', fontSize: 12, borderBottom: '1px solid var(--border)', ...style }}>{children}</td>
}

function truncateUrl(url: string, len = 55) {
  return url.length > len ? url.slice(0, len) + '…' : url
}

function fmt(n: number) { return n.toLocaleString() }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) }
function fmtDateTime(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', background: 'var(--green)', borderRadius: '2px 2px 0 0', opacity: 0.8, height: `${Math.round((d.count / max) * 40)}px`, minHeight: 2 }} title={`${d.day}: ${d.count}`} />
          <div style={{ fontSize: 9, color: 'var(--text-dim)', transform: 'rotate(-45deg)', transformOrigin: 'top', whiteSpace: 'nowrap' }}>
            {new Date(d.day).toLocaleDateString('en', { month: 'numeric', day: 'numeric' })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function AdminPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'overview')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Data states
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [userPages, setUserPages] = useState(1)
  const [userPage, setUserPage] = useState(1)
  const [userSearch, setUserSearch] = useState('')
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([])
  const [queueCounts, setQueueCounts] = useState({ pending: 0, queued: 0, failed: 0, processing: 0 })
  const [queueFilter, setQueueFilter] = useState('all')
  const [queuePage, setQueuePage] = useState(1)
  const [queuePages, setQueuePages] = useState(1)
  const [engine, setEngine] = useState<EngineConfig | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [submissions, setSubmissions] = useState<QueueJob[]>([])
  const [subPage, setSubPage] = useState(1)
  const [subPages, setSubPages] = useState(1)
  const [subFilter, setSubFilter] = useState('all')
  const [subSearch, setSubSearch] = useState('')

  // Modal states
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editCredits, setEditCredits] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPlanId, setEditPlanId] = useState('')
  const [creditDelta, setCreditDelta] = useState('')
  const [saving, setSaving] = useState(false)
  const [bulkCredits, setBulkCredits] = useState('')
  const [bulkPlan, setBulkPlan] = useState('')
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [newPlan, setNewPlan] = useState(false)
  const [planForm, setPlanForm] = useState({ name: '', slug: '', price: '', creditsPerMonth: '', features: '', stripePriceId: '' })
  const [blacklistInput, setBlacklistInput] = useState('')
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())

  // Drip state
  const [dripCampaigns, setDripCampaigns] = useState<DripCampaign[]>([])
  const [dripCounts, setDripCounts] = useState({ active: 0, paused: 0, completed: 0, cancelled: 0 })
  const [dripFilter, setDripFilter] = useState('all')
  const [dripPage, setDripPage] = useState(1)
  const [dripPages, setDripPages] = useState(1)

  // GSA state
  const [gsAccounts, setGsAccounts] = useState<GSAccount[]>([])
  const [nextQuotaReset, setNextQuotaReset] = useState<string | null>(null)
  const [showAddGSA, setShowAddGSA] = useState(false)
  const [gsaForm, setGsaForm] = useState({ label: '', credentialsJson: '', dailyQuota: 200, priority: 0 })
  const [gsaSaving, setGsaSaving] = useState(false)
  const [gsaHealthChecking, setGsaHealthChecking] = useState<string | null>(null)

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load Stats ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => {
        if (!d.success) router.push('/dashboard')
        else { setStats(d.data); setLoading(false) }
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  // ── Load Users ──────────────────────────────────────────────────────────────
  const loadUsers = useCallback(() => {
    const p = new URLSearchParams({ page: String(userPage) })
    if (userSearch) p.set('search', userSearch)
    fetch(`/api/admin/users?${p}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setUsers(d.data.users); setUserPages(d.data.pagination.pages) } })
  }, [userPage, userSearch])

  useEffect(() => { if (tab === 'users') loadUsers() }, [tab, loadUsers])

  // ── Load Queue ──────────────────────────────────────────────────────────────
  const loadQueue = useCallback(() => {
    const p = new URLSearchParams({ page: String(queuePage) })
    if (queueFilter !== 'all') p.set('status', queueFilter)
    fetch(`/api/admin/queue?${p}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setQueueJobs(d.data.jobs); setQueueCounts(d.data.counts); setQueuePages(d.data.pagination.pages) } })
  }, [queuePage, queueFilter])

  useEffect(() => { if (tab === 'queue') loadQueue() }, [tab, loadQueue])

  // ── Load Engine ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'engine') {
      fetch('/api/admin/engine').then(r => r.json()).then(d => { if (d.success) setEngine(d.data) })
    }
  }, [tab])

  // ── Load Plans ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'plans') {
      fetch('/api/admin/plans').then(r => r.json()).then(d => { if (d.success) setPlans(d.data) })
    }
  }, [tab])

  // ── Load Submissions ────────────────────────────────────────────────────────
  const loadSubmissions = useCallback(() => {
    const p = new URLSearchParams({ page: String(subPage) })
    if (subFilter !== 'all') p.set('status', subFilter)
    if (subSearch) p.set('search', subSearch)
    fetch(`/api/admin/submissions?${p}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setSubmissions(d.data.submissions); setSubPages(d.data.pagination.pages) } })
  }, [subPage, subFilter, subSearch])

  useEffect(() => { if (tab === 'submissions') loadSubmissions() }, [tab, loadSubmissions])

  // ── Load Drip ─────────────────────────────────────────────────────────────────
  const loadDrip = useCallback(() => {
    const p = new URLSearchParams({ page: String(dripPage) })
    if (dripFilter !== 'all') p.set('status', dripFilter)
    fetch('/api/admin/drip?' + p)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setDripCampaigns(d.data.campaigns)
          setDripCounts(d.data.counts)
          setDripPages(d.data.pagination.pages)
        }
      })
  }, [dripPage, dripFilter])
  useEffect(() => { if (tab === 'drip') loadDrip() }, [tab, loadDrip])

  // ── Load GSA ──────────────────────────────────────────────────────────────────
  const loadGSA = useCallback(() => {
    fetch('/api/admin/gsa')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setGsAccounts(d.data.accounts)
          setNextQuotaReset(d.data.nextQuotaReset)
        }
      })
  }, [])
  useEffect(() => { if (tab === 'gsa') loadGSA() }, [tab, loadGSA])

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function saveUserEdit() {
    if (!editUser) return
    setSaving(true)
    const body: Record<string, unknown> = { userId: editUser.id }
    if (editCredits !== '') body.credits = parseInt(editCredits)
    if (editRole) body.role = editRole
    if (editPlanId) body.planId = editPlanId
    const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, credits: data.data.credits, role: data.data.role } : u))
      setEditUser(null)
      notify('User updated')
    } else notify(data.error ?? 'Error', false)
  }

  async function grantCreditsDelta() {
    if (!editUser || !creditDelta) return
    setSaving(true)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editUser.id, creditDelta: parseInt(creditDelta) }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) { loadUsers(); setEditUser(null); notify(`Credits adjusted by ${creditDelta}`) }
    else notify(data.error ?? 'Error', false)
  }

  async function bulkGrantCredits() {
    const amount = parseInt(bulkCredits)
    if (!amount) return
    setSaving(true)
    const body: Record<string, unknown> = { amount, reason: 'bulk_admin_grant' }
    if (bulkPlan) body.planSlug = bulkPlan
    else body.grantAll = true
    const res = await fetch('/api/admin/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setSaving(false)
    if (data.success) notify(`Granted ${amount} credits to ${data.data.granted} users`)
    else notify(data.error ?? 'Error', false)
  }

  async function retryJobs(all = false) {
    const body = all ? { retryAll: true } : { submissionIds: Array.from(selectedJobs) }
    const res = await fetch('/api/admin/queue/retry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (data.success) { notify(`Retrying ${data.data.retried} jobs`); setSelectedJobs(new Set()); loadQueue() }
    else notify(data.error ?? 'Error', false)
  }

  async function saveEngine(updates: Partial<EngineConfig>) {
    const res = await fetch('/api/admin/engine', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
    const data = await res.json()
    if (data.success) { setEngine(data.data); notify('Engine config saved') }
    else notify(data.error ?? 'Error', false)
  }

  async function savePlan() {
    setSaving(true)
    const body = {
      ...(editPlan ? { id: editPlan.id } : {}),
      name: planForm.name,
      slug: planForm.slug,
      price: parseInt(planForm.price) * 100,
      creditsPerMonth: parseInt(planForm.creditsPerMonth),
      features: planForm.features.split('\n').map(f => f.trim()).filter(Boolean),
      stripePriceId: planForm.stripePriceId || undefined,
    }
    const res = await fetch('/api/admin/plans', {
      method: editPlan ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      notify(editPlan ? 'Plan updated' : 'Plan created')
      setEditPlan(null); setNewPlan(false)
      fetch('/api/admin/plans').then(r => r.json()).then(d => { if (d.success) setPlans(d.data) })
    } else notify(data.error ?? 'Error', false)
  }

  async function togglePlan(id: string, isActive: boolean) {
    const res = await fetch('/api/admin/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isActive: !isActive }) })
    const data = await res.json()
    if (data.success) { notify(`Plan ${!isActive ? 'enabled' : 'disabled'}`); setPlans(p => p.map(pl => pl.id === id ? { ...pl, isActive: !isActive } : pl)) }
    else notify(data.error ?? 'Error', false)
  }

  async function forceSubmissionStatus(submissionId: string, status: string) {
    const res = await fetch('/api/admin/submissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId, status }) })
    const data = await res.json()
    if (data.success) { notify(`Status → ${status}`); loadSubmissions() }
    else notify(data.error ?? 'Error', false)
  }

  async function updateDrip(campaignId: string, updates: Record<string, unknown>) {
    const res = await fetch('/api/admin/drip', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId, ...updates }) })
    const data = await res.json()
    if (data.success) { notify('Campaign updated'); loadDrip() }
    else notify(data.error ?? 'Error', false)
  }

  async function addGSA() {
    setGsaSaving(true)
    const res = await fetch('/api/admin/gsa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gsaForm) })
    const data = await res.json()
    setGsaSaving(false)
    if (data.success) {
      notify('Account "' + gsaForm.label + '" added · Health: ' + (data.data.isHealthy ? '✓' : '✗'))
      setShowAddGSA(false)
      setGsaForm({ label: '', credentialsJson: '', dailyQuota: 200, priority: 0 })
      loadGSA()
    } else notify(data.error ?? 'Error', false)
  }

  async function updateGSA(id: string, updates: Record<string, unknown>) {
    const res = await fetch('/api/admin/gsa', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) })
    const data = await res.json()
    if (data.success) {
      setGsAccounts(prev => prev.map(a => a.id === id ? { ...a, ...data.data } : a))
      notify('Account updated')
    } else notify(data.error ?? 'Error', false)
  }

  async function runHealthCheck(id: string) {
    setGsaHealthChecking(id)
    await updateGSA(id, { runHealthCheck: true })
    setGsaHealthChecking(null)
  }

  async function deleteGSA(id: string, label: string) {
    if (!confirm('Delete account "' + label + '"? This cannot be undone.')) return
    const res = await fetch('/api/admin/gsa?id=' + id, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) { notify('Account deleted'); loadGSA() }
    else notify(data.error ?? 'Error', false)
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading admin panel...</div>

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? 'var(--green)' : 'var(--red)',
          color: '#000', padding: '10px 18px', borderRadius: 8,
          fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)', transition: 'all 0.2s',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
            <span style={{ color: 'var(--yellow)' }}>⚑</span> Admin Panel
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Full control. Handle with care.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px' }}>
            {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-mono)',
            color: tab === t ? 'var(--yellow)' : 'var(--text-muted)',
            borderBottom: tab === t ? '2px solid var(--yellow)' : '2px solid transparent',
            marginBottom: -1, textTransform: 'capitalize', transition: 'color 0.12s',
          }}>
            {t === 'drip' ? '⏱ drip' : t === 'gsa' ? '🔑 gsa' : t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────────────── */}
      {tab === 'overview' && stats && (
        <div>
          {/* Big stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatCard label="Total Users" value={fmt(stats.users.total)} sub={`+${stats.users.today} today`} color="var(--text)" />
            <StatCard label="New This Week" value={fmt(stats.users.thisWeek)} sub={`${fmt(stats.users.thisMonth)} this month`} color="var(--green)" />
            <StatCard label="Total Submissions" value={fmt(stats.submissions.total)} sub={`+${stats.submissions.today} today`} color="var(--text)" />
            <StatCard label="This Week" value={fmt(stats.submissions.thisWeek)} sub={`${fmt(stats.submissions.thisMonth)} this month`} color="var(--blue)" />
            <StatCard label="Success Rate" value={`${stats.indexing.successRate}%`} sub={`${fmt(stats.indexing.indexed)} indexed`} color={stats.indexing.successRate > 70 ? 'var(--green)' : 'var(--yellow)'} />
            <StatCard label="Failed Jobs" value={fmt(stats.indexing.failed)} sub="all time" color={stats.indexing.failed > 100 ? 'var(--red)' : 'var(--text-muted)'} />
            <StatCard label="Credits Used" value={fmt(stats.credits.consumedThisMonth)} sub="this month" color="var(--yellow)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Status breakdown */}
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 13 }}>Status Breakdown</div>
              {Object.entries(stats.indexing.statusBreakdown).sort((a, b) => b[1] - a[1]).map(([s, c]) => {
                const total = Object.values(stats.indexing.statusBreakdown).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? Math.round((c / total) * 100) : 0
                return (
                  <div key={s} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: STATUS_COLOR[s] }}>{s}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fmt(c)} ({pct}%)</span>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: 3, height: 4 }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: STATUS_COLOR[s] ?? 'var(--text-dim)', transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Method breakdown + chart */}
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 13 }}>Method Usage</div>
              {Object.entries(stats.indexing.methodBreakdown).map(([m, c]) => (
                <div key={m} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Badge label={m} color={METHOD_COLOR[m]} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(c)}</span>
                </div>
              ))}
              {stats.dailySubmissions.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Last 7 Days</div>
                  <MiniBarChart data={stats.dailySubmissions} />
                </div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>Recent Submissions</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>User</Th><Th>URL</Th><Th>Method</Th><Th>Status</Th><Th>Date</Th></tr></thead>
                <tbody>
                  {stats.recentSubmissions.map(s => (
                    <tr key={s.id}>
                      <Td style={{ color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user.email}</Td>
                      <Td style={{ maxWidth: 260 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{truncateUrl(s.url)}</div></Td>
                      <Td><Badge label={s.method} color={METHOD_COLOR[s.method]} /></Td>
                      <Td><Badge label={s.status} color={STATUS_COLOR[s.status]} /></Td>
                      <Td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{fmtDate(s.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>New Users</div>
              {stats.recentUsers.map(u => (
                <div key={u.id} style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12 }}>{u.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{u.plan?.name ?? 'Free'} · {fmtDate(u.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── USERS ─────────────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div>
          {/* Bulk grants */}
          <div className="card" style={{ marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>BULK CREDIT GRANT</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" style={{ width: 100 }} placeholder="Amount" value={bulkCredits} onChange={e => setBulkCredits(e.target.value)} type="number" min={1} />
                <input className="input" style={{ width: 120 }} placeholder="Plan slug (opt)" value={bulkPlan} onChange={e => setBulkPlan(e.target.value)} />
                <button className="btn btn-outline" style={{ padding: '8px 16px', fontSize: 12 }} disabled={saving} onClick={bulkGrantCredits}>
                  {saving ? '...' : 'Grant All'}
                </button>
              </div>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: 14, display: 'flex', gap: 10 }}>
            <input className="input" placeholder="Search email or name..." value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(1) }} style={{ maxWidth: 300 }} />
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Email</Th><Th>Plan</Th><Th>Credits</Th><Th>Submissions</Th><Th>Role</Th><Th>Joined</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <Td>
                      <div style={{ fontSize: 12 }}>{u.email}</div>
                      {u.name && <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{u.name}</div>}
                    </Td>
                    <Td><Badge label={u.plan} color={u.planSlug === 'pro' ? 'var(--yellow)' : u.planSlug === 'enterprise' ? 'var(--blue)' : undefined} /></Td>
                    <Td style={{ color: 'var(--green)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>{fmt(u.credits)}</Td>
                    <Td style={{ color: 'var(--text-muted)' }}>{fmt(u.submissionsCount)}</Td>
                    <Td><Badge label={u.role} color={u.role === 'ADMIN' ? 'var(--yellow)' : undefined} /></Td>
                    <Td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{fmtDate(u.createdAt)}</Td>
                    <Td>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => { setEditUser(u); setEditCredits(String(u.credits)); setEditRole(u.role); setEditPlanId(u.planId ?? ''); setCreditDelta('') }}>
                        Edit
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {userPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '36px' }}>{userPage} / {userPages}</span>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} disabled={userPage >= userPages} onClick={() => setUserPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ── QUEUE ─────────────────────────────────────────────────────────────── */}
      {tab === 'queue' && (
        <div>
          {/* Queue health cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
            <StatCard label="Pending" value={fmt(queueCounts.pending)} color="var(--text-muted)" />
            <StatCard label="Queued" value={fmt(queueCounts.queued)} color="var(--blue)" />
            <StatCard label="Processing" value={fmt(queueCounts.processing)} color="var(--yellow)" />
            <StatCard label="Failed" value={fmt(queueCounts.failed)} color={queueCounts.failed > 0 ? 'var(--red)' : 'var(--green)'} />
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['all', 'PENDING', 'QUEUED', 'FAILED', 'SUBMITTED', 'INDEXED'].map(f => (
                <button key={f} className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, background: queueFilter === f ? 'rgba(34,197,94,0.1)' : undefined, color: queueFilter === f ? 'var(--green)' : undefined }} onClick={() => { setQueueFilter(f); setQueuePage(1) }}>{f}</button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            {selectedJobs.size > 0 && (
              <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => retryJobs(false)}>
                Retry Selected ({selectedJobs.size})
              </button>
            )}
            {queueCounts.failed > 0 && (
              <button className="btn" style={{ padding: '6px 14px', fontSize: 12, background: 'var(--red)', color: '#fff' }} onClick={() => retryJobs(true)}>
                Retry All Failed ({fmt(queueCounts.failed)})
              </button>
            )}
            <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={loadQueue}>↺ Refresh</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th><input type="checkbox" onChange={e => {
                    if (e.target.checked) setSelectedJobs(new Set(queueJobs.map(j => j.id)))
                    else setSelectedJobs(new Set())
                  }} /></Th>
                  <Th>User</Th><Th>URL</Th><Th>Method</Th><Th>Status</Th><Th>Error</Th><Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {queueJobs.map(j => (
                  <tr key={j.id} style={{ background: selectedJobs.has(j.id) ? 'rgba(34,197,94,0.04)' : undefined }}>
                    <Td><input type="checkbox" checked={selectedJobs.has(j.id)} onChange={e => {
                      const n = new Set(selectedJobs)
                      if (e.target.checked) n.add(j.id); else n.delete(j.id)
                      setSelectedJobs(n)
                    }} /></Td>
                    <Td style={{ color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.user.email}</Td>
                    <Td style={{ maxWidth: 280 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 11 }}>{j.url}</div></Td>
                    <Td><Badge label={j.method} color={METHOD_COLOR[j.method]} /></Td>
                    <Td><Badge label={j.status} color={STATUS_COLOR[j.status]} /></Td>
                    <Td style={{ maxWidth: 200, color: 'var(--red)', fontSize: 11 }}>{j.errorMessage ? <span title={j.errorMessage}>{j.errorMessage.slice(0, 40)}{j.errorMessage.length > 40 ? '…' : ''}</span> : <span style={{ color: 'var(--text-dim)' }}>—</span>}</Td>
                    <Td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{fmtDate(j.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {queuePages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} disabled={queuePage <= 1} onClick={() => setQueuePage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '36px' }}>{queuePage} / {queuePages}</span>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} disabled={queuePage >= queuePages} onClick={() => setQueuePage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ── ENGINE ─────────────────────────────────────────────────────────────── */}
      {tab === 'engine' && engine && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

          {/* Indexing Mode */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 13, color: 'var(--yellow)' }}>⚡ Indexing Mode</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {(['instant', 'normal'] as const).map(m => (
                <button key={m} onClick={() => saveEngine({ indexingMode: m })} style={{
                  flex: 1, padding: '14px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                  fontSize: 13, fontWeight: 600, border: engine.indexingMode === m ? '2px solid var(--green)' : '2px solid var(--border)',
                  background: engine.indexingMode === m ? 'var(--green-glow)' : 'var(--bg-elevated)',
                  color: engine.indexingMode === m ? 'var(--green)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}>
                  {m === 'instant' ? '⚡ INSTANT' : '⏱ NORMAL'}
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 4, color: engine.indexingMode === m ? 'var(--green)' : 'var(--text-dim)' }}>
                    {m === 'instant' ? 'Process immediately' : 'Queue via Bull'}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--yellow)' }}>Instant mode:</strong> URLs are processed synchronously — faster feedback, higher server load.<br />
              <strong style={{ color: 'var(--blue)' }}>Normal mode:</strong> URLs go into Bull queue — scalable, fault-tolerant, async.
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Max URLs per request (Instant mode)</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input className="input" type="number" min={1} max={500} style={{ width: 100 }} defaultValue={engine.instantModeMaxUrls}
                  onBlur={e => saveEngine({ instantModeMaxUrls: parseInt(e.target.value) })} />
              </div>
            </div>
          </div>

          {/* Method toggles */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 13, color: 'var(--yellow)' }}>🔌 Indexing Methods</div>
            {Object.entries(engine.enabledMethods).map(([method, enabled]) => (
              <div key={method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: `1px solid ${enabled ? 'var(--border-glow)' : 'var(--border)'}` }}>
                <div>
                  <Badge label={method} color={METHOD_COLOR[method]} />
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Daily limit: {fmt(engine.rateLimits[method] ?? 0)}</div>
                </div>
                <button onClick={() => saveEngine({ enabledMethods: { ...engine.enabledMethods, [method]: !enabled } })} style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  background: enabled ? 'var(--green)' : 'var(--bg-card)', color: enabled ? '#000' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}>{enabled ? 'ON' : 'OFF'}</button>
              </div>
            ))}
          </div>

          {/* Rate limits */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 13, color: 'var(--yellow)' }}>📊 Rate Limits (per day)</div>
            {Object.entries(engine.rateLimits).map(([method, limit]) => (
              <div key={method} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Badge label={method} color={METHOD_COLOR[method]} />
                <input className="input" type="number" min={1} style={{ width: 120 }} defaultValue={limit}
                  onBlur={e => saveEngine({ rateLimits: { ...engine.rateLimits, [method]: parseInt(e.target.value) } })} />
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>req/day</span>
              </div>
            ))}
          </div>

          {/* Default method by plan */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 13, color: 'var(--yellow)' }}>🎯 Default Method by Plan</div>
            {Object.entries(engine.defaultMethodByPlan).map(([plan, method]) => (
              <div key={plan} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 90, textTransform: 'capitalize' }}>{plan}</span>
                <select className="input" style={{ flex: 1 }} value={method}
                  onChange={e => saveEngine({ defaultMethodByPlan: { ...engine.defaultMethodByPlan, [plan]: e.target.value } })}>
                  {Object.keys(engine.enabledMethods).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Retry settings */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 13, color: 'var(--yellow)' }}>🔁 Retry Settings</div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <label className="label">Retry Attempts</label>
                <input className="input" type="number" min={1} max={10} defaultValue={engine.retryAttempts}
                  onBlur={e => saveEngine({ retryAttempts: parseInt(e.target.value) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Retry Delay (sec)</label>
                <input className="input" type="number" min={30} defaultValue={engine.retryDelaySeconds}
                  onBlur={e => saveEngine({ retryDelaySeconds: parseInt(e.target.value) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Credits/URL</label>
                <input className="input" type="number" min={1} defaultValue={engine.creditCostPerUrl}
                  onBlur={e => saveEngine({ creditCostPerUrl: parseInt(e.target.value) })} />
              </div>
            </div>
          </div>

          {/* Blacklist */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 13, color: 'var(--yellow)' }}>🚫 Domain Blacklist</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="input" placeholder="example.com" value={blacklistInput} onChange={e => setBlacklistInput(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-outline" style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => {
                if (!blacklistInput.trim()) return
                const updated = [...engine.blacklistedDomains, blacklistInput.trim()]
                saveEngine({ blacklistedDomains: updated })
                setBlacklistInput('')
              }}>Add</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {engine.blacklistedDomains.length === 0
                ? <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>No domains blacklisted</span>
                : engine.blacklistedDomains.map(d => (
                  <span key={d} style={{ fontSize: 12, padding: '3px 10px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 4, color: 'var(--red)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {d}
                    <button onClick={() => saveEngine({ blacklistedDomains: engine.blacklistedDomains.filter(x => x !== d) })} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 0, fontSize: 12 }}>×</button>
                  </span>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── PLANS ─────────────────────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => {
              setNewPlan(true); setEditPlan(null)
              setPlanForm({ name: '', slug: '', price: '', creditsPerMonth: '', features: '', stripePriceId: '' })
            }}>+ New Plan</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {plans.map(p => (
              <div key={p.id} className="card" style={{ borderColor: p.isActive ? 'var(--border)' : 'var(--border)', opacity: p.isActive ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{p.slug}</div>
                  </div>
                  <Badge label={p.isActive ? 'ACTIVE' : 'DISABLED'} color={p.isActive ? 'var(--green)' : 'var(--red)'} />
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-display)', marginBottom: 8 }}>
                  ${(p.price / 100).toFixed(0)}<span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 400 }}>/mo</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {fmt(p.creditsPerMonth)} credits/mo · {fmt(p._count.users)} users
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14 }}>
                  {p.features.slice(0, 3).map(f => <div key={f}>✓ {f}</div>)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11, padding: '6px 0', justifyContent: 'center' }}
                    onClick={() => {
                      setEditPlan(p); setNewPlan(false)
                      setPlanForm({ name: p.name, slug: p.slug, price: String(p.price / 100), creditsPerMonth: String(p.creditsPerMonth), features: p.features.join('\n'), stripePriceId: p.stripePriceId ?? '' })
                    }}>Edit</button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11, padding: '6px 0', justifyContent: 'center', color: p.isActive ? 'var(--red)' : 'var(--green)' }}
                    onClick={() => togglePlan(p.id, p.isActive)}>{p.isActive ? 'Disable' : 'Enable'}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SUBMISSIONS ──────────────────────────────────────────────────────── */}
      {tab === 'submissions' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input className="input" placeholder="Search URL..." value={subSearch} onChange={e => { setSubSearch(e.target.value); setSubPage(1) }} style={{ maxWidth: 280 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {['all', 'PENDING', 'QUEUED', 'FAILED', 'INDEXED', 'CRAWLED', 'SUBMITTED'].map(f => (
                <button key={f} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11, background: subFilter === f ? 'rgba(34,197,94,0.1)' : undefined, color: subFilter === f ? 'var(--green)' : undefined }} onClick={() => { setSubFilter(f); setSubPage(1) }}>{f}</button>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }} onClick={loadSubmissions}>↺</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>User</Th><Th>URL</Th><Th>Method</Th><Th>Status</Th><Th>Error</Th><Th>Date</Th><Th>Force Status</Th></tr></thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id}>
                    <Td style={{ color: 'var(--text-muted)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user.email}</Td>
                    <Td style={{ maxWidth: 260 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-muted)' }}>{s.url}</div></Td>
                    <Td><Badge label={s.method} color={METHOD_COLOR[s.method]} /></Td>
                    <Td><Badge label={s.status} color={STATUS_COLOR[s.status]} /></Td>
                    <Td style={{ color: 'var(--red)', fontSize: 11, maxWidth: 160 }}>{s.errorMessage ? <span title={s.errorMessage}>{s.errorMessage.slice(0, 35)}{s.errorMessage.length > 35 ? '…' : ''}</span> : <span style={{ color: 'var(--text-dim)' }}>—</span>}</Td>
                    <Td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{fmtDate(s.createdAt)}</Td>
                    <Td>
                      <select className="input" style={{ fontSize: 11, padding: '3px 6px', cursor: 'pointer' }} value={s.status}
                        onChange={e => forceSubmissionStatus(s.id, e.target.value)}>
                        {['PENDING', 'QUEUED', 'SUBMITTED', 'CRAWLED', 'INDEXED', 'FAILED', 'SKIPPED'].map(st => <option key={st}>{st}</option>)}
                      </select>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {subPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} disabled={subPage <= 1} onClick={() => setSubPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '36px' }}>{subPage} / {subPages}</span>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} disabled={subPage >= subPages} onClick={() => setSubPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}


      {/* ── DRIP ADMIN ────────────────────────────────────────────────────────── */}
      {tab === 'drip' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
            <StatCard label="Active" value={fmt(dripCounts.active)} color="var(--green)" />
            <StatCard label="Paused" value={fmt(dripCounts.paused)} color="var(--yellow)" />
            <StatCard label="Completed" value={fmt(dripCounts.completed)} color="var(--blue)" />
            <StatCard label="Cancelled" value={fmt(dripCounts.cancelled)} color="var(--text-dim)" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['all', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'].map(f => (
              <button key={f} className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, background: dripFilter === f ? 'rgba(34,197,94,0.1)' : undefined, color: dripFilter === f ? 'var(--green)' : undefined }} onClick={() => { setDripFilter(f); setDripPage(1) }}>{f}</button>
            ))}
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} onClick={loadDrip}>↺</button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>User</Th><Th>Campaign</Th><Th>Progress</Th><Th>Method</Th><Th>Pace</Th><Th>Status</Th><Th>Next Run</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {dripCampaigns.map(c => {
                  const pct = c.urlsTotal > 0 ? Math.round((c.urlsSubmitted / c.urlsTotal) * 100) : 0
                  return (
                    <tr key={c.id}>
                      <Td style={{ color: 'var(--text-muted)', fontSize: 11, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.user.email}</Td>
                      <Td style={{ maxWidth: 180 }}>
                        <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{c.urlsSubmitted}/{c.urlsTotal} URLs · {pct}%</div>
                      </Td>
                      <Td style={{ minWidth: 100 }}>
                        <div style={{ background: 'var(--bg-elevated)', borderRadius: 3, height: 5, width: 100 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: STATUS_COLOR[c.status] ?? 'var(--green)', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                      </Td>
                      <Td><Badge label={c.method} color={METHOD_COLOR[c.method]} /></Td>
                      <Td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.urlsPerDay}/day · {c.minDelayMin}–{c.maxDelayMin}min</Td>
                      <Td><Badge label={c.status} color={STATUS_COLOR[c.status]} /></Td>
                      <Td style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{c.nextRunAt ? fmtDateTime(c.nextRunAt) : '—'}</Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {c.status === 'ACTIVE' && <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => updateDrip(c.id, { status: 'PAUSED' })}>⏸</button>}
                          {c.status === 'PAUSED' && <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => updateDrip(c.id, { status: 'ACTIVE' })}>▶</button>}
                          {(c.status === 'ACTIVE' || c.status === 'PAUSED') && (
                            <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 10, color: 'var(--red)' }} onClick={() => { if (confirm('Cancel and refund remaining credits?')) updateDrip(c.id, { status: 'CANCELLED' }) }}>✕</button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {dripPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} disabled={dripPage <= 1} onClick={() => setDripPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '36px' }}>{dripPage} / {dripPages}</span>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} disabled={dripPage >= dripPages} onClick={() => setDripPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ── GSA ADMIN ─────────────────────────────────────────────────────────── */}
      {tab === 'gsa' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {gsAccounts.length} account{gsAccounts.length !== 1 ? 's' : ''} in pool
              {nextQuotaReset && (
                <span style={{ marginLeft: 12, color: 'var(--text-dim)', fontSize: 11 }}>
                  Quota resets {new Date(nextQuotaReset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} PST
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }} onClick={loadGSA}>↺ Refresh</button>
              <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => setShowAddGSA(true)}>+ Add Account</button>
            </div>
          </div>

          {gsAccounts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔑</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>No service accounts in pool</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Add Google service account JSON credentials to enable multi-account quota management</div>
              <button className="btn btn-primary" onClick={() => setShowAddGSA(true)}>Add First Account</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {gsAccounts.map((a, idx) => (
                <div key={a.id} className="card" style={{ borderColor: !a.isActive ? 'var(--border)' : a.isHealthy ? (idx === 0 ? 'var(--border-glow)' : 'var(--border)') : 'rgba(248,81,73,0.3)', opacity: a.isActive ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        {idx === 0 && a.isActive && <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, padding: '1px 7px' }}>ACTIVE</span>}
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</span>
                        <Badge label={a.isHealthy ? '✓ Healthy' : '✗ Unhealthy'} color={a.isHealthy ? 'var(--green)' : 'var(--red)'} />
                        <Badge label={a.isActive ? 'Enabled' : 'Disabled'} color={a.isActive ? 'var(--blue)' : 'var(--text-dim)'} />
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Priority: {a.priority}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{a.clientEmail}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} disabled={gsaHealthChecking === a.id} onClick={() => runHealthCheck(a.id)}>
                        {gsaHealthChecking === a.id ? '...' : '🔍 Health Check'}
                      </button>
                      {idx !== 0 && a.isActive && (
                        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => updateGSA(a.id, { forceActive: true })}>↑ Force Primary</button>
                      )}
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => updateGSA(a.id, { resetQuota: true })}>↺ Reset Quota</button>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => updateGSA(a.id, { isActive: !a.isActive })}>{a.isActive ? 'Disable' : 'Enable'}</button>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11, color: 'var(--red)' }} onClick={() => deleteGSA(a.id, a.label)}>Delete</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Daily Quota</div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>
                          <span>{a.quotaUsed}/{a.dailyQuota}</span>
                          <span>{a.dailyQuota > 0 ? Math.round((a.quotaUsed / a.dailyQuota) * 100) : 0}%</span>
                        </div>
                        <div style={{ background: 'var(--bg-elevated)', borderRadius: 3, height: 5 }}>
                          <div style={{ width: `${a.dailyQuota > 0 ? Math.min(100, Math.round((a.quotaUsed / a.dailyQuota) * 100)) : 0}%`, height: '100%', background: a.quotaUsed / a.dailyQuota >= 0.9 ? 'var(--red)' : a.quotaUsed / a.dailyQuota >= 0.7 ? 'var(--yellow)' : 'var(--green)', borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11 }}>
                      <div style={{ color: 'var(--text-dim)', marginBottom: 2, fontSize: 10, textTransform: 'uppercase' }}>Quota Resets</div>
                      <div style={{ color: 'var(--text-muted)' }}>{a.quotaResetAt ? new Date(a.quotaResetAt).toLocaleString() : 'Unknown'}</div>
                    </div>
                    <div style={{ fontSize: 11 }}>
                      <div style={{ color: 'var(--text-dim)', marginBottom: 2, fontSize: 10, textTransform: 'uppercase' }}>Last Used</div>
                      <div style={{ color: 'var(--text-muted)' }}>{a.lastUsedAt ? fmtDateTime(a.lastUsedAt) : 'Never'}</div>
                    </div>
                    <div style={{ fontSize: 11 }}>
                      <div style={{ color: 'var(--text-dim)', marginBottom: 2, fontSize: 10, textTransform: 'uppercase' }}>Health Check</div>
                      <div style={{ color: 'var(--text-muted)' }}>{a.lastHealthCheck ? fmtDateTime(a.lastHealthCheck) : 'Never'}</div>
                    </div>
                    <div style={{ fontSize: 11 }}>
                      <div style={{ color: 'var(--text-dim)', marginBottom: 2, fontSize: 10, textTransform: 'uppercase' }}>Priority</div>
                      <input className="input" type="number" min={0} max={100} style={{ width: 70, padding: '4px 8px', fontSize: 11 }} defaultValue={a.priority}
                        onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== a.priority) updateGSA(a.id, { priority: v }) }} />
                    </div>
                    <div style={{ fontSize: 11 }}>
                      <div style={{ color: 'var(--text-dim)', marginBottom: 2, fontSize: 10, textTransform: 'uppercase' }}>Quota Limit</div>
                      <input className="input" type="number" min={1} max={10000} style={{ width: 80, padding: '4px 8px', fontSize: 11 }} defaultValue={a.dailyQuota}
                        onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== a.dailyQuota) updateGSA(a.id, { dailyQuota: v }) }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add GSA Modal */}
          {showAddGSA && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
              onClick={e => { if (e.target === e.currentTarget) setShowAddGSA(false) }}>
              <div className="card" style={{ width: '100%', maxWidth: 520 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Add Service Account</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Paste the full JSON key file from Google Cloud Console.</div>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <label className="label">Account Label</label>
                    <input className="input" placeholder="e.g. Primary, Backup 1, Client Account" value={gsaForm.label} onChange={e => setGsaForm(f => ({ ...f, label: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Service Account JSON</label>
                    <textarea className="input" rows={8} style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                      placeholder='{"type":"service_account","project_id":"...","client_email":"...@....iam.gserviceaccount.com","private_key":"-----BEGIN RSA PRIVATE KEY-----\n...",...}'
                      value={gsaForm.credentialsJson} onChange={e => setGsaForm(f => ({ ...f, credentialsJson: e.target.value }))} />
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Health check runs automatically on save.</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label className="label">Daily Quota</label>
                      <input className="input" type="number" min={1} max={10000} value={gsaForm.dailyQuota} onChange={e => setGsaForm(f => ({ ...f, dailyQuota: parseInt(e.target.value) || 200 }))} />
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Google default is 200/day</div>
                    </div>
                    <div>
                      <label className="label">Priority (0–100)</label>
                      <input className="input" type="number" min={0} max={100} value={gsaForm.priority} onChange={e => setGsaForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Higher = used first</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} disabled={gsaSaving || !gsaForm.label.trim() || !gsaForm.credentialsJson.trim()} onClick={addGSA}>
                      {gsaSaving ? 'Verifying & Saving...' : 'Add Account'}
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '10px 18px' }} onClick={() => setShowAddGSA(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EDIT USER MODAL ──────────────────────────────────────────────────── */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setEditUser(null) }}>
          <div className="card" style={{ width: '100%', maxWidth: 460, margin: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Edit User</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, fontFamily: 'var(--font-mono)' }}>{editUser.email}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label className="label">Set Credits</label>
                <input className="input" type="number" min={0} value={editCredits} onChange={e => setEditCredits(e.target.value)} />
              </div>
              <div>
                <label className="label">Add/Remove Credits</label>
                <input className="input" type="number" placeholder="+100 or -50" value={creditDelta} onChange={e => setCreditDelta(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <label className="label">Role</label>
                <select className="input" value={editRole} onChange={e => setEditRole(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <label className="label">Plan ID (opt)</label>
                <input className="input" placeholder="plan id" value={editPlanId} onChange={e => setEditPlanId(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {creditDelta && (
                <button className="btn btn-outline" style={{ padding: '9px 16px', fontSize: 12 }} disabled={saving} onClick={grantCreditsDelta}>
                  Apply Delta
                </button>
              )}
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} disabled={saving} onClick={saveUserEdit}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="btn btn-ghost" style={{ padding: '10px 16px' }} onClick={() => setEditUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PLAN EDIT MODAL ──────────────────────────────────────────────────── */}
      {(editPlan || newPlan) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) { setEditPlan(null); setNewPlan(false) } }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, margin: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>{newPlan ? 'Create Plan' : `Edit: ${editPlan?.name}`}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div><label className="label">Name</label><input className="input" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Slug</label><input className="input" value={planForm.slug} onChange={e => setPlanForm(f => ({ ...f, slug: e.target.value }))} placeholder="e.g. pro" /></div>
              <div><label className="label">Price (USD)</label><input className="input" type="number" min={0} value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))} placeholder="29" /></div>
              <div><label className="label">Credits/Month</label><input className="input" type="number" min={0} value={planForm.creditsPerMonth} onChange={e => setPlanForm(f => ({ ...f, creditsPerMonth: e.target.value }))} /></div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Features (one per line)</label>
              <textarea className="input" rows={4} style={{ resize: 'vertical' }} value={planForm.features} onChange={e => setPlanForm(f => ({ ...f, features: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="label">Stripe Price ID</label>
              <input className="input" value={planForm.stripePriceId} onChange={e => setPlanForm(f => ({ ...f, stripePriceId: e.target.value }))} placeholder="price_..." />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving} onClick={savePlan}>{saving ? 'Saving...' : editPlan ? 'Save' : 'Create Plan'}</button>
              <button className="btn btn-ghost" style={{ padding: '10px 16px' }} onClick={() => { setEditPlan(null); setNewPlan(false) }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>}>
      <AdminPageInner />
    </Suspense>
  )
}
