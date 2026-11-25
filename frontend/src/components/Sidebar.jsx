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
      icon: Layers,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: SlidersHorizontal,
    },
  ];

  return (
    <aside className="relative flex flex-col w-64 md:w-72 h-full bg-[#f8f9fb] p-5 border-r border-slate-200 shrink-0 select-none">
      
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-2 py-2 mb-5 pb-5 border-b border-slate-200/80">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 text-white font-bold shadow-xs">
          <ArrowLeftRight className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-bold tracking-tight text-base text-slate-900">
            RTGS<span className="font-normal text-slate-500">FLUX</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">Statement Engine</p>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="space-y-1.5">
        <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Workspace
        </p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`group flex items-center w-full gap-3.5 px-3.5 py-3 rounded-xl font-medium transition-all text-left cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-transparent text-slate-500 group-hover:text-slate-800'
              }`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold tracking-tight truncate">
                  {item.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

    </aside>
  );
}
