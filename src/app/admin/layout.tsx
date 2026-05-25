'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <aside style={{
        width: 200, flexShrink: 0,
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
          <div style={{ fontSize: 10, color: 'var(--yellow)', marginTop: 6, letterSpacing: '0.1em' }}>ADMIN PANEL</div>
        </div>
        <nav style={{ padding: '12px' }}>
          {[
            { href: '/admin', label: 'Overview', icon: '◉' },
            { href: '/dashboard', label: '← Dashboard', icon: '' },
          ].map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6, marginBottom: 2,
                color: active ? 'var(--yellow)' : 'var(--text-muted)',
                background: active ? 'rgba(227,179,65,0.1)' : 'transparent',
                fontSize: 13, textDecoration: 'none',
                border: active ? '1px solid rgba(227,179,65,0.3)' : '1px solid transparent',
              }}>
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: '32px' }}>
        {children}
      </main>
    </div>
  )
}
