import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  const [returnSearch, setReturnSearch] = useState('');
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
    setResults(null);
    setSendSearch('');
    setRecvSearch('');
    setReturnSearch('');
    setCopiedSection(null);
  };

  const clearAll = () => {
    setFiles([]);
    setResults(null);
    setSendSearch('');
    setRecvSearch('');
    setReturnSearch('');
    setCopiedSection(null);
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
        const missingEnts = (preData.enterprises || []).filter(
          e => e.missing_banks && e.missing_banks.length > 0
        );
        const notInGroupFiles = preData.not_in_group_files || [];
        if (missingEnts.length > 0 || notInGroupFiles.length > 0) {
          setWarningData({
            enterprises: missingEnts,
            notInGroupFiles,
            files: preData.files || [],
          });
          setShowWarningModal(true);
          setIsProcessing(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Precheck error, continuing to extract:', err);
    }

    // No missing bank files, proceed directly with extraction
    await executeExtract();
  };

  // Copy Clipboard Helper (supports both HTTPS/localhost and HTTP LAN IPs)
  const copyToClipboard = async (text, sectionKey, label) => {
    if (!text) return;

    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      } finally {
        document.body.removeChild(textarea);
      }
    }

    if (copied) {
      setCopiedSection(sectionKey);
      notifyFn(`${label} copied to clipboard!`, 'success');
      setTimeout(() => {
        setCopiedSection(null);
      }, 2000);
    } else {
      notifyFn(`Failed to copy ${label}. Please check browser permissions.`, 'error');
    }
  };

  // Optimized Memoized Transaction Filtering
  const filterTransactions = useCallback((txs, search) => {
    if (!txs || txs.length === 0) return [];
    const query = search.trim().toLowerCase();
    if (!query) return txs;
    return txs.filter(item =>
      (item.name && item.name.toLowerCase().includes(query)) ||
      (item.account && item.account.toLowerCase().includes(query)) ||
      (item.short && item.short.toLowerCase().includes(query))
    );
  }, []);

  const filteredSend = useMemo(
    () => filterTransactions(results?.send?.transactions, sendSearch),
    [results?.send?.transactions, sendSearch, filterTransactions]
  );

  const filteredRecv = useMemo(
    () => filterTransactions(results?.received?.transactions, recvSearch),
    [results?.received?.transactions, recvSearch, filterTransactions]
  );

  const filteredReturn = useMemo(
    () => filterTransactions(results?.returns?.transactions, returnSearch),
    [results?.returns?.transactions, returnSearch, filterTransactions]
  );

  return (
    <div className="flex-1 p-4 sm:p-5 lg:p-6 2xl:p-8 space-y-4 lg:space-y-5 2xl:space-y-6 w-full h-full overflow-y-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 lg:pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-lg sm:text-xl 2xl:text-2xl font-bold tracking-tight text-slate-900">
            Statement Extractor
          </h1>
          <p className="text-xs 2xl:text-sm text-slate-500 mt-0.5">
            Parse bank statements. Automatically identifies holder name and maps to account codes.
          </p>
        </div>
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
        canCopyAll={Boolean(results?.combined_text) && !isProcessing}
        isCopiedAll={copiedSection === 'combined'}
        onCopyAll={() => copyToClipboard(results?.combined_text, 'combined', 'Combined List')}
        formatFileSize={formatFileSize}
      />

      {/* Output Split View: Send, Received & Return */}
      {results && (
        <TransactionPanel
          results={results}
          sendSearch={sendSearch}
          onSendSearchChange={setSendSearch}
          recvSearch={recvSearch}
          onRecvSearchChange={setRecvSearch}
          returnSearch={returnSearch}
          onReturnSearchChange={setReturnSearch}
          filteredSend={filteredSend}
          filteredRecv={filteredRecv}
          filteredReturn={filteredReturn}
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
