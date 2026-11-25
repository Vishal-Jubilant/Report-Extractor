import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

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
    <ToastContext.Provider value={{ notify, dismissToast }}>
      {children}

      {/* Accessible White Frosted Glass Toast Notification */}
      {toast && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/85 backdrop-blur-2xl border border-slate-200/90 shadow-[0_12px_36px_rgba(15,23,42,0.12)] animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {renderToastIcon(toast.type)}
          <span className="text-xs font-semibold text-slate-800">{toast.message}</span>
          <button 
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-700 p-0.5 ml-2 cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
