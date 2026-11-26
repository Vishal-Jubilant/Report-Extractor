import React from 'react';
import {
  Search,
  Copy,
  Check
} from 'lucide-react';

function buildCopyText(header, searchQuery, filteredList, sectionData) {
  const fullList = sectionData?.transactions || [];
  const lines = (searchQuery && filteredList.length < fullList.length)
    ? filteredList.map((t) => t.line_text).join('\n')
    : (sectionData?.text || fullList.map((t) => t.line_text).join('\n'));

  return lines ? `${header}\n\n${lines}` : '';
}

function TransactionCard({
  sectionKey,
  title,
  badge,
  dotClass,
  badgeClass,
  amountClass,
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
    <div className="flex flex-col rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="p-3.5 2xl:p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`flex h-2.5 w-2.5 rounded-full shrink-0 ${dotClass}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm xl:text-base font-bold text-slate-900 tracking-tight">{title}</h2>
                <span className={`text-[11px] xl:text-xs font-mono px-2 py-0.5 rounded border font-semibold ${badgeClass}`}>
                  {badge}
                </span>
              </div>
              <p className="text-[11px] xl:text-xs text-slate-500 font-mono mt-0.5 truncate">
                {totalCount} transactions &bull; Total:{' '}
                <span className="text-slate-900 font-bold">{totalFormatted}</span>
              </p>
            </div>
          </div>

          {/* 1-Click Icon-Only Copy Button */}
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center justify-center p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm cursor-pointer active:scale-95 shrink-0"
            title={`Copy Yesterday ${title} Transaction list`}
            aria-label={`Copy ${title} List`}
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-2.5 relative">
          <Search className="w-3.5 h-3.5 xl:w-4 xl:h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search account, party or amount..."
            className="w-full pl-8 xl:pl-9 pr-4 py-1.5 xl:py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all"
            aria-label={`Search ${title} transactions`}
          />
        </div>
      </div>

      {/* Transactions List */}
      <div className="max-h-[48vh] min-h-[220px] 2xl:max-h-[520px] overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            {totalCount === 0 ? emptyLabel : 'No matches found'}
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={`${sectionKey}-${tx.index}`}
              className="group flex items-center justify-between px-3.5 py-2.5 2xl:px-4 2xl:py-3 border-b border-slate-100 hover:bg-slate-50/80 transition-colors [content-visibility:auto] [contain-intrinsic-size:48px]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 xl:w-6 text-center text-xs font-mono text-slate-400 font-semibold shrink-0">
                  {tx.index}.
                </span>
                <span className="px-1.5 xl:px-2 py-0.5 rounded text-[11px] xl:text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                  {tx.account}
                </span>
                <div className="min-w-0">
                  <p className="text-xs xl:text-sm font-semibold text-slate-800 truncate">
                    {tx.name}
                  </p>
                  <p className="text-[11px] xl:text-xs text-slate-400 truncate mt-0.5">
                    {tx.bank} &bull; {tx.file}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 ml-2.5">
                <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] xl:text-xs font-mono font-bold border ${amountClass}`}>
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

  return (
    <div className="space-y-6">
      {/* Dual Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TransactionCard
          sectionKey="send"
          title="Send"
          badge="Dr"
          dotClass="bg-rose-500"
          badgeClass="bg-rose-50 text-rose-700 border-rose-200"
          amountClass="bg-rose-50 text-rose-700 border-rose-200/80"
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
          emptyLabel="No debit transactions"
        />

        <TransactionCard
          sectionKey="received"
          title="Received"
          badge="Cr"
          dotClass="bg-amber-500"
          badgeClass="bg-amber-50 text-amber-800 border-amber-200"
          amountClass="bg-amber-50 text-amber-800 border-amber-200/80"
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
          emptyLabel="No credit transactions"
        />
      </div>
    </div>
  );
}
