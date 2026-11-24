import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

export default function MissingBanksModal({
  isOpen,
  warningData,
  onClose,
  onProceedAnyway
}) {
  if (!isOpen || !warningData) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="missing-banks-modal-title"
    >
      <div className="bg-white rounded-2xl border border-amber-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-start gap-3.5 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 id="missing-banks-modal-title" className="text-lg font-bold text-slate-900 tracking-tight">
              Missing Bank Statement Warning
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Expected bank statement(s) are missing from the uploaded files for this enterprise.
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Missing Details Per Enterprise */}
        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
          {warningData.enterprises.map((ent) => (
            <div key={ent.code} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {ent.code}
                  </span>
                  <span className="ml-2 text-sm font-bold text-slate-900">
                    {ent.name}
                  </span>
                </div>
              </div>

              {/* Missing Banks Alert */}
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" /> Missing Bank Statement(s):
                </p>
                <div className="flex flex-wrap gap-2">
                  {ent.missing_banks.map((b) => (
                    <span 
                      key={b}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      {b} (Not Uploaded)
                    </span>
                  ))}
                </div>
              </div>

              {/* Uploaded Banks */}
              {ent.uploaded_banks && ent.uploaded_banks.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Currently Uploaded:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ent.uploaded_banks.map((b) => (
                      <span 
                        key={b}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs flex items-center gap-1"
                      >
                        <Check className="w-3 h-3 text-emerald-600" />
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-600 bg-amber-50/70 p-3 rounded-xl border border-amber-200/60 leading-relaxed">
          <strong>Notice:</strong> Proceeding without uploading all required bank statements may result in incomplete transaction reconciliation. Click <strong>Okay, Proceed Anyway</strong> if you want to proceed.
        </p>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Upload Missing Files
          </button>
          <button
            type="button"
            onClick={onProceedAnyway}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200 transition-all cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" />
            Okay, Proceed Anyway
          </button>
        </div>

      </div>
    </div>
  );
}
