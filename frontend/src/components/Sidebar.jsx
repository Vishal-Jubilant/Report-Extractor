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
    <aside className="relative flex flex-col w-64 md:w-72 h-full bg-gradient-to-b from-[#1f242e] via-[#1a1e27] to-[#161922] p-5 border-r border-white/[0.1] shrink-0 select-none overflow-hidden">

      {/* Brand Header */}
      <div className="relative flex items-center gap-3.5 px-2 py-2.5 mb-6 pb-5 border-b border-white/[0.1]">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.1] border border-white/20 backdrop-blur-xl text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_8px_20px_rgba(0,0,0,0.4)]">
          <ArrowLeftRight className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-extrabold tracking-tight text-base text-white">
            RTGS<span className="font-light italic text-zinc-400 ml-0.5">FLUX</span>
          </h1>
          <p className="text-[11px] text-zinc-400 font-medium tracking-wide">Statement Engine</p>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="relative space-y-2">
        <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.18em] mb-2.5">
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
                  ? 'bg-white/[0.11] backdrop-blur-xl text-white border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),0_10px_28px_rgba(0,0,0,0.4)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08]'
              }`}
            >
              <div className={`p-2 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-white text-zinc-950 shadow-sm' 
                  : 'bg-white/[0.05] border border-white/[0.08] text-zinc-400 group-hover:text-white group-hover:bg-white/[0.1]'
              }`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold tracking-tight truncate">
                  {item.label}
                </p>
                <p className={`text-xs truncate ${isActive ? 'text-zinc-300' : 'text-zinc-500 group-hover:text-zinc-400'}`}>
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
