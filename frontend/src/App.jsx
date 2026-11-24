import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ExtractorView from './components/ExtractorView';
import SettingsView from './components/SettingsView';
import { ToastProvider } from './context/ToastContext';

export default function App() {
  const [activeTab, setActiveTab] = useState('extractor');

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-white font-sans text-slate-900">
        
        {/* Docked Edge-to-Edge Fullscreen Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />

        {/* Main Fullscreen Workspace with Preserved Tab State */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white relative">
          <div className={`h-full w-full flex flex-col min-w-0 overflow-hidden ${activeTab === 'extractor' ? '' : 'hidden'}`}>
            <ExtractorView 
              isActive={activeTab === 'extractor'}
              onNavigateToSettings={() => setActiveTab('settings')}
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
