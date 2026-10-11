import React, { useCallback, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ReviewBanner from '../components/ReviewBanner';
import CodeEditor from '../components/CodeEditor';
import { 
  ArrowLeft, BookOpen, HelpCircle, Layers, GitCompare, Code2, 
  CheckSquare, Terminal, AlertTriangle, ShieldCheck, Bookmark, ExternalLink 
} from 'lucide-react';

export default function TechnologyPage({ 
  techSlug, 
  onBack, 
  onTriggerExplain, 
  onTriggerScenario, 
  onTriggerCompare, 
  onTriggerTeachCode, 
  onTriggerTests 
}) {
  const { token, isAuthenticated } = useAuth();
  const [tech, setTech] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [editorCode, setEditorCode] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [learningProgress, setLearningProgress] = useState(null);
  const [bookmarking, setBookmarking] = useState(false);
  const [progressError, setProgressError] = useState(null);

  const refreshLearningProgress = useCallback(async () => {
    if (!token) return;
    const response = await fetch('/api/progress/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load learning progress.');
    setLearningProgress(data.technologies.find(item => item.slug === techSlug) || null);
  }, [techSlug, token]);

  useEffect(() => {
    async function fetchTech() {
      setLoading(true);
      setError(null);
      setTech(null);
      setActiveTab('overview');
      try {
        const res = await fetch(`/api/technologies/${techSlug}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTech(data.technology);
        setEditorCode(data.technology.codeExample || '');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTech();
  }, [techSlug]);

  useEffect(() => {
    if (!token || tech?.slug !== techSlug) return;
    let cancelled = false;
    async function recordViewedSection() {
      try {
        const response = await fetch(`/api/progress/sections/${techSlug}/${activeTab}/view`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to record viewed section.');
        if (!cancelled) await refreshLearningProgress();
      } catch (eventError) {
        if (!cancelled) setProgressError(eventError.message);
      }
    }
    recordViewedSection();
    return () => { cancelled = true; };
  }, [activeTab, tech, techSlug, token, refreshLearningProgress]);

  const handleToggleBookmark = async () => {
    setBookmarking(true);
    setProgressError(null);
    try {
      const response = await fetch(`/api/progress/bookmarks/${techSlug}`, {
        method: learningProgress?.bookmarked ? 'DELETE' : 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update bookmark.');
      await refreshLearningProgress();
    } catch (bookmarkError) {
      setProgressError(bookmarkError.message);
    } finally {
      setBookmarking(false);
    }
  };

  const handleRunCode = async () => {
    if (!tech?.runnableInSandbox) return;
    setIsRunning(true);
    setExecutionResult(null);
    try {
      const languageId = techSlug === 'python' ? 71 : 63;
      const res = await fetch('/api/sandbox/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceCode: editorCode,
          languageId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Execution failed');
      setExecutionResult(data.execution);
    } catch (err) {
      setExecutionResult({
        status: { id: 13, description: 'Error' },
        stderr: err.message,
        stdout: ''
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading technology details...
      </div>
    );
  }

  if (error || !tech) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--accent-rose)', marginBottom: '1rem' }}>
          {error || 'Technology not found'}
        </p>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Return to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '4rem' }}>
      {/* Header Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Catalog
        </button>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {tech.runnableInSandbox ? (
            <span className="badge badge-runnable">Sandbox Runnable</span>
          ) : (
            <span className="badge badge-readonly">Read-Only (Server Daemon)</span>
          )}
          <span className="badge badge-review">{tech.reviewStatus}</span>
        </div>
      </div>

      {/* Main Title & Overview Header */}
      <div style={{ marginBottom: '2rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, textTransform: 'uppercase' }}>
          {tech.category}
        </span>
        <h1 style={{ fontSize: '2.5rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
          {tech.name}
        </h1>
        <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '850px' }}>
          {tech.shortDescription}
        </p>
        {isAuthenticated && learningProgress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <span className="badge badge-primary">
              Progress: {learningProgress.progress.completedSteps} of {learningProgress.progress.totalSteps} steps
            </span>
            <button className="btn btn-secondary btn-sm" onClick={handleToggleBookmark} disabled={bookmarking}>
              <Bookmark size={14} fill={learningProgress.bookmarked ? 'currentColor' : 'none'} />
              {bookmarking ? 'Saving…' : learningProgress.bookmarked ? 'Bookmarked' : 'Bookmark technology'}
            </button>
            {learningProgress.progress.scenariosGenerated > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {learningProgress.progress.scenariosGenerated} scenario{learningProgress.progress.scenariosGenerated === 1 ? '' : 's'} generated
              </span>
            )}
          </div>
        )}
        {progressError && (
          <p role="alert" style={{ color: 'var(--accent-rose)', marginTop: '0.75rem' }}>{progressError}</p>
        )}
      </div>

      {/* Bounded AI Action Toolbar */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '2rem', border: '1px solid var(--border-highlight)' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Bounded Pedagogical AI Actions (Zero Chatbot)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button className="btn btn-primary btn-sm" onClick={() => onTriggerExplain(tech)}>
            <HelpCircle size={15} /> Explain Concept
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onTriggerScenario(tech)}>
            <Layers size={15} /> Architecture Scenario (With/Without)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onTriggerCompare(tech)}>
            <GitCompare size={15} /> Compare Alternatives
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onTriggerTeachCode(tech)}>
            <Code2 size={15} /> Teach to Code
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onTriggerTests(tech)}>
            <CheckSquare size={15} /> Quizzes & Exercises
          </button>
        </div>
      </div>

      {/* Official Review Banner */}
      <ReviewBanner
        sourceName={tech.sourceName}
        sourceUrl={tech.sourceUrl}
        license={tech.license}
        reviewStatus={tech.reviewStatus}
      />

      {/* Static Content Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.75rem' }}>
        {[
          { id: 'overview', label: '1. Overview (What It Is)' },
          { id: 'why_where', label: '2. Why & Where (Purpose)' },
          { id: 'setup', label: '3. Setup Guide' },
          { id: 'errors', label: '4. Common Pitfalls' },
          { id: 'code', label: '5. Code Example' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 500,
              padding: '0.75rem 1.25rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>What is {tech.name}?</h3>
            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '1rem', whiteSpace: 'pre-line' }}>
              {tech.overview}
            </div>
          </div>
        )}

        {activeTab === 'why_where' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '0.75rem' }}>Why Does {tech.name} Exist?</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '1rem', whiteSpace: 'pre-line' }}>
                {tech.whyExists}
              </p>
            </div>
            <div>
              <h3 style={{ marginBottom: '0.75rem' }}>Where Is It Used in Production?</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '1rem', whiteSpace: 'pre-line' }}>
                {tech.whereUsed}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Step-by-Step Local Setup</h3>
            <pre style={{
              background: 'var(--bg-input)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              color: '#a5f3fc',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.7'
            }}>
              {tech.setupGuide}
            </pre>
          </div>
        )}

        {activeTab === 'errors' && (
          <div>
            <h3 style={{ marginBottom: '1.25rem' }}>Common Beginner Pitfalls & Solutions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {tech.commonErrors?.map((err, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-rose)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    <AlertTriangle size={16} />
                    <span>{err.error}</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Cause:</strong> {err.cause}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6ee7b7' }}>
                    <strong style={{ color: 'var(--accent-emerald)' }}>Fix:</strong> {err.fix}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>Interactive Code Example</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {tech.runnableInSandbox 
                    ? "Edit and execute this snippet in the sandboxed runtime below."
                    : "Daemon architecture services are displayed read-only."}
                </p>
              </div>
            </div>

            <CodeEditor
              code={editorCode}
              onChange={(val) => setEditorCode(val || '')}
              language={tech.slug === 'python' ? 'python' : 'javascript'}
              isRunnable={tech.runnableInSandbox}
              onRun={handleRunCode}
              isRunning={isRunning}
              executionResult={executionResult}
              isVerified={true}
              height="360px"
            />
          </div>
        )}
      </div>
    </div>
  );
}
