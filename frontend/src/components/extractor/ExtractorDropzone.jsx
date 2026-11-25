import React from 'react';
import { 
  UploadCloud, 
  FileText, 
  FileSpreadsheet, 
  Trash2, 
  Plus, 
  ArrowRight, 
  RefreshCw,
  X
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
  const hasFiles = files.length > 0;

  return (
    <div className="space-y-4">
      {/* White Frosted Glassmorphism Dropzone */}
      <div 
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onBrowseClick}
        className={`group glass-panel relative overflow-hidden flex flex-col items-center justify-center rounded-3xl transition-all duration-200 cursor-pointer ${
          hasFiles ? 'p-3' : 'p-4'
        } ${
          isDragging 
            ? 'ring-2 ring-indigo-500/60 scale-[0.995] bg-indigo-50/40' 
            : 'hover:shadow-[0_16px_42px_-10px_rgba(15,23,42,0.12)]'
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

        {/* Inner dashed frosted frame */}
        <div className={`w-full rounded-2xl border border-dashed transition-colors flex flex-col items-center justify-center ${
          hasFiles ? 'py-6 px-6' : 'min-h-[240px] py-12 px-8'
        } ${
          isDragging ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-300/90 group-hover:border-indigo-400/80'
        }`}>
          <div className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 transition-transform duration-200 group-hover:scale-105 ${
            hasFiles ? 'w-11 h-11 mb-3' : 'w-16 h-16 mb-5'
          }`}>
            <UploadCloud className={hasFiles ? 'w-5 h-5' : 'w-7 h-7'} />
          </div>

          <p className={`relative font-semibold text-slate-900 tracking-tight text-center ${
            hasFiles ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'
          }`}>
            Drop bank statements here, or{' '}
            <span className="font-light italic text-indigo-600 underline decoration-indigo-300 underline-offset-4 group-hover:text-indigo-700 group-hover:decoration-indigo-500">
              browse files
            </span>
          </p>

          {!hasFiles && (
            <p className="relative text-xs sm:text-sm text-slate-500 mt-2 text-center">
              Supports ICICI, Kotak, Axis, IDBI &amp; IDFC account statements
            </p>
          )}

          <div className={`relative flex flex-wrap items-center justify-center gap-2.5 ${hasFiles ? 'mt-3.5' : 'mt-6'}`}>
            {[
              { ext: 'PDF', dot: 'bg-rose-500' },
              { ext: 'CSV', dot: 'bg-emerald-500' },
              { ext: 'XLSX', dot: 'bg-emerald-500' },
              { ext: 'XLS', dot: 'bg-emerald-500' },
            ].map((item) => (
              <span 
                key={item.ext}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold bg-white/80 border border-slate-200/80 text-slate-600 shadow-sm backdrop-blur-md"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                .{item.ext}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Staged Files Panel */}
      {hasFiles && (
        <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/70">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-2 rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/15 font-bold text-xs font-mono">
                {files.length}
              </span>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-[0.16em]">
                Staged Statements
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBrowseClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white/80 hover:bg-white border border-slate-200/90 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                Add More
              </button>
              <button 
                type="button"
                onClick={onClearAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
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
                  className="glass-tile group relative flex items-center justify-between p-3.5 rounded-2xl hover:border-indigo-200 hover:bg-white transition-all duration-150"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${
                      isPdf 
                        ? 'bg-rose-50 text-rose-600 border-rose-100' 
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
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
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {formatFileSize(file.size)} &bull; <span className="uppercase font-semibold text-slate-600">{ext.replace('.', '')}</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemoveFile(idx); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                    title="Remove file"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Proceed Action Bar */}
          <div className="pt-4 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-slate-500">
              Statements are staged locally. Click <span className="font-semibold text-slate-800">Proceed</span> to extract &amp; verify.
            </p>
            <button
              type="button"
              onClick={onProceed}
              disabled={isProcessing}
              className={`inline-flex items-center justify-center gap-2.5 px-9 py-3 rounded-xl font-bold text-sm sm:text-base tracking-wide transition-all duration-150 cursor-pointer ${
                isProcessing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-lg shadow-slate-900/15 active:scale-[0.98]'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Proceed</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
