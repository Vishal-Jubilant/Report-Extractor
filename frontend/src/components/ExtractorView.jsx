import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  UploadCloud, 
  FileText, 
  FileSpreadsheet, 
  Trash2, 
  Copy, 
  Check, 
  Download, 
  Search, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  RefreshCw,
  Building2,
  ExternalLink,
  Plus,
  ArrowRight,
  X
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function ExtractorView({ onNotify, onNavigateToSettings }) {
  const { notify } = useToast();
  const notifyFn = onNotify || notify;

  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);

  // Enterprise & Requirements State
  const [enterprises, setEnterprises] = useState([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState('ALL');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningData, setWarningData] = useState(null);

  // Filters & State
  const [sendSearch, setSendSearch] = useState('');
  const [recvSearch, setRecvSearch] = useState('');
  const [expandedFiles, setExpandedFiles] = useState({});
  const [copiedSection, setCopiedSection] = useState(null);

  const fileInputRef = useRef(null);

  // Fetch available enterprises and their required banks
  const fetchEnterprises = async () => {
    try {
      const res = await fetch('/api/enterprises');
      if (res.ok) {
        const data = await res.json();
        setEnterprises(data.enterprises || []);
      }
    } catch (err) {
      console.error('Failed to load enterprises:', err);
    }
  };

  useEffect(() => {
    fetchEnterprises();
  }, []);

  // File Upload Handlers
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = (newFiles) => {
    const validExtensions = ['.pdf', '.csv', '.xlsx', '.xls'];
    const validFiles = newFiles.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return validExtensions.includes(ext);
    });

    if (validFiles.length < newFiles.length) {
      notifyFn('Some files were skipped. Only PDF, CSV, XLSX, and XLS are supported.', 'warning');
    }

    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const filtered = validFiles.filter(f => !existingNames.has(f.name));
      return [...prev, ...filtered];
    });
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setResults(null);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Actual extraction call
  const executeExtract = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setShowWarningModal(false);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Extraction failed');
      }

      const data = await response.json();
      setResults(data);
      notifyFn(`Processed ${files.length} statement(s) successfully!`, 'success');
    } catch (err) {
      console.error(err);
      notifyFn(err.message || 'Extraction failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Pre-check triggered when user clicks Proceed
  const handleProceedClick = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      if (selectedEnterprise && selectedEnterprise !== 'ALL') {
        formData.append('selected_enterprise', selectedEnterprise);
      }

      const preRes = await fetch('/api/precheck', {
        method: 'POST',
        body: formData,
      });

      if (preRes.ok) {
        const preData = await preRes.json();
        if (preData.has_missing && preData.enterprises?.length > 0) {
          const missingEnts = preData.enterprises.filter(e => e.missing_banks && e.missing_banks.length > 0);
          if (missingEnts.length > 0) {
            setWarningData({
              enterprises: missingEnts,
              files: preData.files || [],
            });
            setShowWarningModal(true);
            setIsProcessing(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Precheck error, continuing to extract:', err);
    }

    // No missing bank files, proceed directly with extraction
    await executeExtract();
  };

  // Copy Clipboard Helper
  const copyToClipboard = (text, sectionKey, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    notifyFn(`${label} copied to clipboard!`, 'success');
    setTimeout(() => {
      setCopiedSection(null);
    }, 2000);
  };

  // Download Helpers
  const downloadText = (filename, content) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    if (!results) return;
    const allRows = [
      ...results.send.transactions,
      ...results.received.transactions
    ];
    if (allRows.length === 0) return;

    const headers = ["Account", "Bank", "Name", "Raw Name", "Amount", "Short", "Type", "Status", "File"];
    const csvContent = [
      headers.join(","),
      ...allRows.map(r => [
        `"${r.account}"`,
        `"${r.bank}"`,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.raw_name || '').replace(/"/g, '""')}"`,
        `"${r.amount}"`,
        `"${r.short}"`,
        `"${r.type}"`,
        `"${r.status}"`,
        `"${r.file}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleFileAccordion = (idx) => {
    setExpandedFiles(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Optimized Memoized Transaction Filtering
  const sendSearchLower = sendSearch.trim().toLowerCase();
  const filteredSend = useMemo(() => {
    const txs = results?.send?.transactions;
    if (!txs || txs.length === 0) return [];
    if (!sendSearchLower) return txs;
    return txs.filter(item => 
      (item.name && item.name.toLowerCase().includes(sendSearchLower)) ||
      (item.account && item.account.toLowerCase().includes(sendSearchLower)) ||
      (item.short && item.short.toLowerCase().includes(sendSearchLower))
    );
  }, [results?.send?.transactions, sendSearchLower]);

  const recvSearchLower = recvSearch.trim().toLowerCase();
  const filteredRecv = useMemo(() => {
    const txs = results?.received?.transactions;
    if (!txs || txs.length === 0) return [];
    if (!recvSearchLower) return txs;
    return txs.filter(item => 
      (item.name && item.name.toLowerCase().includes(recvSearchLower)) ||
      (item.account && item.account.toLowerCase().includes(recvSearchLower)) ||
      (item.short && item.short.toLowerCase().includes(recvSearchLower))
    );
  }, [results?.received?.transactions, recvSearchLower]);

  const currentSelectedEnt = enterprises.find(e => e.code === selectedEnterprise);

  return (
    <div className="flex-1 p-8 space-y-6 w-full h-full overflow-y-auto">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Statement Extractor
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Parse ICICI, Kotak, Axis, IDBI &amp; IDFC statements. Automatically identifies holder name and maps to account codes.
          </p>
        </div>

        {results && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => copyToClipboard(results.combined_text, 'combined', 'Combined List')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-2xs cursor-pointer"
            >
              {copiedSection === 'combined' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              Copy All Text
            </button>
            <button
              onClick={() => downloadText('send_received.txt', results.combined_text)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              .TXT
            </button>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              .CSV
            </button>
          </div>
        )}
      </div>

      {/* Target Enterprise Selector & Requirements Banner */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/90 border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0">
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
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {currentSelectedEnt.banks?.length || 0} Banks Required
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <select
              value={selectedEnterprise}
              onChange={(e) => setSelectedEnterprise(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">⚡ Auto-Detect Enterprise</option>
              {enterprises.map(ent => (
                <option key={ent.code} value={ent.code}>
                  🏢 {ent.name} ({ent.code})
                </option>
              ))}
            </select>
            <button
              onClick={onNavigateToSettings}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors shadow-2xs cursor-pointer shrink-0"
              title="Configure Enterprise Bank Mappings in Settings"
            >
              Edit Banks
            </button>
          </div>
        </div>

        {/* Expected Banks Live Alert Pill */}
        {currentSelectedEnt && currentSelectedEnt.banks && (
          <div className="px-4 py-3 rounded-xl bg-indigo-50/60 border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-indigo-950">Required Statements for {currentSelectedEnt.code}:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentSelectedEnt.banks.map(b => (
                  <span key={b} className="px-2.5 py-0.5 rounded-lg font-mono font-bold bg-white text-indigo-700 border border-indigo-200 shadow-2xs">
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

      {/* Upload Dropzone */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center min-h-[250px] py-12 px-8 rounded-2xl border-2 border-dashed transition-all duration-150 cursor-pointer bg-slate-50/50 ${
          isDragging 
            ? 'border-slate-900 bg-slate-100 scale-[0.995]' 
            : 'border-slate-300 hover:border-slate-800 hover:bg-white'
        }`}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          multiple 
          accept=".pdf,.csv,.xlsx,.xls" 
          onChange={handleFileChange} 
          className="hidden" 
        />

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-800 shadow-xs mb-3.5">
          <UploadCloud className="w-8 h-8" />
        </div>

        <p className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
          Drop bank statements here, or <span className="text-slate-900 underline underline-offset-4 font-bold">browse files</span>
        </p>
        <p className="text-xs text-slate-500 mt-1.5">
          Compatible with ICICI, Kotak, Axis, IDBI, and IDFC statements
        </p>

        <div className="flex items-center gap-2 mt-4">
          {['.PDF', '.CSV', '.XLSX', '.XLS'].map((format) => (
            <span 
              key={format}
              className="px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs"
            >
              {format}
            </span>
          ))}
        </div>
      </div>

      {/* Uploaded Files Section & Proceed Button */}
      {files.length > 0 && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-900 font-bold text-xs font-mono">
                {files.length}
              </span>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Uploaded Statements
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add More
              </button>
              <span className="text-slate-300">|</span>
              <button 
                type="button"
                onClick={clearAll}
                className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Clear All
              </button>
            </div>
          </div>

          {/* Files Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {files.map((file, idx) => {
              const ext = '.' + file.name.split('.').pop().toLowerCase();
              const isPdf = ext === '.pdf';
              return (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 shrink-0">
                      {isPdf ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[12px] text-slate-500 font-mono mt-0.5">
                        {formatFileSize(file.size)} &bull; <span className="uppercase font-semibold">{ext.replace('.', '')}</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Proceed Button Row */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-sm text-slate-600">
              Ready to parse. Click <strong className="text-slate-900">Proceed</strong> to execute extraction.
            </span>
            <button
              onClick={handleProceedClick}
              disabled={isProcessing}
              className={`flex items-center justify-center gap-3 px-11 py-3.5 rounded-xl font-bold text-base tracking-wide transition-all shadow-md cursor-pointer ${
                isProcessing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-98'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Proceed</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Output Dual Split View: Send vs Received */}
      {results && (
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
                    onClick={() => copyToClipboard(results.send.text, 'send', 'Send List')}
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
                    onChange={(e) => setSendSearch(e.target.value)}
                    placeholder="Search account, party or amount..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all"
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
                    onClick={() => copyToClipboard(results.received.text, 'received', 'Received List')}
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
                    onChange={(e) => setRecvSearch(e.target.value)}
                    placeholder="Search account, party or amount..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all"
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
                      onClick={() => toggleFileAccordion(idx)}
                      className="flex items-center justify-between p-3.5 cursor-pointer"
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
      )}

      {/* Missing Bank Statements Warning Modal */}
      {showWarningModal && warningData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-amber-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-start gap-3.5 border-b border-slate-100 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Missing Bank Statement Warning
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Expected bank statement(s) are missing from the uploaded files for this enterprise.
                </p>
              </div>
              <button 
                onClick={() => setShowWarningModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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
              <strong>Notice:</strong> Proceeding without uploading all required bank statements may result in incomplete transaction reconciliation. Click <strong>Okay / Proceed Anyway</strong> if you want to proceed.
            </p>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Upload Missing Files
              </button>
              <button
                type="button"
                onClick={executeExtract}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200 transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                Okay, Proceed Anyway
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
