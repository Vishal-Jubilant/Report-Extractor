import React from 'react';
import { 
  SlidersHorizontal, 
  Layers, 
  ArrowLeftRight
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    {
      id: 'extractor',
      label: 'Extractor',
      subtitle: 'Statement Parser & Splitter',
      icon: Layers,
    },
    {
      id: 'settings',
      label: 'Settings',
      subtitle: 'Accounts, Rules & Codes',
      icon: SlidersHorizontal,
    },
  ];

  return (
    <aside className="relative flex flex-col w-64 md:w-72 h-full bg-white/75 backdrop-blur-2xl p-5 border-r border-slate-200/80 shadow-[4px_0_24px_-12px_rgba(15,23,42,0.06)] shrink-0 select-none overflow-hidden">
      {/* Brand Header */}
      <div className="relative flex items-center gap-3.5 px-2 py-2.5 mb-6 pb-5 border-b border-slate-200/80">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md shadow-slate-900/15">
          <ArrowLeftRight className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-extrabold tracking-tight text-base text-slate-900">
            RTGS<span className="font-light italic text-slate-500 ml-0.5">FLUX</span>
          </h1>
          <p className="text-[11px] text-slate-500 font-medium tracking-wide">Statement Engine</p>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="relative space-y-2">
        <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-2.5">
          Workspace
        </p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`group flex items-center w-full gap-3.5 px-3.5 py-3 rounded-xl font-medium transition-all duration-200 text-left cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-transparent hover:border-slate-200/80 hover:shadow-sm'
              }`}
            >
              <div className={`p-2 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-white/15 text-white' 
                  : 'bg-slate-100/90 text-slate-500 group-hover:text-slate-900 group-hover:bg-slate-200/70'
              }`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold tracking-tight truncate">
                  {item.label}
                </p>
                <p className={`text-xs truncate ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                  {item.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
