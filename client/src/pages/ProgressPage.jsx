import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bookmark, CheckCircle2, RefreshCw } from 'lucide-react';

export default function ProgressPage({ onSelectTech }) {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingSlug, setUpdatingSlug] = useState(null);

  const requestDashboard = useCallback(async () => {
      const response = await fetch('/api/progress/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load progress dashboard.');
      return data;
  }, [token]);

  const loadDashboard = useCallback(async () => {
    try {
      setDashboard(await requestDashboard());
      setError(null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [requestDashboard]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    requestDashboard()
      .then(data => {
        if (!cancelled) {
          setDashboard(data);
          setError(null);
        }
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [requestDashboard, token]);

  const toggleBookmark = async (technology) => {
    setUpdatingSlug(technology.slug);
    setError(null);
    try {
      const response = await fetch(`/api/progress/bookmarks/${technology.slug}`, {
        method: technology.bookmarked ? 'DELETE' : 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update bookmark.');
      await loadDashboard();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingSlug(null);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>Learning progress</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Progress reflects viewed sections, completed quizzes, passed exercises, and successfully generated scenarios.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ padding: '1rem', marginBottom: '1rem', color: '#fca5a5', background: 'rgba(244, 63, 94, 0.1)', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
      )}
      {loading && (
        <div role="status" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          <RefreshCw size={18} className="spin" style={{ marginRight: '0.5rem' }} />
          Loading saved progress…
        </div>
      )}

      {!loading && dashboard && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1rem' }}>
            {dashboard.technologies.map(technology => (
              <article key={technology.slug} className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => onSelectTech(technology.slug)}
                    style={{ border: 0, padding: 0, background: 'transparent', textAlign: 'left', fontSize: '1.15rem', fontWeight: 700 }}
                  >
                    {technology.name}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => toggleBookmark(technology)}
                    disabled={updatingSlug === technology.slug}
                    aria-label={`${technology.bookmarked ? 'Remove' : 'Add'} ${technology.name} bookmark`}
                  >
                    <Bookmark size={14} fill={technology.bookmarked ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.35rem 0 1rem' }}>{technology.category}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  <span>{technology.progress.completedSteps} of {technology.progress.totalSteps} steps</span>
                  <span>{technology.progress.completionPercent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${technology.name} progress`}
                  aria-valuemin={0}
                  aria-valuemax={technology.progress.totalSteps}
                  aria-valuenow={technology.progress.completedSteps}
                  style={{ height: '8px', background: 'var(--border-subtle)', borderRadius: '999px', overflow: 'hidden', marginBottom: '1rem' }}
                >
                  <div style={{ height: '100%', width: `${technology.progress.completionPercent}%`, background: 'var(--accent-primary)', transition: 'width 0.2s ease' }} />
                </div>
                <div style={{ display: 'grid', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  <span>{technology.progress.sectionsViewed.length}/5 sections viewed</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {technology.progress.quizCompleted && <CheckCircle2 size={13} color="#10b981" />}
                    Quiz {technology.progress.quizCompleted
                      ? `completed · best score ${technology.progress.quizBestScore}%`
                      : 'not completed'}
                  </span>
                  <span>{technology.progress.passedExercises.length} exercises passed</span>
                  <span>{technology.progress.scenariosGenerated} scenario{technology.progress.scenariosGenerated === 1 ? '' : 's'} generated</span>
                </div>
              </article>
            ))}
          </section>

          <section style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Bookmark size={18} /> Bookmarked technologies
            </h2>
            {dashboard.bookmarks.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No bookmarked technologies yet. Bookmark one from its technology page.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {dashboard.bookmarks.map(bookmark => (
                  <button
                    key={bookmark.slug}
                    className="btn btn-secondary"
                    onClick={() => onSelectTech(bookmark.slug)}
                  >
                    <Bookmark size={14} fill="currentColor" />
                    {bookmark.name}
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
