'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin', label: 'Overview', icon: '◉' },
  { href: '/admin?tab=users', label: 'Users', icon: '⊞' },
  { href: '/admin?tab=queue', label: 'Queue', icon: '⟳' },
  { href: '/admin?tab=engine', label: 'Engine', icon: '⚙' },
  { href: '/admin?tab=plans', label: 'Plans', icon: '◈' },
  { href: '/admin?tab=submissions', label: 'Submissions', icon: '≡' },
  { href: '/dashboard', label: '← Dashboard', icon: '' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <aside style={{
        width: 210, flexShrink: 0,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', textDecoration: 'none' }}>
            <div style={{ width: 26, height: 26, background: 'var(--green)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#000', fontSize: 11, fontWeight: 700 }}>IX</span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Indexr</span>
          </Link>
          <div style={{ fontSize: 10, color: 'var(--yellow)', marginTop: 6, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--yellow)', display: 'inline-block' }} />
            ADMIN PANEL
          </div>
        </div>
        <nav style={{ padding: '12px', flex: 1 }}>
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href + item.label} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6, marginBottom: 2,
                color: active ? 'var(--yellow)' : 'var(--text-muted)',
                background: active ? 'rgba(227,179,65,0.1)' : 'transparent',
                fontSize: 13, textDecoration: 'none',
                border: active ? '1px solid rgba(227,179,65,0.3)' : '1px solid transparent',
                transition: 'all 0.12s',
              }}>
                {item.icon && <span style={{ fontSize: 14 }}>{item.icon}</span>}
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)' }}>
          God-tier Admin v2
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: '32px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
