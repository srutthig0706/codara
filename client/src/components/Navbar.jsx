import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, BookOpen, Bookmark, User, LogIn, Award } from 'lucide-react';

export default function Navbar({ currentView, onNavigate }) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-brand" style={{ cursor: 'pointer' }} onClick={() => onNavigate('catalog')}>
        <div className="brand-logo">C</div>
        <div>
          <span className="brand-text">Codara</span>
          <span className="brand-tagline">Discover. Understand. Code.</span>
        </div>
      </div>

      <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {isAuthenticated && (
          <>
            <button
              className={`btn btn-sm ${currentView === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onNavigate('catalog')}
            >
              <BookOpen size={14} />
              Catalog
            </button>
            <button
              className={`btn btn-sm ${currentView === 'tests' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onNavigate('tests')}
            >
              <Award size={14} />
              Tests
            </button>
            <button
              className={`btn btn-sm ${currentView === 'bookmarks' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onNavigate('bookmarks')}
            >
              <Bookmark size={14} />
              Bookmarks
            </button>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1rem' }}>
          {isAuthenticated ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)'
                }}>
                  <User size={14} />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name}</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={logout} title="Sign Out">
                <LogOut size={14} />
                Logout
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn btn-sm ${currentView === 'login' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onNavigate('login')}
              >
                <LogIn size={14} />
                Login
              </button>
              <button
                className={`btn btn-sm ${currentView === 'register' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onNavigate('register')}
              >
                Register
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
