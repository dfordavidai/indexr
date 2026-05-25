'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  credits: number
  plan: string
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: '◉' },
  { href: '/dashboard/submit', label: 'Submit URLs', icon: '⊕' },
  { href: '/dashboard/submissions', label: 'Submissions', icon: '≡' },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: '⌗' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.success) {
          router.push('/auth/login')
        } else {
          setUser(d.data)
        }
      })
      .catch(() => router.push('/auth/login'))
  }, [router])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', textDecoration: 'none' }}>
            <div style={{ width: 26, height: 26, background: 'var(--green)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#000', fontSize: 11, fontWeight: 700 }}>IX</span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Indexr</span>
          </Link>
        </div>

        {/* Credits */}
        <div style={{ margin: '16px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Credits</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>
            {user.credits.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{user.plan} plan</div>
          {user.credits < 20 && (
            <Link href="/dashboard/settings" style={{ display: 'block', marginTop: 8, fontSize: 11, color: 'var(--yellow)' }}>
              ⚠ Running low — upgrade
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav style={{ padding: '4px 12px', flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 6, marginBottom: 2,
                  color: active ? 'var(--green)' : 'var(--text-muted)',
                  background: active ? 'var(--green-glow)' : 'transparent',
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  textDecoration: 'none', transition: 'all 0.15s',
                  border: active ? '1px solid var(--border-glow)' : '1px solid transparent',
                }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}

          {user.role === 'ADMIN' && (
            <Link href="/admin" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 6, marginTop: 8,
              color: 'var(--yellow)', fontSize: 13, textDecoration: 'none',
              border: '1px solid transparent',
            }}>
              <span>⚑</span> Admin Panel
            </Link>
          )}
        </nav>

        {/* User */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--green-glow)', border: '1px solid var(--border-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--green)', fontWeight: 700, fontSize: 13, flexShrink: 0,
            }}>
              {(user.name ?? user.email)[0].toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name ?? user.email}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </div>
            </div>
          </div>
          <button onClick={logout} style={{
            width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: 12, padding: '6px 10px', textAlign: 'left',
            borderRadius: 5, fontFamily: 'var(--font-mono)',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
            ⏻ Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, padding: '32px' }}>
        {children}
      </main>
    </div>
  )
}
