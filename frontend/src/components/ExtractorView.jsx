import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Download 
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ExtractorDropzone from './extractor/ExtractorDropzone';
import MissingBanksModal from './extractor/MissingBanksModal';
import TransactionPanel from './extractor/TransactionPanel';

export default function ExtractorView({ onNotify, onNavigateToSettings, isActive = true }) {
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
  const [copiedSection, setCopiedSection] = useState(null);

  const fileInputRef = useRef(null);

  // Fetch available enterprises and their required banks
  const fetchEnterprises = useCallback(async () => {
    try {
      const res = await fetch('/api/enterprises');
      if (res.ok) {
        const data = await res.json();
        setEnterprises(data.enterprises || []);
      }
    } catch (err) {
      console.error('Failed to load enterprises:', err);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchEnterprises();
    }
  }, [isActive, fetchEnterprises]);

  // File Upload Handlers
  const addFiles = useCallback((newFiles) => {
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
  }, [notifyFn]);

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

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
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

  // Extraction execution
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
              type="button"
              onClick={() => copyToClipboard(results.combined_text, 'combined', 'Combined List')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-2xs cursor-pointer"
            >
              {copiedSection === 'combined' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              Copy All Text
            </button>
            <button
              type="button"
              onClick={() => downloadText('send_received.txt', results.combined_text)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              .TXT
            </button>
            <button
              type="button"
              onClick={downloadCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              .CSV
            </button>
          </div>
        )}
      </div>

      {/* Upload Dropzone & File Management */}
      <ExtractorDropzone
        files={files}
        isDragging={isDragging}
        isProcessing={isProcessing}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onBrowseClick={() => fileInputRef.current?.click()}
        onRemoveFile={removeFile}
        onClearAll={clearAll}
        onProceed={handleProceedClick}
        formatFileSize={formatFileSize}
      />

      {/* Output Dual Split View: Send vs Received */}
      {results && (
        <TransactionPanel
          results={results}
          sendSearch={sendSearch}
          onSendSearchChange={setSendSearch}
          recvSearch={recvSearch}
          onRecvSearchChange={setRecvSearch}
          filteredSend={filteredSend}
          filteredRecv={filteredRecv}
          copiedSection={copiedSection}
          onCopySection={copyToClipboard}
        />
      )}

      {/* Missing Bank Statements Warning Modal */}
      <MissingBanksModal
        isOpen={showWarningModal}
        warningData={warningData}
        onClose={() => setShowWarningModal(false)}
        onProceedAnyway={executeExtract}
      />

    </div>
  );
}
