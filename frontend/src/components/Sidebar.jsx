import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  Layers, 
  FileSpreadsheet,
  ArrowLeftRight,
  Menu,
  X
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    {
      id: 'collection-report',
      label: 'Collection Report',
      icon: FileSpreadsheet,
    },
    {
      id: 'extractor',
      label: 'Daily Payment Report',
      icon: Layers,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: SlidersHorizontal,
    },
  ];

  const handleSelect = (id) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  const navContent = (
    <>
      {/* Brand Header */}
      <div className="flex items-center justify-between gap-2.5 px-2 py-1.5 mb-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-slate-900 text-white font-bold shadow-xs shrink-0">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold tracking-tight text-sm xl:text-base text-slate-900 truncate">
              RTGS<span className="font-normal text-slate-500">FLUX</span>
            </h1>
            <p className="text-[11px] xl:text-xs text-slate-500 font-medium truncate">Statement Engine</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Section */}
      <div className="space-y-1">
        <p className="px-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          Workspace
        </p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`group flex items-center w-full gap-2.5 xl:gap-3 px-2.5 xl:px-3.5 py-2.5 xl:py-3 rounded-xl font-medium transition-all text-left cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <div className={`p-1 xl:p-1.5 rounded-lg transition-colors shrink-0 ${
                isActive 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-transparent text-slate-500 group-hover:text-slate-800'
              }`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs xl:text-sm font-semibold tracking-tight truncate">
                  {item.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile / Narrow-Window Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-[#f8f9fb] border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 text-white font-bold">
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold tracking-tight text-sm text-slate-900">
            RTGS<span className="font-normal text-slate-500">FLUX</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex flex-col w-64 max-w-[80vw] h-full bg-[#f8f9fb] p-4 border-r border-slate-200 select-none shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop / Laptop Docked Sidebar */}
      <aside className="hidden md:flex relative flex-col w-52 lg:w-56 xl:w-64 2xl:w-72 h-full bg-[#f8f9fb] p-3.5 lg:p-4 2xl:p-5 border-r border-slate-200 shrink-0 select-none">
        {navContent}
      </aside>
    </>
  );
}
