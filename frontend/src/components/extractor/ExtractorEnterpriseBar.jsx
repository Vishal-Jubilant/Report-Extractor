import React from 'react';
import { Building2 } from 'lucide-react';

export default function ExtractorEnterpriseBar({
  enterprises = [],
  selectedEnterprise = 'ALL',
  onSelectEnterprise,
  onNavigateToSettings
}) {
  const currentSelectedEnt = enterprises.find(e => e.code === selectedEnterprise);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50/80 backdrop-blur-sm border border-indigo-200/60 text-indigo-600 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Target Enterprise / Company
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-slate-900">
                {selectedEnterprise === 'ALL'
                  ? '⚡ Auto-Detect Enterprise from Statement Contents'
                  : `${currentSelectedEnt?.name || selectedEnterprise} (${selectedEnterprise})`}
              </span>
              {currentSelectedEnt && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-50/80 text-indigo-700 border border-indigo-200/80">
                  {currentSelectedEnt.banks?.length || 0} Banks Required
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={selectedEnterprise}
            onChange={(e) => onSelectEnterprise(e.target.value)}
            className="px-3.5 py-2 rounded-xl glass-input text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
            aria-label="Target Enterprise selection"
          >
            <option value="ALL">⚡ Auto-Detect Enterprise</option>
            {enterprises.map(ent => (
              <option key={ent.code} value={ent.code}>
                🏢 {ent.name} ({ent.code})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onNavigateToSettings}
            className="px-3 py-2 rounded-xl glass-card text-xs font-semibold text-slate-600 hover:text-indigo-600 cursor-pointer shrink-0"
            title="Configure Enterprise Bank Mappings in Settings"
          >
            Edit Banks
          </button>
        </div>
      </div>

      {/* Expected Banks Live Alert Pill */}
      {currentSelectedEnt && currentSelectedEnt.banks && (
        <div className="px-4 py-3 rounded-xl bg-indigo-50/55 backdrop-blur-md border border-indigo-200/60 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-indigo-950">Required Statements for {currentSelectedEnt.code}:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentSelectedEnt.banks.map(b => (
                <span key={b} className="px-2.5 py-0.5 rounded-lg font-mono font-bold bg-white/80 backdrop-blur-sm text-indigo-700 border border-indigo-200/80 shadow-2xs">
                  {b}
                </span>
              ))}
            </div>
          </div>
          <span className="text-slate-500 text-[11px]">
            Processing will verify these files are present before proceeding.
          </span>
        </div>
      )}
    </div>
  );
}
