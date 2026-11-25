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
      {/* Modern Upload Dropzone Card */}
      <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-2.5">
        <div 
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={onBrowseClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBrowseClick();
            }
          }}
          className={`group relative overflow-hidden flex flex-col items-center justify-center min-h-[250px] py-12 px-8 rounded-2xl border border-dashed transition-all duration-200 cursor-pointer ${
            isDragging 
              ? 'border-indigo-500 bg-indigo-50/40 ring-4 ring-indigo-500/10 scale-[0.995]' 
              : 'border-slate-300/90 bg-slate-50/40 hover:bg-slate-50/80 hover:border-slate-400'
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
            multiple 
            accept=".pdf,.csv,.xlsx,.xls" 
            onChange={onFileChange} 
            className="hidden" 
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
            {isDragging ? 'Drop your bank statements here' : 'Upload Bank Statements'}
          </h2>
          <p className="relative z-10 text-xs sm:text-sm text-slate-500 mt-1 text-center max-w-md">
            Drag and drop your bank statements here, or select files from your computer
          </p>

          <div className="relative z-10 flex items-center justify-center mt-5">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-sm group-hover:border-slate-300 group-hover:shadow transition-all">
              Browse Statement Files
            </span>
          </div>
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
