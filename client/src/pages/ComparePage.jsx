import React, { useEffect, useState } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, GitCompare, RefreshCw, ExternalLink, BookOpen } from 'lucide-react';

const WHAT_IF_PRESETS = [
  { id: '10x-users', label: '10x users' },
  { id: 'beginner-team', label: 'Beginner team' },
  { id: 'offline-support', label: 'Offline support' }
];

function toFlowNodes(nodes) {
  return nodes.map((node, index) => ({
    id: node.id,
    position: { x: 40 + (index % 2) * 220, y: 45 + Math.floor(index / 2) * 135 },
    data: {
      label: (
        <div style={{ textAlign: 'left', padding: '0.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
            {node.isProblemNode
              ? <AlertTriangle size={13} color="#f43f5e" />
              : <span aria-hidden="true" style={{ width: 13 }} />}
            <span>{node.label}</span>
          </div>
          {node.details && <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '0.25rem' }}>{node.details}</div>}
        </div>
      )
    },
    style: {
      background: node.isProblemNode ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 21, 34, 0.95)',
      color: '#f8fafc',
      border: node.isProblemNode ? '1px solid #f43f5e' : '1px solid rgba(99, 102, 241, 0.4)',
      borderRadius: '8px',
      minWidth: '160px',
      fontSize: '0.8rem'
    }
  }));
}

function toFlowEdges(edges) {
  return edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label || '',
    animated: edge.animated,
    style: {
      stroke: edge.isFailingEdge ? '#f43f5e' : '#6366f1',
      strokeWidth: edge.isFailingEdge ? 3 : 2
    }
  }));
}

