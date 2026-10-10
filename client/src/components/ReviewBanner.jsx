import React from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

export default function ReviewBanner({ sourceName, sourceUrl, license, reviewStatus }) {
  return (
    <div style={{
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1px solid rgba(245, 158, 11, 0.25)',
      borderRadius: 'var(--radius-md)',
      padding: '0.875rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.75rem',
      marginBottom: '1.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <AlertTriangle size={18} color="var(--accent-amber)" />
        <span style={{ fontSize: '0.85rem', color: '#fef3c7' }}>
          <strong>Content Status:</strong>{' '}
          <span className="badge badge-review" style={{ fontSize: '0.7rem' }}>
            {reviewStatus || 'needs human review'}
          </span>
          <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
            Drafted strictly from official open-source documentation.
          </span>
        </span>
      </div>

      {sourceUrl && (
        <a
          href={sourceUrl}
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
          <span>{sourceName || 'Verified Source'} ({license || 'Open-Source'})</span>
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  );
}
