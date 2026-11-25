import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ExtractorView from './components/ExtractorView';
import SettingsView from './components/SettingsView';
import { ToastProvider } from './context/ToastContext';

function getInitialTab() {
  if (typeof window === 'undefined') return 'extractor';
  
  // 1. Check URL hash (e.g. #settings or #extractor)
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === 'settings' || hash === 'extractor') {
    return hash;
  }
  
  // 2. Check URL search param (e.g. ?tab=settings)
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam === 'settings' || tabParam === 'extractor') {
    return tabParam;
  }
  
  // 3. Check localStorage backup
  try {
    const saved = localStorage.getItem('rtgs_active_tab');
    if (saved === 'settings' || saved === 'extractor') {
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
    window.location.hash = tab;
    try {
      localStorage.setItem('rtgs_active_tab', tab);
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    const initial = getInitialTab();
    if (window.location.hash.replace(/^#\/?/, '').toLowerCase() !== initial) {
      window.location.hash = initial;
    }
    try {
      localStorage.setItem('rtgs_active_tab', initial);
    } catch {}

    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (hash === 'settings' || hash === 'extractor') {
        setActiveTab(hash);
        try {
          localStorage.setItem('rtgs_active_tab', hash);
        } catch {}
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <ToastProvider>
      <div className="flex h-full w-full overflow-hidden bg-[#0a0c10] font-sans text-white">
        
        {/* Docked Frosted Glass Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
        />

        {/* Main Fullscreen Workspace with Preserved Tab State */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
          <div className={`h-full w-full flex flex-col min-w-0 overflow-hidden ${activeTab === 'extractor' ? '' : 'hidden'}`}>
            <ExtractorView 
              isActive={activeTab === 'extractor'}
              onNavigateToSettings={() => handleTabChange('settings')}
            />
          </div>
          <div className={`h-full w-full flex flex-col min-w-0 overflow-hidden bg-[#f8fafc] text-slate-900 ${activeTab === 'settings' ? '' : 'hidden'}`}>
            <SettingsView />
          </div>
        </main>

      </div>
    </ToastProvider>
  );
}
