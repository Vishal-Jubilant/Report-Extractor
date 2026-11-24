import React from 'react';
import { 
  Building2, 
  Search, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  ExternalLink 
} from 'lucide-react';

export default function TransactionPanel({
  results,
  sendSearch,
  onSendSearchChange,
  recvSearch,
  onRecvSearchChange,
  filteredSend = [],
  filteredRecv = [],
  expandedFiles = {},
  onToggleFileAccordion,
  copiedSection,
  onCopySection,
  onNavigateToSettings
}) {
  if (!results) return null;

  return (
    <div className="space-y-6">
      {/* Dual Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* SEND (DEBIT) CARD */}
        <div className="flex flex-col rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
          
          {/* Card Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">Send</h2>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                      Dr
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {results.send.count} transactions &bull; Total: <span className="text-slate-900 font-bold">{results.send.total_formatted}</span>
                  </p>
                </div>
              </div>

              {/* 1-Click Copy Button */}
              <button
                type="button"
                onClick={() => {
                  const sendLines = (sendSearch && filteredSend.length < results.send.transactions.length)
                    ? filteredSend.map(t => t.line_text).join('\n')
                    : (results.send.text || results.send.transactions.map(t => t.line_text).join('\n'));
                  const content = sendLines ? `Yesterday Send Transaction\n\n${sendLines}` : '';
                  onCopySection(content, 'send', 'Send List');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs cursor-pointer active:scale-95"
                title="Copy formatted 1.SS - Party - Amount lines"
              >
                {copiedSection === 'send' ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy List
                  </>
                )}
              </button>
            </div>

            {/* Search Bar for Send */}
            <div className="mt-3 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={sendSearch}
                onChange={(e) => onSendSearchChange(e.target.value)}
                placeholder="Search account, party or amount..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all"
                aria-label="Search Send transactions"
              />
            </div>
          </div>

          {/* Transactions List */}
          <div className="max-h-[480px] overflow-y-auto">
            {filteredSend.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {results.send.count === 0 ? "No debit transactions" : "No matches found"}
              </div>
            ) : (
              filteredSend.map((tx) => (
                <div 
                  key={tx.index}
                  className="group flex items-center justify-between px-4 py-3 border-b border-slate-100 hover:bg-slate-50/80 transition-colors [content-visibility:auto] [contain-intrinsic-size:52px]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 text-center text-xs font-mono text-slate-400 font-semibold">
                      {tx.index}.
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {tx.account}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {tx.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {tx.bank} &bull; {tx.file}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <span className="inline-block px-3 py-1 rounded-lg text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                      {tx.short}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RECEIVED (CREDIT) CARD */}
        <div className="flex flex-col rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
          
          {/* Card Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">Received</h2>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                      Cr
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {results.received.count} transactions &bull; Total: <span className="text-slate-900 font-bold">{results.received.total_formatted}</span>
                  </p>
                </div>
              </div>

              {/* 1-Click Copy Button */}
              <button
                type="button"
                onClick={() => {
                  const recvLines = (recvSearch && filteredRecv.length < results.received.transactions.length)
                    ? filteredRecv.map(t => t.line_text).join('\n')
                    : (results.received.text || results.received.transactions.map(t => t.line_text).join('\n'));
                  const content = recvLines ? `Yesterday Received Transaction\n\n${recvLines}` : '';
                  onCopySection(content, 'received', 'Received List');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs cursor-pointer active:scale-95"
                title="Copy formatted 1.SS - Party - Amount lines"
              >
                {copiedSection === 'received' ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy List
                  </>
                )}
              </button>
            </div>

            {/* Search Bar for Received */}
            <div className="mt-3 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={recvSearch}
                onChange={(e) => onRecvSearchChange(e.target.value)}
                placeholder="Search account, party or amount..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all"
                aria-label="Search Received transactions"
              />
            </div>
          </div>

          {/* Transactions List */}
          <div className="max-h-[480px] overflow-y-auto">
            {filteredRecv.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {results.received.count === 0 ? "No credit transactions" : "No matches found"}
              </div>
            ) : (
              filteredRecv.map((tx) => (
                <div 
                  key={tx.index}
                  className="group flex items-center justify-between px-4 py-3 border-b border-slate-100 hover:bg-slate-50/80 transition-colors [content-visibility:auto] [contain-intrinsic-size:52px]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 text-center text-xs font-mono text-slate-400 font-semibold">
                      {tx.index}.
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {tx.account}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {tx.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {tx.bank} &bull; {tx.file}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <span className="inline-block px-3 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                      {tx.short}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* File Audit & Breakdown Section */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3.5">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          File Processing Breakdown
        </h3>

        <div className="space-y-2">
          {results.files.map((f, idx) => {
            const isExpanded = expandedFiles[idx];
            const hasWarn = !!f.warning;
            return (
              <div 
                key={idx}
                className="rounded-xl border border-slate-200 bg-slate-50/60"
              >
                <div 
                  onClick={() => onToggleFileAccordion(idx)}
                  className="flex items-center justify-between p-3.5 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleFileAccordion(idx);
                    }
                  }}
                  aria-expanded={!!isExpanded}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-semibold text-sm text-slate-800 truncate">{f.filename}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                      {f.bank}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                      Code: {f.account_code}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono">
                      {f.transactions_count} matched
                    </span>
                    {hasWarn && (
                      <span className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" /> Attention
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-200 text-xs text-slate-700 space-y-2">
                    <div className="flex flex-wrap gap-5 text-xs font-mono text-slate-600">
                      <div>Holder inside file: <span className="text-slate-900 font-bold">{f.holder_name || "N/A"}</span></div>
                      <div>Assigned Code: <span className="text-slate-900 font-bold">{f.account_code}</span></div>
                      <div>Status: <span className="text-slate-900 font-bold">{f.status}</span></div>
                    </div>

                    {hasWarn && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start justify-between gap-3 mt-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <p className="text-amber-900 text-xs font-medium">
                            {f.warning}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToSettings();
                          }}
                          className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors shadow-2xs cursor-pointer"
                        >
                          Open Settings <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
