import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Check, 
  Building2, 
  Trash2, 
  Edit2, 
  X, 
  Info 
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function SettingsView({ onNotify }) {
  const { notify } = useToast();
  const notifyFn = onNotify || notify;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Groups & Enterprise State
  const [groups, setGroups] = useState([]);
  const [supportedBanks, setSupportedBanks] = useState(["ICICI", "KOTAK", "AXIS", "IDBI", "IDFC"]);
  const [enterpriseSearch, setEnterpriseSearch] = useState('');

  // Group Form Modal State
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(null); // null if adding, string if editing
  const [formGroupName, setFormGroupName] = useState('');
  const [formEnterprises, setFormEnterprises] = useState([
    { id: 1, name: '', banks: [] }
  ]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
        if (data.supported_banks && data.supported_banks.length > 0) {
          setSupportedBanks(data.supported_banks);
        }
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
      notifyFn('Could not load groups from backend', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
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

  // Open modal to Add Group & Enterprises
  const openAddGroupModal = () => {
    setEditingGroupName(null);
    setFormGroupName('');
    setFormEnterprises([
      { id: Date.now(), name: '', banks: [] }
    ]);
    setShowEnterpriseModal(true);
  };

  // Open modal to Edit Group
  const openEditGroupModal = (grp) => {
    setEditingGroupName(grp.group_name);
    setFormGroupName(grp.group_name);
    setFormEnterprises(
      (grp.enterprises && grp.enterprises.length > 0)
        ? grp.enterprises.map((e, idx) => ({
            id: Date.now() + idx,
            name: e.name || e.code,
            banks: e.banks || []
          }))
        : [{ id: Date.now(), name: '', banks: [] }]
    );
    setShowEnterpriseModal(true);
  };

  // Form Handlers
  const handleAddEnterpriseRow = () => {
    setFormEnterprises([
      ...formEnterprises,
      { id: Date.now(), name: '', banks: [] }
    ]);
  };

  const handleRemoveEnterpriseRow = (idx) => {
    if (formEnterprises.length <= 1) return;
    setFormEnterprises(formEnterprises.filter((_, i) => i !== idx));
  };

  const handleEnterpriseNameChange = (idx, val) => {
    const updated = [...formEnterprises];
    updated[idx].name = val.toUpperCase();
    setFormEnterprises(updated);
  };

  const toggleEnterpriseBank = (idx, bank) => {
    const b = bank.toUpperCase();
    const updated = [...formEnterprises];
    const currentBanks = updated[idx].banks || [];
    if (currentBanks.includes(b)) {
      updated[idx].banks = currentBanks.filter(item => item !== b);
    } else {
      updated[idx].banks = [...currentBanks, b];
    }
    setFormEnterprises(updated);
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    const grp = formGroupName.trim().toUpperCase();
    if (!grp) {
      notifyFn('Group Name is required', 'warning');
      return;
    }
    if (formEnterprises.length === 0) {
      notifyFn('Please add at least one enterprise under this group', 'warning');
      return;
    }

    for (let i = 0; i < formEnterprises.length; i++) {
      const ent = formEnterprises[i];
      if (!ent.name.trim()) {
        notifyFn(`Enterprise #${i + 1} Name cannot be empty`, 'warning');
        return;
      }
      if (!ent.banks || ent.banks.length === 0) {
        notifyFn(`Please select at least one bank statement for Enterprise "${ent.name}"`, 'warning');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload = {
        group_name: grp,
        enterprises: formEnterprises.map(item => ({
          name: item.name.trim().toUpperCase(),
          code: item.name.trim().toUpperCase(),
          banks: item.banks
        }))
      };

      const url = editingGroupName ? `/api/groups/${encodeURIComponent(editingGroupName)}` : '/api/groups';
      const method = editingGroupName ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save group');

      notifyFn(`Group "${grp}" and enterprises saved successfully!`, 'success');
      setShowEnterpriseModal(false);
      fetchGroups();
    } catch (err) {
      notifyFn(err.message || 'Error saving group', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (grpName) => {
    if (!window.confirm(`Are you sure you want to delete group "${grpName}" and all its enterprises?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(grpName)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to delete group');

      notifyFn(`Deleted group "${grpName}" successfully`, 'success');
      fetchGroups();
    } catch (err) {
      notifyFn(err.message || 'Error deleting group', 'error');
    }
  };

  // Filtered Groups for Table Search
  const groupSearchLower = enterpriseSearch.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!groups || groups.length === 0) return [];
    if (!groupSearchLower) return groups;
    return groups.filter(grp => 
      grp.group_name.toLowerCase().includes(groupSearchLower) ||
      grp.enterprises.some(e => 
        (e.name && e.name.toLowerCase().includes(groupSearchLower)) ||
        (e.code && e.code.toLowerCase().includes(groupSearchLower)) ||
        (e.banks && e.banks.some(b => b.toLowerCase().includes(groupSearchLower)))
      )
    );
  }, [groups, groupSearchLower]);

  return (
    <div className="flex-1 p-8 space-y-7 w-full h-full overflow-y-auto">
      
      {/* Settings Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Configuration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage groups, associated enterprises, and required bank statement rules.
          </p>
        </div>
      </div>

      {/* Unified Enterprise Table */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Building2 className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Enterprises &amp; Group Configurations
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {filteredGroups.length} {filteredGroups.length === 1 ? 'Group' : 'Groups'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage group codes, registered enterprise names, and required bank statement rules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={enterpriseSearch}
                onChange={(e) => setEnterpriseSearch(e.target.value)}
                placeholder="Search group, enterprise, bank..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs"
              />
            </div>

            {/* Add Enterprise Button */}
            <button
              type="button"
              onClick={openAddGroupModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs cursor-pointer active:scale-[0.98] shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Enterprise</span>
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th scope="col" className="px-6 py-3.5 w-16 text-center">
                  S.No
                </th>
                <th scope="col" className="px-6 py-3.5 w-48">
                  Group Name
                </th>
                <th scope="col" className="px-6 py-3.5 min-w-[200px]">
                  Enterprises Name
                </th>
                <th scope="col" className="px-6 py-3.5 min-w-[280px]">
                  Required Bank Statements
                </th>
                <th scope="col" className="px-6 py-3.5 w-28 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredGroups.map((grp, idx) => (
                <tr 
                  key={grp.group_name}
                  className="hover:bg-slate-50/70 transition-colors group align-top"
                >
                  {/* S.No */}
                  <td className="px-6 py-4 text-center font-mono text-xs font-semibold text-slate-400 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </td>

                  {/* Group Name */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-900 text-white shadow-2xs tracking-wider">
                      {grp.group_name}
                    </span>
                  </td>

                  {/* Enterprises Name (1, 2, 3...) */}
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      {grp.enterprises.map((ent, eIdx) => (
                        <div key={eIdx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                          <span className="text-sm font-bold text-slate-900">
                            {ent.name || ent.code}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Required Bank Statements per Enterprise */}
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      {grp.enterprises.map((ent, eIdx) => (
                        <div key={eIdx} className="flex flex-wrap items-center gap-1.5 min-h-[24px]">
                          <span className="text-[11px] font-mono font-bold text-slate-500 mr-0.5">
                            {ent.name || ent.code}:
                          </span>
                          {(ent.banks && ent.banks.length > 0) ? (
                            ent.banks.map((b) => (
                              <span
                                key={b}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-200/90 shadow-2xs"
                              >
                                <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                                {b}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">None configured</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditGroupModal(grp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                        title={`Edit ${grp.group_name}`}
                        aria-label={`Edit ${grp.group_name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(grp.group_name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title={`Delete ${grp.group_name}`}
                        aria-label={`Delete ${grp.group_name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredGroups.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                    {loading ? 'Loading configurations...' : 'No group configurations match your search. Click "Add Enterprise" to create one.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Total Groups: {filteredGroups.length}</span>
          <span>Single Source of Truth: PostgreSQL</span>
        </div>
      </div>

      {/* MODAL: Add / Edit Group & Enterprise Bank Requirements */}
      {showEnterpriseModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEnterpriseModal(false);
          }}
        >
          <div 
            className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start gap-3.5 px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Building2 className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h2 id="group-modal-title" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {editingGroupName ? `Edit Group: ${editingGroupName}` : 'Add Group & Enterprise Requirements'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
                  Configure group name, add multiple enterprises, and select bank statements.
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
            <form onSubmit={handleSaveGroup} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
                {/* Group Name Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Group Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JC or JUBILANT GROUP"
                    value={formGroupName}
                    onChange={(e) => setFormGroupName(e.target.value.toUpperCase())}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none uppercase shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400">Primary group identifier (e.g. JC)</p>
                </div>

                {/* Enterprises Section Header */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Enterprises Under this Group ({formEnterprises.length}) <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-400">Add 1, 2, 3 or more enterprises and assign their required banks</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEnterpriseRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer active:scale-[0.98] shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Enterprise</span>
                  </button>
                </div>

                {/* Enterprises List Cards */}
                <div className="space-y-3.5 pt-1">
                  {formEnterprises.map((ent, idx) => (
                    <div 
                      key={ent.id || idx} 
                      className="p-4 rounded-xl bg-slate-50/90 border border-slate-200/90 space-y-3 shadow-2xs transition-all hover:bg-slate-50"
                    >
                      {/* Enterprise Card Header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                          Enterprise #{idx + 1}
                        </span>
                        {formEnterprises.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEnterpriseRow(idx)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove this enterprise"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Enterprise Name Input */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-700 uppercase">
                          Enterprise Name / Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. SS, SN, or JC ENTERPRISE"
                          value={ent.name}
                          onChange={(e) => handleEnterpriseNameChange(idx, e.target.value)}
                          required
                          className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none uppercase shadow-2xs"
                        />
                      </div>

                      {/* Bank Statement Selector for this Enterprise */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-600 uppercase">
                            Required Bank Statements for {ent.name || `Enterprise #${idx + 1}`}:
                          </span>
                          <span className="text-slate-500 font-mono">
                            {ent.banks.length} selected
                          </span>
                        </div>

                        {/* Interactive Bank Tiles */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {supportedBanks.map((b) => {
                            const isSelected = ent.banks.includes(b.toUpperCase());
                            return (
                              <button
                                type="button"
                                key={b}
                                onClick={() => toggleEnterpriseBank(idx, b)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-[0.98] ${
                                  isSelected 
                                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs' 
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100 shadow-2xs'
                                }`}
                              >
                                <span>{b}</span>
                                {isSelected ? (
                                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                    <Check className="w-2 h-2 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center shrink-0 text-slate-400 text-[10px]">
                                    +
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowEnterpriseModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40"
                >
                  <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                  <span>{isSubmitting ? 'Saving...' : editingGroupName ? 'Save Changes' : 'Save Group & Enterprises'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
