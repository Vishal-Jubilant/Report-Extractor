import React from 'react';
import { 
  Search, 
  Copy, 
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  X
} from 'lucide-react';

function LedgerCard({
  sectionKey,
  title,
  badge,
  accentClass,
  iconBgClass,
  badgeClass,
  amountClass,
  Icon,
  totalCount,
  totalFormatted,
  transactions,
  searchValue,
  onSearchChange,
  isCopied,
  onCopy,
  emptyLabel
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Top Accent Gradient Strip */}
      <div className={`h-1 w-full bg-gradient-to-r ${accentClass}`} />

      {/* Card Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/40 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ring-1 ring-inset flex items-center justify-center shrink-0 ${iconBgClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md ring-1 ring-inset font-bold ${badgeClass}`}>
                  {badge}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5 tabular-nums">
                {totalCount} txns &bull; Total:{' '}
                <span className="text-slate-900 font-bold">{totalFormatted}</span>
              </p>
            </div>
          </div>

          {/* Icon-Only Copy Button */}
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center justify-center p-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-all shadow-sm cursor-pointer active:scale-95 shrink-0"
            title={`Copy Yesterday ${title} Transaction list`}
            aria-label={`Copy ${title} List`}
          >
            {isCopied ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Filter Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter by account, party, or amount..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white border border-slate-200/90 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-sm"
            aria-label={`Search ${title} transactions`}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label={`Clear ${title} search`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-100">
        {transactions.length === 0 ? (
          <div className="text-center py-14 px-4 text-slate-400 text-xs sm:text-sm">
            {totalCount === 0 ? emptyLabel : 'No transactions match your filter'}
          </div>
        ) : (
          transactions.map((tx) => (
            <div 
              key={`${sectionKey}-${tx.index}`}
              className="group flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-slate-50/90 transition-colors [content-visibility:auto] [contain-intrinsic-size:58px]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 text-right text-xs font-mono text-slate-400 font-semibold tabular-nums shrink-0">
                  {String(tx.index).padStart(2, '0')}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-900 text-white tracking-wider shrink-0">
                  {tx.account}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {tx.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/80 shrink-0">
                      {tx.bank}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate">
                      {tx.file}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 ml-3">
                <span className={`inline-block px-3 py-1 rounded-lg text-xs font-mono font-bold ring-1 ring-inset tabular-nums ${amountClass}`}>
                  {tx.short}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function TransactionPanel({
  results,
  sendSearch,
  onSendSearchChange,
  recvSearch,
  onRecvSearchChange,
  filteredSend = [],
  filteredRecv = [],
  copiedSection,
  onCopySection
}) {
  if (!results) return null;

  const buildCopyText = (header, search, filtered, sectionData) => {
    const lines = (search && filtered.length < sectionData.transactions.length)
      ? filtered.map(t => t.line_text).join('\n')
      : (sectionData.text || sectionData.transactions.map(t => t.line_text).join('\n'));
    return lines ? `${header}\n\n${lines}` : '';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LedgerCard
          sectionKey="send"
          title="Send"
          badge="Dr"
          accentClass="from-rose-500 via-pink-500 to-orange-400"
          iconBgClass="bg-rose-50 text-rose-600 ring-rose-600/15"
          badgeClass="bg-rose-50 text-rose-700 ring-rose-600/15"
          amountClass="bg-rose-50 text-rose-700 ring-rose-600/15"
          Icon={ArrowUpRight}
          totalCount={results.send.count}
          totalFormatted={results.send.total_formatted}
          transactions={filteredSend}
          searchValue={sendSearch}
          onSearchChange={onSendSearchChange}
          isCopied={copiedSection === 'send'}
          onCopy={() => onCopySection(
            buildCopyText('Yesterday Send Transaction', sendSearch, filteredSend, results.send),
            'send',
            'Send List'
          )}
          emptyLabel="No debit transactions found"
        />

        <LedgerCard
          sectionKey="received"
          title="Received"
          badge="Cr"
          accentClass="from-emerald-500 via-teal-500 to-amber-400"
          iconBgClass="bg-emerald-50 text-emerald-600 ring-emerald-600/15"
          badgeClass="bg-emerald-50 text-emerald-700 ring-emerald-600/15"
          amountClass="bg-emerald-50 text-emerald-700 ring-emerald-600/15"
          Icon={ArrowDownLeft}
          totalCount={results.received.count}
          totalFormatted={results.received.total_formatted}
          transactions={filteredRecv}
          searchValue={recvSearch}
          onSearchChange={onRecvSearchChange}
          isCopied={copiedSection === 'received'}
          onCopy={() => onCopySection(
            buildCopyText('Yesterday Received Transaction', recvSearch, filteredRecv, results.received),
            'received',
            'Received List'
          )}
          emptyLabel="No credit transactions found"
        />
      </div>
    </div>
  );
}
