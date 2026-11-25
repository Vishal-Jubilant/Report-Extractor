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
    <div className="glass-panel flex flex-col rounded-3xl overflow-hidden">
      {/* Subtle Top Luminous Hairline */}
      <div className={`h-[2px] w-full bg-gradient-to-r ${accentClass}`} />

      {/* Card Header */}
      <div className="p-4 sm:p-5 border-b border-white/[0.1] bg-white/[0.02] space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconBgClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border font-bold ${badgeClass}`}>
                  {badge}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5 tabular-nums">
                {totalCount} txns &bull; Total:{' '}
                <span className="text-white font-bold">{totalFormatted}</span>
              </p>
            </div>
          </div>

          {/* Icon-Only Copy Button */}
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center justify-center p-2.5 rounded-xl bg-white/[0.12] text-white border border-white/20 hover:bg-white hover:text-zinc-950 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] cursor-pointer active:scale-95 shrink-0"
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

        {/* Frosted Filter Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter by account, party, or amount..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-black/25 border border-white/[0.14] text-xs sm:text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-white/40 focus:bg-black/35 transition-all"
            aria-label={`Search ${title} transactions`}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              aria-label={`Clear ${title} search`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="max-h-[480px] overflow-y-auto divide-y divide-white/[0.08]">
        {transactions.length === 0 ? (
          <div className="text-center py-14 px-4 text-zinc-400 text-xs sm:text-sm">
            {totalCount === 0 ? emptyLabel : 'No transactions match your filter'}
          </div>
        ) : (
          transactions.map((tx) => (
            <div 
              key={`${sectionKey}-${tx.index}`}
              className="group flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-white/[0.05] transition-colors [content-visibility:auto] [contain-intrinsic-size:58px]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 text-right text-xs font-mono text-zinc-500 font-semibold tabular-nums shrink-0">
                  {String(tx.index).padStart(2, '0')}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-white/10 text-white border border-white/20 tracking-wider shrink-0">
                  {tx.account}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {tx.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/[0.07] text-zinc-300 border border-white/[0.12] shrink-0">
                      {tx.bank}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate">
                      {tx.file}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 ml-3">
                <span className={`inline-block px-3 py-1 rounded-lg text-xs font-mono font-bold border tabular-nums ${amountClass}`}>
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
          accentClass="from-rose-400/80 via-pink-400/70 to-transparent"
          iconBgClass="bg-rose-500/15 text-rose-300 border-rose-400/25"
          badgeClass="bg-rose-500/15 text-rose-300 border-rose-400/25"
          amountClass="bg-rose-500/15 text-rose-200 border-rose-400/25"
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
          accentClass="from-emerald-400/80 via-teal-400/70 to-transparent"
          iconBgClass="bg-emerald-500/15 text-emerald-300 border-emerald-400/25"
          badgeClass="bg-emerald-500/15 text-emerald-300 border-emerald-400/25"
          amountClass="bg-emerald-500/15 text-emerald-200 border-emerald-400/25"
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
