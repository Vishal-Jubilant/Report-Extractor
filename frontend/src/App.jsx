import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ExtractorView from './components/ExtractorView';
import SettingsView from './components/SettingsView';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('extractor');
  const [toast, setToast] = useState(null);

  const notify = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const renderToastIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-600 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-slate-700 shrink-0" />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white font-sans text-slate-900">
      
      {/* Docked Edge-to-Edge Fullscreen Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      {/* Main Fullscreen Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        {activeTab === 'extractor' ? (
          <ExtractorView 
            onNotify={notify} 
            onNavigateToSettings={() => setActiveTab('settings')}
          />
        ) : (
          <SettingsView 
            onNotify={notify} 
          />
        )}
      </main>

      {/* Modern Minimal Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-lg shadow-slate-200/50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {renderToastIcon(toast.type)}
          <span className="text-xs font-medium text-slate-800">{toast.message}</span>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 p-0.5 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
