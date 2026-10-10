import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { Server, Database, Cpu, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

function MainApp() {
  const { user, isAuthenticated, loading } = useAuth();
  const [currentView, setCurrentView] = useState('catalog');
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (e) {
      console.error('Health check failed:', e);
    } finally {
      setHealthLoading(false);
    }
  };

  React.useEffect(() => {
    checkHealth();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading session...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar currentView={currentView} onNavigate={setCurrentView} />

      <main style={{ flex: 1 }}>
        {!isAuthenticated && currentView === 'login' && (
          <LoginPage
            onSwitchToRegister={() => setCurrentView('register')}
            onSuccess={() => setCurrentView('catalog')}
          />
        )}

        {!isAuthenticated && currentView === 'register' && (
          <RegisterPage
            onSwitchToLogin={() => setCurrentView('login')}
            onSuccess={() => setCurrentView('catalog')}
          />
        )}

        {/* Catalog or Authenticated Home / Skeleton View */}
        {(isAuthenticated || (currentView !== 'login' && currentView !== 'register')) && (
          <div className="container" style={{ paddingTop: '2.5rem' }}>
            <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 2.5rem auto' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className="badge badge-primary">Codara Engineering Hub</span>
                {isAuthenticated ? (
                  <span className="badge badge-runnable">Authenticated as {user?.name}</span>
                ) : (
                  <span className="badge badge-review">Guest Mode</span>
                )}
              </div>
              <h1 style={{ marginBottom: '1rem' }}>
                Discover. Understand. Code.
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
                A purpose-first engineering learning platform. Grounded static documentation, interactive React Flow architectural trade-offs, and sandboxed execution without chat hallucination.
              </p>

              {!isAuthenticated && (
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                  <button className="btn btn-primary" onClick={() => setCurrentView('login')}>
                    Sign In to Learn <ArrowRight size={16} />
                  </button>
                  <button className="btn btn-secondary" onClick={() => setCurrentView('register')}>
                    Create Account
                  </button>
                </div>
              )}
            </div>

            {/* Subsystem Health Status Card */}
            <div style={{ maxWidth: '850px', margin: '0 auto 3rem auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <Server size={18} color="var(--accent-primary)" />
                  Backend Architecture & Subsystems
                </h3>
                <button className="btn btn-secondary btn-sm" onClick={checkHealth} disabled={healthLoading}>
                  <RefreshCw size={12} className={healthLoading ? 'spin' : ''} />
                  Refresh
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Express Server & Auth</span>
                    <Server size={18} color="var(--accent-primary)" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`status-dot ${health?.server === 'running' ? 'dot-green' : 'dot-red'}`}></span>
                    <span style={{ fontWeight: 600 }}>{health?.server === 'running' ? 'Online (:5000)' : 'Unreachable'}</span>
                  </div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    JWT Stateless Bearer & Zod
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>MongoDB Local</span>
                    <Database size={18} color="var(--accent-emerald)" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`status-dot ${health?.mongo === 'connected' ? 'dot-green' : 'dot-red'}`}></span>
                    <span style={{ fontWeight: 600 }}>{health?.mongo === 'connected' ? 'Connected (:27017)' : 'Disconnected'}</span>
                  </div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Collections & Vector Chunks
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Judge0 CE Sandbox</span>
                    <Cpu size={18} color="var(--accent-cyan)" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`status-dot ${health?.judge0 === 'reachable' ? 'dot-green' : 'dot-amber'}`}></span>
                    <span style={{ fontWeight: 600 }}>
                      {health?.judge0 === 'reachable' ? 'Running (:2358)' : 'Offline (Graceful)'}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Isolated Code Execution
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Codara &copy; 2026 &bull; Discover. Understand. Code. &bull; College Full-Stack + Bounded AI
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
