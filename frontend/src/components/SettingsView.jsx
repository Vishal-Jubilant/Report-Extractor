import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Check, 
  Key, 
  Building, 
  Building2, 
  Save,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Info
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function SettingsView({ onNotify }) {
  const { notify } = useToast();
  const notifyFn = onNotify || notify;

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enterprise Bank Mapping State
  const [enterprises, setEnterprises] = useState([]);
  const [supportedBanks, setSupportedBanks] = useState(["ICICI", "KOTAK", "AXIS", "IDBI", "IDFC"]);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [editingEnterpriseCode, setEditingEnterpriseCode] = useState(null); // null if adding, code string if editing
  const [entFormCode, setEntFormCode] = useState('');
  const [entFormName, setEntFormName] = useState('');
  const [entFormBanks, setEntFormBanks] = useState([]);
  const [customBankName, setCustomBankName] = useState('');
  const [enterpriseSearch, setEnterpriseSearch] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      setSettings(data);
      
      if (data.enterprise_banks) {
        setEnterprises(Object.values(data.enterprise_banks));
      }
      if (data.supported_banks && data.supported_banks.length > 0) {
        setSupportedBanks(data.supported_banks);
      }
    } catch (err) {
      console.error(err);
      notifyFn('Could not load settings from backend', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEnterprises = async () => {
    try {
      const res = await fetch('/api/enterprises');
      if (res.ok) {
        const data = await res.json();
        setEnterprises(data.enterprises || []);
        if (data.supported_banks) setSupportedBanks(data.supported_banks);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Close modal on Escape key press (Web Interface Guidelines compliance)
  useEffect(() => {
    if (!showEnterpriseModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowEnterpriseModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showEnterpriseModal]);

  // Open modal to Add Enterprise Mapping
  const openAddEnterpriseModal = () => {
    setEditingEnterpriseCode(null);
    setEntFormCode('');
    setEntFormName('');
    setEntFormBanks([]);
    setCustomBankName('');
    setShowEnterpriseModal(true);
  };

  // Open modal to Edit Enterprise Mapping
  const openEditEnterpriseModal = (ent) => {
    setEditingEnterpriseCode(ent.code);
    setEntFormCode(ent.code);
    setEntFormName(ent.name || ent.code);
    setEntFormBanks(ent.banks || []);
    setCustomBankName('');
    setShowEnterpriseModal(true);
  };

  const toggleBankSelection = (bank) => {
    const b = bank.toUpperCase();
    if (entFormBanks.includes(b)) {
      setEntFormBanks(entFormBanks.filter(item => item !== b));
    } else {
      setEntFormBanks([...entFormBanks, b]);
    }
  };

  const handleAddCustomBank = () => {
    const b = customBankName.trim().toUpperCase();
    if (!b) return;
    if (!entFormBanks.includes(b)) {
      setEntFormBanks([...entFormBanks, b]);
    }
    if (!supportedBanks.includes(b)) {
      setSupportedBanks([...supportedBanks, b]);
    }
    setCustomBankName('');
  };

  const handleSaveEnterprise = async (e) => {
    e.preventDefault();
    const code = entFormCode.trim().toUpperCase();
    const name = entFormName.trim().toUpperCase() || code;
    
    if (!code) {
      notifyFn('Enterprise Code is required', 'warning');
      return;
    }
    if (entFormBanks.length === 0) {
      notifyFn('Please select at least one required bank', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingEnterpriseCode) {
        // PUT update
        const res = await fetch(`/api/enterprises/${editingEnterpriseCode}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            banks: entFormBanks,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to update enterprise');
        notifyFn(`Enterprise ${code} updated successfully`, 'success');
      } else {
        // POST create
        const res = await fetch('/api/enterprises', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code,
            name: name,
            banks: entFormBanks,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to add enterprise');
        notifyFn(`Enterprise ${code} added successfully`, 'success');
      }

      setShowEnterpriseModal(false);
      fetchEnterprises();
      fetchSettings();
    } catch (err) {
      notifyFn(err.message || 'Error saving enterprise mapping', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEnterprise = async (code) => {
    if (!window.confirm(`Are you sure you want to delete the bank requirements for enterprise "${code}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/enterprises/${code}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to delete');

      notifyFn(`Deleted enterprise "${code}" successfully`, 'success');
      fetchEnterprises();
      fetchSettings();
    } catch (err) {
      notifyFn(err.message || 'Error deleting enterprise', 'error');
    }
  };

  // Optimized Memoized Searches
  const searchLower = search.trim().toLowerCase();
  const filteredHolders = useMemo(() => {
    if (!settings?.holder_to_code) return [];
    const entries = Object.entries(settings.holder_to_code);
    if (!searchLower) return entries;
    return entries.filter(([holder, code]) => 
      holder.toLowerCase().includes(searchLower) ||
      code.toLowerCase().includes(searchLower)
    );
  }, [settings?.holder_to_code, searchLower]);

  const enterpriseSearchLower = enterpriseSearch.trim().toLowerCase();
  const filteredEnterprises = useMemo(() => {
    if (!enterprises || enterprises.length === 0) return [];
    if (!enterpriseSearchLower) return enterprises;
    return enterprises.filter(ent => 
      ent.code.toLowerCase().includes(enterpriseSearchLower) ||
      (ent.name && ent.name.toLowerCase().includes(enterpriseSearchLower)) ||
      (ent.banks && ent.banks.some(b => b.toLowerCase().includes(enterpriseSearchLower)))
    );
  }, [enterprises, enterpriseSearchLower]);

  return (
    <div className="flex-1 p-8 space-y-7 w-full h-full overflow-y-auto">
      
      {/* Settings Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Configuration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage statement account holder mappings and enterprise bank rules.
          </p>
        </div>
      </div>

      {/* Account Codes Section */}
      <div className="rounded-2xl bg-white p-6 space-y-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <Key className="w-5 h-5 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Account Holder Name &rarr; Account Code Mappings
              </h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Read automatically from inside statement files (<code className="font-mono text-slate-800">config/account_codes.py</code>)
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account holder or code..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-all"
          />
        </div>

        {/* Codes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredHolders.map(([holder, code]) => (
            <div 
              key={holder}
              className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all group"
            >
              <div className="min-w-0 pr-2">
                <p className="text-sm font-bold text-slate-800 truncate font-mono">
                  {holder}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Holder Name</p>
              </div>
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-200 text-slate-800 border border-slate-300 shrink-0">
                {code}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* NEW: Enterprise Bank Requirements Management (Replaces static bank card) */}
      <div className="rounded-2xl bg-white p-6 space-y-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Enterprise Bank Statements &amp; Requirements
              </h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Configure which bank statements are expected for each enterprise (e.g. JC expects Kotak &amp; IDFC; ACE expects IDBI). Missing banks trigger a confirmation warning before processing.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddEnterpriseModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Enterprise Banks
          </button>
        </div>

        {/* Search for Enterprise */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={enterpriseSearch}
            onChange={(e) => setEnterpriseSearch(e.target.value)}
            placeholder="Search enterprise name, code, or bank (e.g. JC, Kotak)..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
          />
        </div>

        {/* Enterprise Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-1">
          {filteredEnterprises.map((ent) => (
            <div 
              key={ent.code}
              className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200/60">
                  <div>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {ent.code}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1.5">
                      {ent.name || ent.code}
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditEnterpriseModal(ent)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      title="Edit required banks"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEnterprise(ent.code)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete enterprise"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                    Expected Bank Statements ({ent.banks?.length || 0}):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(ent.banks || []).map((b) => (
                      <span 
                        key={b}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs flex items-center gap-1"
                      >
                        <Check className="w-3 h-3 text-emerald-600" />
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredEnterprises.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            No enterprise mappings match your search. Click "Add Enterprise Banks" to create one.
          </div>
        )}
      </div>

      {/* MODAL: Add / Edit Enterprise Bank Requirements (Modern UI) */}
      {showEnterpriseModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enterprise-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEnterpriseModal(false);
          }}
        >
          <div 
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col space-y-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start gap-3.5 px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Building2 className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h2 id="enterprise-modal-title" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {editingEnterpriseCode ? `Edit Enterprise: ${editingEnterpriseCode}` : 'Add Enterprise Bank Requirements'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
                  Configure company details and mandatory bank statements.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowEnterpriseModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveEnterprise} className="space-y-4 px-6 py-5">
              {/* Enterprise Code & Name Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Enterprise Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JC or ACE"
                    value={entFormCode}
                    onChange={(e) => setEntFormCode(e.target.value.toUpperCase())}
                    disabled={!!editingEnterpriseCode}
                    required
                    maxLength={10}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400">Short unique identifier</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JC ENTERPRISE"
                    value={entFormName}
                    onChange={(e) => setEntFormName(e.target.value.toUpperCase())}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none uppercase shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400">Account holder / company</p>
                </div>
              </div>

              {/* Select Expected Bank Statements */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Select Required Bank Statements <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-xs font-medium ${entFormBanks.length > 0 ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                    {entFormBanks.length} selected
                  </span>
                </div>

                {/* Modern Bank Selector Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {supportedBanks.map((b) => {
                    const isSelected = entFormBanks.includes(b.toUpperCase());
                    return (
                      <button
                        type="button"
                        key={b}
                        onClick={() => toggleBankSelection(b)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-[0.98] ${
                          isSelected 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-xs' 
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs'
                        }`}
                      >
                        <span>{b}</span>
                        {isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center shrink-0 text-slate-400 text-[10px]">
                            +
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Bank Name */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Add Other Bank (If Not Listed):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. HDFC, CANARA, SBI..."
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomBank();
                      }
                    }}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal uppercase focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomBank}
                    disabled={!customBankName.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    + Add Bank
                  </button>
                </div>
              </div>

              {/* Active Selection Live Summary */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Configured Statements:</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {entFormBanks.length} bank{entFormBanks.length === 1 ? '' : 's'}
                  </span>
                </div>
                {entFormBanks.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {entFormBanks.map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs"
                      >
                        <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                        {b}
                        <button
                          type="button"
                          onClick={() => toggleBankSelection(b)}
                          className="text-slate-400 hover:text-rose-600 ml-0.5 cursor-pointer text-xs"
                          title={`Remove ${b}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Please click the bank cards above to configure expected statements.
                  </p>
                )}
              </div>

              {/* Modal Actions Footer */}
              <div className="px-6 py-4 -mx-6 -mb-5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowEnterpriseModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || entFormBanks.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                  <span>{isSubmitting ? 'Saving...' : editingEnterpriseCode ? 'Save Changes' : 'Save Enterprise'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
