import React, { useEffect, useState } from 'react';
import { ArrowRight, Code, Terminal, Database, CheckCircle, ShieldAlert } from 'lucide-react';

export default function CatalogPage({ onSelectTech }) {
  const [technologies, setTechnologies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCatalog() {
      try {
        const res = await fetch('/api/technologies');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTechnologies(data.technologies || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchCatalog();
  }, []);

  const getTechIcon = (slug) => {
    switch (slug) {
      case 'python':
        return <Code size={24} color="#38bdf8" />;
      case 'javascript':
        return <Terminal size={24} color="#facc15" />;
      case 'redis':
        return <Database size={24} color="#f87171" />;
      default:
        return <Code size={24} color="var(--accent-primary)" />;
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 3rem auto' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>
          Curated Technology Catalog
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
          Explore purpose-first mental models: what it is, why it was created, production usage, and architectural trade-offs.
        </p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading technology catalog...
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--accent-rose)' }}>
          Failed to load catalog: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.75rem' }}>
        {technologies.map((tech) => (
          <div
            key={tech.slug}
            className="glass-card"
            style={{
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              cursor: 'pointer',
              border: '1px solid var(--border-subtle)'
            }}
            onClick={() => onSelectTech(tech.slug)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {getTechIcon(tech.slug)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                <span className="badge badge-review" style={{ fontSize: '0.65rem' }}>
                  {tech.reviewStatus}
                </span>
                {tech.runnableInSandbox ? (
                  <span className="badge badge-runnable" style={{ fontSize: '0.65rem' }}>
                    Sandbox Runnable
                  </span>
                ) : (
                  <span className="badge badge-readonly" style={{ fontSize: '0.65rem' }}>
                    Read-Only (Server Daemon)
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, textTransform: 'uppercase' }}>
                {tech.category}
              </span>
              <h2 style={{ fontSize: '1.4rem', marginTop: '0.2rem' }}>{tech.name}</h2>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', flex: 1, marginBottom: '1.5rem', lineHeight: '1.5' }}>
              {tech.shortDescription}
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '1rem',
              fontSize: '0.85rem'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {tech.license}
              </span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                Explore Modules <ArrowRight size={14} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