export default function ComparePage({ initialTechSlugs = [] }) {
  const { token } = useAuth();
  const [technologies, setTechnologies] = useState([]);
  const [selectedSlugs, setSelectedSlugs] = useState(() => initialTechSlugs.slice(0, 3));
  const [projectDescription, setProjectDescription] = useState('');
  const [whatIfPreset, setWhatIfPreset] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch('/api/technologies');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load technology catalog.');
        setTechnologies(data.technologies || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoadingCatalog(false);
      }
    }
    loadCatalog();
  }, []);

  const toggleTechnology = (slug) => {
    setSelectedSlugs(current => current.includes(slug)
      ? current.filter(item => item !== slug)
      : current.length < 3 ? [...current, slug] : current);
  };

  const runComparison = async (preset = whatIfPreset) => {
    if (selectedSlugs.length < 2 || !projectDescription.trim()) {
      setError('Select two or three technologies and describe the project before comparing.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          technologies: selectedSlugs,
          projectDescription: projectDescription.trim(),
          ...(preset ? { whatIfPreset: preset } : {})
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to compare technologies.');
      setComparison(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const canCompare = selectedSlugs.length >= 2 && selectedSlugs.length <= 3 &&
    projectDescription.trim().length > 0 && projectDescription.length <= 300;

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '850px', marginBottom: '1.5rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '2.2rem', marginBottom: '0.5rem' }}>
          <GitCompare size={28} color="var(--accent-primary)" />
          Compare Alternatives
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Compare grounded architectural trade-offs. This bounded comparison is not a chat interface.
        </p>
      </div>

      <section className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Choose 2–3 technologies</h2>
        {loadingCatalog ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading catalog…</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
            {technologies.map(technology => {
              const selected = selectedSlugs.includes(technology.slug);
              return (
                <label key={technology.slug} className="btn btn-sm btn-secondary" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!selected && selectedSlugs.length === 3}
                    onChange={() => toggleTechnology(technology.slug)}
                  />
                  {technology.name}
                </label>
              );
            })}
          </div>
        )}

        <label htmlFor="compare-project" style={{ display: 'block', marginTop: '1rem', marginBottom: '0.4rem', fontWeight: 600 }}>
          Project description
        </label>
        <textarea
          id="compare-project"
          value={projectDescription}
          onChange={event => setProjectDescription(event.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Describe what you are building and the architectural need."
          style={{ width: '100%', resize: 'vertical', padding: '0.75rem', color: 'var(--text-primary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{projectDescription.length}/300</span>
          <button className="btn btn-primary" onClick={() => {
            setWhatIfPreset(null);
            runComparison(null);
          }} disabled={!canCompare || loading}>
            {loading ? <RefreshCw size={15} className="spin" /> : <GitCompare size={15} />}
            Compare
          </button>
        </div>
      </section>

      <section className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '0.9rem' }}>What if?</strong>
          {WHAT_IF_PRESETS.map(preset => (
            <button
              key={preset.id}
              className={`btn btn-sm ${whatIfPreset === preset.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setWhatIfPreset(preset.id);
                runComparison(preset.id);
              }}
              disabled={!canCompare || loading}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div role="alert" style={{ padding: '1rem', marginBottom: '1.5rem', color: '#fca5a5', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
      )}

      {loading && (
        <div role="status" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          <RefreshCw size={18} className="spin" style={{ marginRight: '0.5rem' }} />
          Retrieving documentation and comparing architectures…
        </div>
      )}

      {comparison?.comparison && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {comparison.comparison.diagrams.map(diagram => {
              const technology = technologies.find(item => item.slug === diagram.techSlug);
              return (
                <article key={diagram.techSlug} className="glass-card" style={{ padding: '1rem' }}>
                  <h2 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>{technology?.name || diagram.techSlug}</h2>
                  <p style={{ color: diagram.evidenceStatus === 'insufficient' ? '#fbbf24' : 'var(--text-secondary)', fontSize: '0.85rem', minHeight: '2.5rem' }}>
                    {diagram.evidenceNote}
                  </p>
                  <div style={{ height: '300px', overflow: 'hidden', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <ReactFlow nodes={toFlowNodes(diagram.nodes)} edges={toFlowEdges(diagram.edges)} fitView>
                      <Background color="#1e293b" gap={16} size={1} />
                      <Controls />
                    </ReactFlow>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Trade-offs</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid var(--border-subtle)' }}>Criterion / technology</th>
                  {comparison.comparison.technologiesCompared.map(slug => (
                    <th key={slug} colSpan={3} style={{ padding: '0.65rem', borderBottom: '1px solid var(--border-subtle)' }}>
                      {technologies.find(item => item.slug === slug)?.name || slug}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th />
                  {comparison.comparison.technologiesCompared.flatMap(slug => ['Easier', 'Harder', 'Breaks'].map(column => (
                    <th key={`${slug}-${column}`} style={{ padding: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{column}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {comparison.comparison.tradeoffMatrix.map(row => (
                  <tr key={row.criterion}>
                    <th style={{ textAlign: 'left', verticalAlign: 'top', padding: '0.65rem', borderTop: '1px solid var(--border-subtle)' }}>{row.criterion}</th>
                    {comparison.comparison.technologiesCompared.flatMap(slug => {
                      const rating = row.ratings[slug];
                      return ['easier', 'harder', 'breaks'].map(column => (
                        <td key={`${row.criterion}-${slug}-${column}`} style={{ verticalAlign: 'top', padding: '0.65rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                          {rating?.[column] || 'Not assessed'}
                        </td>
                      ));
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Recommendation</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              <strong>{comparison.comparison.recommendedChoice === 'insufficient-evidence'
                ? 'Insufficient verified evidence'
                : technologies.find(item => item.slug === comparison.comparison.recommendedChoice)?.name || comparison.comparison.recommendedChoice}</strong>
              {' — '}{comparison.comparison.recommendationReason}
            </p>
            {comparison.comparison.whatIfPreset && (
              <p style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                Scenario: {WHAT_IF_PRESETS.find(preset => preset.id === comparison.comparison.whatIfPreset)?.label}
              </p>
            )}
          </section>

          <section className="glass-card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Verified sources</h2>
            {comparison.comparison.sources.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No relevant verified sources were retrieved. No source-based recommendation is available.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.6rem' }}>
                {comparison.comparison.sources.map(source => (
                  <li key={source.sourceId}>
                    <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                      <BookOpen size={13} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
                      {source.sourceName} ({source.techSlug})
                      <ExternalLink size={11} style={{ verticalAlign: 'middle', marginLeft: '0.35rem' }} />
                    </a>
                    {source.relevance && <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem', fontSize: '0.8rem' }}>{source.relevance}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
