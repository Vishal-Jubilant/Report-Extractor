import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ExtractorView from './components/ExtractorView';
import CollectionReportView from './components/CollectionReportView';
import SettingsView from './components/SettingsView';
import { ToastProvider } from './context/ToastContext';

const VALID_TABS = new Set(['extractor', 'collection-report', 'settings']);

function getPathTab() {
  if (typeof window === 'undefined') return null;
  const segment = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return VALID_TABS.has(segment) ? segment : null;
}

function getInitialTab() {
  if (typeof window === 'undefined') return 'extractor';

  // 1. Check URL path (e.g. /settings, /collection-report, /extractor)
  const pathTab = getPathTab();
  if (pathTab) {
    return pathTab;
  }

  // 2. Fallback for legacy hash URLs (e.g. /#settings)
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (VALID_TABS.has(hash)) {
    return hash;
  }

  // 3. Check URL search param (e.g. ?tab=collection-report)
  const params = new URLSearchParams(window.location.search);
  const tabParam = (params.get('tab') || '').toLowerCase();
  if (VALID_TABS.has(tabParam)) {
    return tabParam;
  }

  // 4. Check localStorage backup
  try {
    const saved = localStorage.getItem('rtgs_active_tab');
    if (VALID_TABS.has(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }

  return 'extractor';
}

export default function App() {
  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const targetPath = `/${tab}`;
    if (window.location.pathname !== targetPath || window.location.hash) {
      window.history.pushState({ tab }, '', targetPath);
    }
    try {
      localStorage.setItem('rtgs_active_tab', tab);
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    const initial = getInitialTab();
    const targetPath = `/${initial}`;
    if (window.location.pathname !== targetPath || window.location.hash) {
      window.history.replaceState({ tab: initial }, '', targetPath);
    }
    try {
      localStorage.setItem('rtgs_active_tab', initial);
    } catch {}

    const onPopState = () => {
      const pathTab = getPathTab();
      if (pathTab) {
        setActiveTab(pathTab);
        try {
          localStorage.setItem('rtgs_active_tab', pathTab);
        } catch {}
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <ToastProvider>
      <div className="flex flex-col md:flex-row h-full w-full overflow-hidden bg-white font-sans text-slate-900">
        
        {/* Responsive Sidebar (Topbar + Drawer on mobile, Docked Sidebar on laptop/desktop) */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
        />

        {/* Main Fullscreen Workspace with Preserved Tab State */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-white relative">
          <div className={`h-full w-full flex flex-col min-w-0 overflow-hidden ${activeTab === 'extractor' ? '' : 'hidden'}`}>
            <ExtractorView 
              isActive={activeTab === 'extractor'}
              onNavigateToSettings={() => handleTabChange('settings')}
            />
          </div>
          <div className={`h-full w-full flex flex-col min-w-0 overflow-hidden ${activeTab === 'collection-report' ? '' : 'hidden'}`}>
            <CollectionReportView />
          </div>
          <div className={`h-full w-full flex flex-col min-w-0 overflow-hidden ${activeTab === 'settings' ? '' : 'hidden'}`}>
            <SettingsView />
          </div>
        </main>

      </div>
    </ToastProvider>
  );
}
