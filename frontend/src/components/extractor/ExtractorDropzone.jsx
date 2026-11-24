import React from 'react';
import { 
  UploadCloud, 
  FileText, 
  FileSpreadsheet, 
  Trash2, 
  Plus, 
  ArrowRight, 
  RefreshCw 
} from 'lucide-react';

export default function ExtractorDropzone({
  files = [],
  isDragging = false,
  isProcessing = false,
  fileInputRef,
  onFileChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onBrowseClick,
  onRemoveFile,
  onClearAll,
  onProceed,
  formatFileSize
}) {
  return (
    <div className="space-y-4">
      {/* Upload Dropzone */}
      <div 
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onBrowseClick}
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
          onChange={onFileChange} 
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
                onClick={onBrowseClick}
                className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add More
              </button>
              <span className="text-slate-300">|</span>
              <button 
                type="button"
                onClick={onClearAll}
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
                    onClick={(e) => { e.stopPropagation(); onRemoveFile(idx); }}
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
              type="button"
              onClick={onProceed}
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
    </div>
  );
}
