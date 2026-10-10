import React, { useState, useEffect } from 'react'
import { Terminal, Database, Server, Cpu, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

export default function App() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const checkHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setHealth(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header className="navbar">
        <div className="navbar-brand">
          <div className="brand-logo">C</div>
          <div>
            <span className="brand-text">Codara</span>
            <span className="brand-tagline">Discover. Understand. Code.</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="badge badge-primary">College AI Project</span>
          <button className="btn btn-secondary btn-sm" onClick={checkHealth} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Check Health
          </button>
        </div>
      </header>

      {/* Main Content Hero */}
      <main className="container" style={{ flex: 1, paddingTop: '3rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 3rem auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span className="badge badge-review">Phase 1: Project Skeleton</span>
          </div>
          <h1 style={{ marginBottom: '1rem' }}>
            Purpose-First Engineering & Bounded AI
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            Learn modern technologies through verified static documentation, interactive React Flow architectural diagrams, and deterministic Judge0 sandboxed exercises.
          </p>
        </div>

        {/* System Health Dashboard */}
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={18} color="var(--accent-primary)" />
            Subsystem Health Status
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Express Server */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Express Server</span>
                <Server size={20} color="var(--accent-primary)" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`status-dot ${health?.server === 'running' ? 'dot-green' : 'dot-red'}`}></span>
                <span style={{ fontWeight: 600 }}>{health?.server === 'running' ? 'Active (:5000)' : 'Unreachable'}</span>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                REST API & Zod Schemas
              </div>
            </div>

            {/* MongoDB */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>MongoDB Local</span>
                <Database size={20} color="var(--accent-emerald)" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`status-dot ${health?.mongo === 'connected' ? 'dot-green' : 'dot-red'}`}></span>
                <span style={{ fontWeight: 600 }}>{health?.mongo === 'connected' ? 'Connected (:27017)' : 'Disconnected'}</span>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Vector Chunks & AI Cache
              </div>
            </div>

            {/* Judge0 CE Sandbox */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Judge0 CE Sandbox</span>
                <Cpu size={20} color="var(--accent-cyan)" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`status-dot ${health?.judge0 === 'reachable' ? 'dot-green' : 'dot-amber'}`}></span>
                <span style={{ fontWeight: 600 }}>
                  {health?.judge0 === 'reachable' ? 'Running (:2358)' : 'Offline (Handled via Graceful Fallback)'}
                </span>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Dockerized Execution
              </div>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-md)', color: '#fca5a5' }}>
              <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Connection error: {error} (Ensure backend server is running on port 5000)
            </div>
          )}

          {health && (
            <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  API Proxy Link: <code>/api/health</code> &rarr; <code>http://localhost:5000/api/health</code>
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Timestamp: {new Date(health.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Codara &copy; 2026 &bull; Discover. Understand. Code. &bull; College Full-Stack + Bounded AI
      </footer>
    </div>
  )
}
