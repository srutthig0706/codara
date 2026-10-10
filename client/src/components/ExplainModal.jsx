import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Sparkles, BookOpen, ExternalLink, Lightbulb, Key, Cpu, Zap } from 'lucide-react';

export default function ExplainModal({ tech, onClose }) {
  const { token } = useAuth();
  const [query, setQuery] = useState(`What makes ${tech.name} distinct and how does its core mechanism work?`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleExplain = async (customQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          techSlug: tech.slug,
          conceptQuery: customQuery || query
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate explanation');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1.5rem'
    }}>
      <div className="glass-card" style={{
        maxWidth: '720px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-highlight)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={16} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Grounded Concept Explanation: {tech.name}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Bounded AI &bull; Strict Zod Schema &bull; Verified Citations
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Concept / Question to Explain</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about memory model, event loop, TTL, etc."
              />
              <button
                className="btn btn-primary"
                onClick={() => handleExplain(query)}
                disabled={loading}
                style={{ whiteSpace: 'nowrap' }}
              >
                {loading ? 'Synthesizing...' : 'Explain'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#fca5a5',
              fontSize: '0.875rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {result?.explain && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Cache status badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-primary">
                  {result.fromCache ? '⚡ Instant (MongoDB SHA-256 Cache)' : `Generated via ${result.providerUsed.toUpperCase()}`}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Validated via Zod
                </span>
              </div>

              {/* Summary */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Cpu size={16} /> Conceptual Summary
                </div>
                <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                  {result.explain.summary}
                </p>
              </div>

              {/* Core Mechanism */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={16} /> Core Mechanism (Under The Hood)
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.92rem' }}>
                  {result.explain.coreMechanism}
                </p>
              </div>

              {/* Real World Analogy */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.05)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <div style={{ fontWeight: 600, color: '#34d399', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lightbulb size={16} /> Real-World Mental Model
                </div>
                <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '0.92rem' }}>
                  {result.explain.realWorldAnalogy}
                </p>
              </div>

              {/* Key Takeaway */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.05)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(245, 158, 11, 0.2)'
              }}>
                <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Key size={15} /> Key Engineering Takeaway
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  {result.explain.keyTakeaway}
                </p>
              </div>

              {/* Verified Sources Panel */}
              {result.explain.citations?.length > 0 && (
                <div style={{
                  padding: '1rem',
                  borderTop: '1px solid var(--border-subtle)',
                  marginTop: '0.5rem'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                    RETRIEVED & VERIFIED CITATIONS:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {result.explain.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--accent-cyan)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <BookOpen size={13} />
                        <span>{c.sourceName}: {c.sourceUrl}</span>
                        <ExternalLink size={11} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
