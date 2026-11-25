import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileArchive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function CollectionReportView() {
  const { notify } = useToast();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const handleClear = () => {
    setSelectedFile(null);
    setLastResult(null);
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerZipDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSelectFile = useCallback((file) => {
    if (!file || isGenerating) return;

    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      const msg = 'Only Excel files (.xlsx or .xls) are supported.';
      setErrorMessage(msg);
      notify(msg, 'warning');
      return;
    }

    setSelectedFile(file);
    setErrorMessage('');
    setLastResult(null);
  }, [isGenerating, notify]);

  const handleProceed = useCallback(async () => {
    if (!selectedFile || isGenerating) return;

    setErrorMessage('');
    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/collection-report/generate', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errDetail = 'Failed to generate collection report ZIP.';
        try {
          const errJson = await res.json();
          if (errJson?.detail) errDetail = errJson.detail;
        } catch {
          // Ignore non-JSON error body
        }
        throw new Error(errDetail);
      }

      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const hrs24 = now.getHours();
      const ampm = hrs24 >= 12 ? 'PM' : 'AM';
      const hrs12 = pad(hrs24 % 12 || 12);
      const fallbackZipName = `Collection_Reports_${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${hrs12}-${pad(now.getMinutes())}_${ampm}.zip`;
      const zipFilename = match?.[1] || fallbackZipName;

      const zipBlob = await res.blob();
      triggerZipDownload(zipBlob, zipFilename);

      setLastResult({
        sourceFile: selectedFile.name,
        zipFilename,
        blob: zipBlob,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      notify(`Downloaded ${zipFilename}`, 'success');
    } catch (err) {
      const msg = err.message || 'Error generating collection report.';
      setErrorMessage(msg);
      notify(msg, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedFile, isGenerating, notify]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isGenerating) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const selectedExt = selectedFile
    ? (selectedFile.name.split('.').pop() || '').toUpperCase()
    : '';

  return (
    <div className="flex-1 p-8 space-y-6 w-full h-full overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Collection Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload your collection Excel sheet and click Proceed to generate and download Branch, Consultant &amp; Collection Executive PDF reports as a ZIP archive.
          </p>
        </div>
      </div>

      {/* Modern Excel Dropzone Card */}
      <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-2.5">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isGenerating && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isGenerating) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`group relative overflow-hidden flex flex-col items-center justify-center min-h-[250px] py-12 px-8 rounded-2xl border border-dashed transition-all duration-200 ${
            isGenerating
              ? 'border-slate-200 bg-slate-50/70 cursor-wait opacity-85'
              : isDragging
                ? 'border-indigo-500 bg-indigo-50/40 ring-4 ring-indigo-500/10 scale-[0.995] cursor-pointer'
                : 'border-slate-300/90 bg-slate-50/40 hover:bg-slate-50/80 hover:border-slate-400 cursor-pointer'
          }`}
        >
          {/* Subtle Architectural Dot Pattern */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-45 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_80%)]"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            disabled={isGenerating}
          />

          {/* Modern Icon Badge */}
          <div className="relative z-10 mb-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-md ${
              isDragging
                ? 'bg-indigo-600 text-white shadow-indigo-500/25 scale-105'
                : 'bg-slate-900 text-white shadow-slate-900/15 group-hover:-translate-y-0.5 group-hover:shadow-lg'
            }`}>
              <UploadCloud className="w-6 h-6" />
            </div>
          </div>

          <h2 className="relative z-10 text-base sm:text-lg font-bold text-slate-900 tracking-tight text-center">
            {isDragging ? 'Drop your Excel sheet here' : 'Upload Collection Excel Sheet'}
          </h2>
          <p className="relative z-10 text-xs sm:text-sm text-slate-500 mt-1 text-center max-w-md">
            Drag and drop your file here, or select an Excel workbook from your computer
          </p>

          <div className="relative z-10 flex items-center justify-center mt-5">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-sm group-hover:border-slate-300 group-hover:shadow transition-all">
              Browse Excel File
            </span>
          </div>
        </div>
      </div>

      {/* Selected File & Proceed Card */}
      {selectedFile && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-900 font-bold text-xs font-mono">
                1
              </span>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Selected Excel File
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => !isGenerating && fileInputRef.current?.click()}
                disabled={isGenerating}
                className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Replace File
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleClear}
                disabled={isGenerating}
                className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1.5 font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Clear
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </p>
                <p className="text-[12px] text-slate-500 font-mono mt-0.5">
                  {formatBytes(selectedFile.size)} &bull; <span className="uppercase font-semibold">{selectedExt}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              disabled={isGenerating}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              title="Remove file"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Proceed Button Row */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-sm text-slate-600">
              Ready to generate PDFs. Click <strong className="text-slate-900">Proceed</strong> to download ZIP.
            </span>
            <button
              type="button"
              onClick={handleProceed}
              disabled={isGenerating}
              className={`flex items-center justify-center gap-3 px-11 py-3.5 rounded-xl font-bold text-base tracking-wide transition-all shadow-md cursor-pointer ${
                isGenerating
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-98'
              }`}
            >
              {isGenerating ? (
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

      {/* Validation / Processing Error Banner */}
      {errorMessage && (
        <div className="rounded-2xl bg-rose-50/80 border border-rose-200 p-5 flex items-start justify-between gap-4 text-rose-900 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-white border border-rose-200 text-rose-600 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-rose-950">Unable to generate collection report</p>
              <p className="text-xs text-rose-700 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-rose-200 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      )}

      {/* Compact Modern Generated Archive Card */}
      {lastResult && !errorMessage && (
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
              <FileArchive className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-900 truncate" title={lastResult.zipFilename}>
                  {lastResult.zipFilename}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Downloaded
                </span>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 truncate max-w-full">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{lastResult.sourceFile}</span>
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {lastResult.timestamp}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => triggerZipDownload(lastResult.blob, lastResult.zipFilename)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              Download Again
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
