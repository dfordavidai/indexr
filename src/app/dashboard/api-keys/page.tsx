'use client'

import { useEffect, useState } from 'react'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  usageCount: number
  createdAt: string
}

interface NewKey {
  id: string
  name: string
  key: string
  keyPrefix: string
  createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newKey, setNewKey] = useState<NewKey | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  async function loadKeys() {
    const res = await fetch('/api/api-keys')
    const data = await res.json()
    if (data.success) setKeys(data.data)
    setLoading(false)
  }

  useEffect(() => { loadKeys() }, [])

  async function createKey() {
    if (!newKeyName.trim()) return
    setError('')
    setCreating(true)
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName.trim() }),
    })
    const data = await res.json()
    setCreating(false)
    if (!data.success) {
      setError(data.error ?? 'Failed to create key')
      return
    }
    setNewKey(data.data)
    setNewKeyName('')
    setShowForm(false)
    loadKeys()
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    setRevoking(id)
    const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      setKeys(prev => prev.filter(k => k.id !== id))
    }
    setRevoking(null)
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>API Keys</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Use API keys to submit URLs programmatically via the REST API.
          </p>
        </div>
        {!showForm && (
          <button
            className="btn btn-primary"
            style={{ padding: '9px 18px', fontSize: 13 }}
            onClick={() => { setShowForm(true); setNewKey(null) }}>
            + New Key
          </button>
        )}
      </div>

      {/* New key created banner */}
      {newKey && (
        <div style={{
          background: 'rgba(34,197,94,0.06)', border: '1px solid var(--border-glow)',
          borderRadius: 8, padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>
            ✓ API key created — copy it now, it won't be shown again
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '10px 14px',
          }}>
            <code style={{ flex: 1, fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
              {newKey.key}
            </code>
            <button
              className="btn btn-outline"
              style={{ padding: '5px 12px', fontSize: 12, flexShrink: 0 }}
              onClick={() => copyKey(newKey.key)}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, marginTop: 10, padding: 0 }}
            onClick={() => setNewKey(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Create New API Key</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="input"
              placeholder="Key name (e.g. Production, CI Pipeline)"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createKey()}
              style={{ flex: 1 }}
              autoFocus
            />
            <button
              className="btn btn-primary"
              style={{ padding: '10px 18px', fontSize: 13 }}
              disabled={creating || !newKeyName.trim()}
              onClick={createKey}>
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: '10px 14px', fontSize: 13 }}
              onClick={() => { setShowForm(false); setError('') }}>
              Cancel
            </button>
          </div>
          {error && (
            <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13 }}>{error}</div>
          )}
        </div>
      )}

      {/* Keys list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : keys.length === 0 ? (
          <div style={{ padding: '56px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⌗</div>
            <p style={{ marginBottom: 16 }}>No API keys yet.</p>
            <button
              className="btn btn-primary"
              style={{ padding: '9px 20px', fontSize: 13 }}
              onClick={() => setShowForm(true)}>
              Create your first key
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Key', 'Last Used', 'Requests', 'Created', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: 11, color: 'var(--text-dim)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500 }}>
                    {k.name}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <code style={{
                      fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                      background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4,
                    }}>
                      {k.keyPrefix}••••••••••••••••
                    </code>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {k.usageCount.toLocaleString()}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                      disabled={revoking === k.id}
                      onClick={() => revokeKey(k.id)}>
                      {revoking === k.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* API Docs */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>API Reference</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            {
              method: 'POST', path: '/api/urls',
              desc: 'Submit URLs for indexing',
              body: `{ "urls": ["https://example.com/page"], "method": "GOOGLE_API" }`,
            },
            {
              method: 'GET', path: '/api/urls',
              desc: 'List submissions with pagination',
              body: '?page=1&limit=20&status=INDEXED',
            },
            {
              method: 'GET', path: '/api/urls/stats',
              desc: 'Get credit and submission stats',
              body: null,
            },
          ].map((ep, i) => (
            <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: ep.method === 'POST' ? 'rgba(88,166,255,0.15)' : 'rgba(34,197,94,0.15)',
                  color: ep.method === 'POST' ? 'var(--blue)' : 'var(--green)',
                }}>{ep.method}</span>
                <code style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{ep.path}</code>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: ep.body ? 8 : 0 }}>{ep.desc}</div>
              {ep.body && (
                <code style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', display: 'block' }}>
                  {ep.body}
                </code>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
          Authenticate with header: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>X-API-Key: {'<your-key>'}</code>
        </div>
      </div>
    </div>
  )
}
