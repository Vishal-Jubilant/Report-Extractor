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
      <div className="relative flex h-full w-full overflow-hidden bg-white font-sans text-slate-900">
        
        {/* Subtle Luminous Ambient Glows on Pure White Canvas for Frosted Glass Depth */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
          <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-indigo-100/55 blur-3xl" />
          <div className="absolute top-1/4 right-[-80px] w-[480px] h-[480px] rounded-full bg-sky-100/55 blur-3xl" />
          <div className="absolute -bottom-36 left-1/3 w-[520px] h-[520px] rounded-full bg-violet-100/45 blur-3xl" />
        </div>

        {/* Docked Edge-to-Edge Fullscreen Glass Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
        />

        {/* Main Fullscreen Workspace with Preserved Tab State */}
        <main className="relative z-10 flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-transparent">
          <div className={`h-full w-full flex flex-col min-w-0 overflow-hidden ${activeTab === 'extractor' ? '' : 'hidden'}`}>
            <ExtractorView 
              isActive={activeTab === 'extractor'}
              onNavigateToSettings={() => handleTabChange('settings')}
            />
          </div>
          <div className={`h-full w-full flex flex-col min-w-0 overflow-hidden ${activeTab === 'settings' ? '' : 'hidden'}`}>
            <SettingsView />
          </div>
        </main>

      </div>
    </ToastProvider>
  );
}
