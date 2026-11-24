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
  AlertCircle
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function SettingsView({ onNotify }) {
  const { notify } = useToast();
  const notifyFn = onNotify || notify;

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // New Account Code Form
  const [newHolder, setNewHolder] = useState('');
  const [newCode, setNewCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

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

  const handleAddAccountCode = async (e) => {
    e.preventDefault();
    if (!newHolder.trim() || !newCode.trim()) {
      notifyFn('Holder name and account code are required', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/settings/account-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holder_name: newHolder.trim(),
          account_code: newCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save');

      notifyFn(data.message, 'success');
      setNewHolder('');
      setNewCode('');
      setShowAddForm(false);
      fetchSettings();
    } catch (err) {
      notifyFn(err.message || 'Error updating account code', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open modal to Add Enterprise Mapping
  const openAddEnterpriseModal = () => {
    setEditingEnterpriseCode(null);
    setEntFormCode('');
    setEntFormName('');
    setEntFormBanks(['KOTAK', 'IDFC']);
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

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? 'Cancel' : 'Add New Mapping'}
          </button>
        </div>

        {/* Quick Add Form Drawer */}
        {showAddForm && (
          <form 
            onSubmit={handleAddAccountCode}
            className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
          >
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Add Statement Holder Mapping
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  ACCOUNT HOLDER NAME (in statement)
                </label>
                <input 
                  type="text"
                  placeholder="e.g. BALAJI TRADERS"
                  value={newHolder}
                  onChange={(e) => setNewHolder(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  ACCOUNT CODE (short label)
                </label>
                <input 
                  type="text"
                  placeholder="e.g. BT or SS"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 uppercase"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3.5 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Saving...' : 'Save to Config'}
              </button>
            </div>
          </form>
        )}

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

      {/* MODAL: Add / Edit Enterprise Bank Requirements */}
      {showEnterpriseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  {editingEnterpriseCode ? `Modify Enterprise: ${editingEnterpriseCode}` : 'Add Enterprise Bank Requirements'}
                </h3>
              </div>
              <button 
                onClick={() => setShowEnterpriseModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEnterprise} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Enterprise Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JC or ACE"
                    value={entFormCode}
                    onChange={(e) => setEntFormCode(e.target.value.toUpperCase())}
                    disabled={!!editingEnterpriseCode}
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Enterprise Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JC ENTERPRISE"
                    value={entFormName}
                    onChange={(e) => setEntFormName(e.target.value.toUpperCase())}
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 uppercase"
                  />
                </div>
              </div>

              {/* Select Expected Banks */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Select Required Bank Statements:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {supportedBanks.map((b) => {
                    const isSelected = entFormBanks.includes(b.toUpperCase());
                    return (
                      <button
                        type="button"
                        key={b}
                        onClick={() => toggleBankSelection(b)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs ring-1 ring-indigo-500' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span>{b}</span>
                        {isSelected ? <Check className="w-4 h-4 text-indigo-600 shrink-0" /> : <div className="w-4 h-4 rounded border border-slate-300" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Bank Name */}
              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Add Other Bank (if not listed):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. HDFC or SBI"
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 uppercase focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomBank}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                  >
                    + Add Bank
                  </button>
                </div>
              </div>

              {/* Active Selection Summary */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <span className="font-bold text-slate-800">Required Statements: </span>
                {entFormBanks.length > 0 ? entFormBanks.join(', ') : <span className="text-rose-500 font-semibold">None selected</span>}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEnterpriseModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Saving...' : 'Save Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
