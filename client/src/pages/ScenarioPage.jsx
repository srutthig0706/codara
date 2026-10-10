import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  ArrowLeft, Layers, AlertOctagon, CheckCircle2, RefreshCw, 
  BookOpen, ExternalLink, Sparkles, Server, Cpu, Database 
} from 'lucide-react';

export default function ScenarioPage({ techSlug, onBack }) {
  const { token } = useAuth();
  const [tech, setTech] = useState(null);
  const [mode, setMode] = useState('with'); // 'with' or 'without'
  const [topic, setTopic] = useState('Session state bottleneck under 100k concurrent users');
  const [loading, setLoading] = useState(false);
  const [scenarioData, setScenarioData] = useState(null);
  const [error, setError] = useState(null);

  // Fetch tech metadata
  useEffect(() => {
    async function loadTech() {
      try {
        const res = await fetch(`/api/technologies/${techSlug}`);
        const data = await res.json();
        setTech(data.technology);
      } catch (e) {}
    }
    loadTech();
  }, [techSlug]);

  // Generate Scenario
  const handleGenerateScenario = async (customTopic) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/scenario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          techSlug,
          scenarioTopic: customTopic || topic
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to synthesize scenario');
      setScenarioData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGenerateScenario(topic);
  }, [techSlug]);

  // Transform nodes for React Flow
  const activeGraph = mode === 'without' 
    ? scenarioData?.scenario?.withoutTech 
    : scenarioData?.scenario?.withTech;

  const flowNodes = (activeGraph?.nodes || []).map((n, i) => {
    const isProblem = n.isProblemNode;
    return {
      id: n.id,
      position: { x: 80 + (i % 3) * 220, y: 60 + Math.floor(i / 3) * 140 },
      data: {
        label: (
          <div style={{ textAlign: 'left', padding: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
              {isProblem ? <AlertOctagon size={14} color="#f43f5e" /> : <CheckCircle2 size={14} color="#10b981" />}
              <span>{n.label}</span>
            </div>
            {n.details && (
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                {n.details}
              </div>
            )}
          </div>
        )
      },
      style: {
        background: isProblem ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 21, 34, 0.95)',
        color: '#f8fafc',
        border: isProblem ? '1px solid #f43f5e' : '1px solid rgba(99, 102, 241, 0.4)',
        boxShadow: isProblem ? '0 0 15px rgba(244, 63, 94, 0.3)' : '0 4px 12px rgba(0,0,0,0.4)',
        borderRadius: '8px',
        fontSize: '0.8rem',
        minWidth: '160px'
      }
    };
  });

  const flowEdges = (activeGraph?.edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || '',
    animated: e.animated || mode === 'with',
    style: {
      stroke: e.isFailingEdge ? '#f43f5e' : (mode === 'with' ? '#10b981' : '#6366f1'),
      strokeWidth: e.isFailingEdge ? 3 : 2
    }
  }));

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Technology
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {scenarioData && (
            <span className="badge badge-primary">
              {scenarioData.fromCache ? '⚡ Cached Response' : `Generated via ${scenarioData.providerUsed.toUpperCase()}`}
            </span>
          )}
          <span className="badge badge-review">React Flow Spatial View</span>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>
          Architectural Scenario: {tech?.name || techSlug}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Spatial comparison: Observe critical system bottlenecks when the technology is absent versus how the topology stabilizes when introduced.
        </p>
      </div>

      {/* Preset Scenario Topic Selector */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Preset Scenarios:</span>
          {[
            'Session state bottleneck under 100k concurrent users',
            'Database read saturation on product catalog requests',
            'Synchronous CPU blocking vs asynchronous event loop'
          ].map((preset, idx) => (
            <button
              key={idx}
              className={`btn btn-sm ${topic === preset ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setTopic(preset);
                handleGenerateScenario(preset);
              }}
              disabled={loading}
            >
              {preset.split(' ')[0]} {preset.split(' ')[1]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#fca5a5',
          marginBottom: '1.5rem'
        }}>
          {error}
        </div>
      )}

      {/* With vs Without Mode Toggles */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          className={`btn ${mode === 'without' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            flex: 1,
            background: mode === 'without' ? 'linear-gradient(135deg, #e11d48, #9f1239)' : undefined,
            borderColor: mode === 'without' ? '#f43f5e' : undefined
          }}
          onClick={() => setMode('without')}
        >
          <AlertOctagon size={16} />
          WITHOUT {tech?.name || techSlug} (Bottlenecks & Failures)
        </button>

        <button
          className={`btn ${mode === 'with' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            flex: 1,
            background: mode === 'with' ? 'linear-gradient(135deg, #059669, #047857)' : undefined,
            borderColor: mode === 'with' ? '#10b981' : undefined
          }}
          onClick={() => setMode('with')}
        >
          <CheckCircle2 size={16} />
          WITH {tech?.name || techSlug} (Stabilized Topology)
        </button>
      </div>

      {/* Main Grid: React Flow Canvas + Analysis Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
        {/* React Flow Canvas */}
        <div className="glass-card" style={{ height: '520px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <RefreshCw size={24} className="spin" style={{ marginRight: '0.75rem' }} />
              Synthesizing spatial architectural graph...
            </div>
          ) : (
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              fitView
              attributionPosition="bottom-left"
            >
              <Background color="#1e293b" gap={16} size={1} />
              <Controls />
            </ReactFlow>
          )}
        </div>

        {/* Narrative & Problem/Benefits Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem', flex: 1 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {mode === 'without' ? <AlertOctagon size={16} color="#f43f5e" /> : <CheckCircle2 size={16} color="#10b981" />}
              <span>{mode === 'without' ? 'System Bottlenecks' : 'Stabilization Benefits'}</span>
            </h3>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1rem' }}>
              {activeGraph?.narrative || 'Analyzing architectural implications...'}
            </p>

            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              {mode === 'without' ? 'Observed Failure Modes:' : 'Realized Advantages:'}
            </div>

            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: mode === 'without' ? '#fca5a5' : '#6ee7b7', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {(mode === 'without' ? activeGraph?.problemPoints : activeGraph?.benefitsRealized)?.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          </div>

          {/* Sources Panel */}
          {scenarioData?.retrievedChunks?.length > 0 && (
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                GROUNDED DOCUMENTATION SOURCES:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {scenarioData.retrievedChunks.slice(0, 2).map((c, i) => (
                  <a
                    key={i}
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--accent-cyan)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <BookOpen size={12} />
                    <span>{c.sectionTitle}</span>
                    <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
