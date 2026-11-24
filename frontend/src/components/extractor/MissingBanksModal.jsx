import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  AlertTriangle, 
  Check, 
  X, 
  XCircle, 
  CheckCircle2, 
  Info, 
  UploadCloud, 
  ArrowRight 
} from 'lucide-react';

export default function MissingBanksModal({
  isOpen,
  warningData,
  onClose,
  onProceedAnyway
}) {
  // Close modal on Escape key press (Web Interface Guidelines compliance)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !warningData) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="missing-banks-modal-title"
      aria-describedby="missing-banks-modal-description"
      onClick={handleBackdropClick}
    >
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col space-y-0"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-start gap-3.5 px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <h2 id="missing-banks-modal-title" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Missing Statements &amp; Group Requirements
            </h2>
            <p id="missing-banks-modal-description" className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
              Required enterprise statement files or configured bank statements are missing from your uploaded files.
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Missing Details Per Enterprise */}
        <div className="px-6 py-4 space-y-3.5 max-h-[340px] overflow-y-auto overscroll-contain">
          {warningData.enterprises.map((ent) => (
            <div 
              key={ent.code} 
              className={`p-4 rounded-xl border space-y-3 transition-colors ${
                ent.is_entire_enterprise_missing 
                  ? 'bg-rose-50/40 border-rose-200/90' 
                  : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              {/* Enterprise Header */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-900 text-white shrink-0 shadow-2xs">
                    {ent.code}
                  </span>
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {ent.name}
                  </span>
                  {ent.group_name && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      Group: {ent.group_name}
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  {ent.is_entire_enterprise_missing ? 'Enterprise Statement Missing' : `${ent.missing_banks.length} Bank(s) Missing`}
                </span>
              </div>

              {/* Callout when entire enterprise is missing */}
              {ent.is_entire_enterprise_missing && (
                <div className="p-2.5 rounded-lg bg-rose-100/60 border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                  <span>
                    No statement files were selected for <strong>{ent.name || ent.code}</strong> (Required by <strong>{ent.group_name || 'Group'}</strong>).
                  </span>
                </div>
              )}

              {/* Missing Banks Alert */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" /> 
                  Required Bank Statement(s):
                </p>
                <div className="flex flex-wrap gap-2">
                  {ent.missing_banks.map((b) => (
                    <div 
                      key={b}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span className="font-bold">{b}</span>
                      <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                        Not Uploaded
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Currently Uploaded Banks */}
              {ent.uploaded_banks && ent.uploaded_banks.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> 
                    Currently Uploaded:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ent.uploaded_banks.map((b) => (
                      <div 
                        key={b}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                      >
                        <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" aria-hidden="true" />
                        <span className="font-bold">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Informative Notice Callout */}
        <div className="px-6 py-1">
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 flex items-start gap-2.5 text-xs text-amber-950">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              <strong>Notice:</strong> Proceeding without uploading all required bank statements may result in incomplete transaction reconciliation. You can return to upload or proceed anyway.
            </p>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 mt-2 bg-slate-50/80 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-slate-500" aria-hidden="true" />
            Upload Missing Files
          </button>
          <button
            type="button"
            onClick={onProceedAnyway}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <span>Okay, Proceed Anyway</span>
            <ArrowRight className="w-4 h-4 text-slate-300" aria-hidden="true" />
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
