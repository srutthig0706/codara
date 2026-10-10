import React from 'react';
import Editor from '@monaco-editor/react';
import { Play, Terminal, Clock, CheckCircle, XCircle, AlertTriangle, Cpu } from 'lucide-react';

export default function CodeEditor({
  code,
  onChange,
  language = 'python',
  isRunnable = true,
  onRun,
  isRunning = false,
  executionResult = null,
  height = '360px',
  isVerified = true
}) {
  return (
    <div className="glass-card" style={{ overflow: 'hidden', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
      {/* Editor Control Header */}
      <div style={{
        padding: '0.75rem 1.25rem',
        background: 'rgba(10, 13, 20, 0.9)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: isRunnable ? '#10b981' : '#f59e0b'
          }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Monaco Editor ({language})
          </span>
          {isVerified ? (
            <span className="badge badge-runnable" style={{ fontSize: '0.65rem' }}>
              Verified Snippet
            </span>
          ) : (
            <span className="badge badge-review" style={{ fontSize: '0.65rem' }}>
              Unverified Example
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isRunnable ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={onRun}
              disabled={isRunning}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                borderColor: '#10b981'
              }}
            >
              <Play size={14} />
              {isRunning ? 'Executing...' : 'Run in Sandbox'}
            </button>
          ) : (
            <span className="badge badge-readonly">
              [Read-Only: Requires Server Daemon]
            </span>
          )}
        </div>
      </div>

      {/* Monaco Code Surface */}
      <div style={{ height }}>
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={code}
          onChange={onChange}
          options={{
            readOnly: !isRunnable,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4
          }}
        />
      </div>

      {/* Terminal Output Console */}
      {isRunnable && (
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(8, 11, 18, 0.95)',
          padding: '1rem 1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Terminal size={14} /> Execution Console
            </span>
            {executionResult && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                <span style={{ color: executionResult.status?.id === 3 ? '#34d399' : '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {executionResult.status?.id === 3 ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {executionResult.status?.description || 'Executed'}
                </span>
                {executionResult.time && (
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Clock size={12} /> {executionResult.time}s
                  </span>
                )}
                <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                  Runner: {executionResult.runner || 'sandbox'}
                </span>
              </div>
            )}
          </div>

          <pre style={{
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
            color: executionResult?.stderr ? '#fca5a5' : '#e2e8f0',
            maxHeight: '120px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            margin: 0
          }}>
            {executionResult ? (
              executionResult.stderr || executionResult.stdout || '(Program completed with no output)'
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Click 'Run in Sandbox' to compile and execute code...</span>
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
