import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CatalogPage from './pages/CatalogPage';
import TechnologyPage from './pages/TechnologyPage';
import ScenarioPage from './pages/ScenarioPage';
import ExplainModal from './components/ExplainModal';
import { Server, Database, Cpu, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

function MainApp() {
  const { user, isAuthenticated, loading } = useAuth();
  const [currentView, setCurrentView] = useState('catalog');
  const [selectedTechSlug, setSelectedTechSlug] = useState(null);
  const [activeModal, setActiveModal] = useState(null);

  // Handle technology selection
  const handleSelectTech = (slug) => {
    setSelectedTechSlug(slug);
    setCurrentView('technology');
  };

  const handleBackToCatalog = () => {
    setSelectedTechSlug(null);
    setCurrentView('catalog');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading session...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'catalog') setSelectedTechSlug(null);
          setCurrentView(view);
        }}
      />

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

        {currentView === 'catalog' && (
          <CatalogPage onSelectTech={handleSelectTech} />
        )}

        {currentView === 'technology' && selectedTechSlug && (
          <TechnologyPage
            techSlug={selectedTechSlug}
            onBack={handleBackToCatalog}
            onTriggerExplain={(tech) => setActiveModal({ action: 'explain', tech })}
            onTriggerScenario={(tech) => setCurrentView('scenario')}
            onTriggerCompare={(tech) => setCurrentView('compare')}
            onTriggerTeachCode={(tech) => setCurrentView('teach_code')}
            onTriggerTests={(tech) => setCurrentView('tests')}
          />
        )}

        {currentView === 'scenario' && selectedTechSlug && (
          <ScenarioPage
            techSlug={selectedTechSlug}
            onBack={() => setCurrentView('technology')}
          />
        )}
      </main>

      {/* Modals */}
      {activeModal?.action === 'explain' && (
        <ExplainModal
          tech={activeModal.tech}
          onClose={() => setActiveModal(null)}
        />
      )}

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
