import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Check, 
  Building2, 
  Landmark,
  Trash2, 
  Edit2, 
  X, 
  Info,
  ChevronDown 
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function SettingsView({ onNotify }) {
  const { notify } = useToast();
  const notifyFn = onNotify || notify;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Groups & Enterprise & Banks State
  const [groups, setGroups] = useState([]);
  const [supportedBanks, setSupportedBanks] = useState(["ICICI", "KOTAK", "AXIS", "IDBI", "IDFC"]);
  const [availableEnterprises, setAvailableEnterprises] = useState([]);
  const [enterpriseSearch, setEnterpriseSearch] = useState('');

  // 1. Group Form Modal State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(null); // null if adding, string if editing
  const [formGroupName, setFormGroupName] = useState('');
  const [formEnterprises, setFormEnterprises] = useState([
    { id: 1, name: '', isCustom: false, banks: [] }
  ]);

  // 2. Add Enterprise Quick Modal State
  const [showAddEnterpriseModal, setShowAddEnterpriseModal] = useState(false);
  const [newEntCode, setNewEntCode] = useState('');
  const [newEntName, setNewEntName] = useState('');

  // 3. Add Bank Quick Modal State
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('');

  // Dropdown open state for Bank Statements in Group modal
  const [openBankDropdownIdx, setOpenBankDropdownIdx] = useState(null);

  // Fetch all groups
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

  // Fetch all registered distinct enterprises for dropdowns
  const fetchAvailableEnterprises = async () => {
    try {
      const res = await fetch('/api/enterprises/list');
      if (res.ok) {
        const data = await res.json();
        setAvailableEnterprises(data.enterprises || []);
      }
    } catch (err) {
      console.error('Failed to load enterprises list:', err);
    }
  };

  // Fetch all supported banks
  const fetchSupportedBanks = async () => {
    try {
      const res = await fetch('/api/banks');
      if (res.ok) {
        const data = await res.json();
        if (data.banks && data.banks.length > 0) {
          setSupportedBanks(data.banks);
        }
      }
    } catch (err) {
      console.error('Failed to load supported banks:', err);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchAvailableEnterprises();
    fetchSupportedBanks();
  }, []);

  // Escape key closes whichever modal is open
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showAddBankModal) setShowAddBankModal(false);
        else if (showAddEnterpriseModal) setShowAddEnterpriseModal(false);
        else if (showGroupModal) setShowGroupModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGroupModal, showAddEnterpriseModal, showAddBankModal]);

  // Open modal to Add Group & Enterprises
  const openAddGroupModal = () => {
    setEditingGroupName(null);
    setFormGroupName('');
    setFormEnterprises([
      { id: Date.now(), name: '', isCustom: false, banks: [] }
    ]);
    setOpenBankDropdownIdx(0);
    setShowGroupModal(true);
  };

  // Open modal to Edit Group
  const openEditGroupModal = (grp) => {
    setEditingGroupName(grp.group_name);
    setFormGroupName(grp.group_name);
    setFormEnterprises(
      (grp.enterprises && grp.enterprises.length > 0)
        ? grp.enterprises.map((e, idx) => ({
            id: Date.now() + idx,
            name: e.code || e.name,
            isCustom: false,
            banks: e.banks || []
          }))
        : [{ id: Date.now(), name: '', isCustom: false, banks: [] }]
    );
    setOpenBankDropdownIdx(0);
    setShowGroupModal(true);
  };

  // Group Form: Add another enterprise row
  const handleAddEnterpriseRow = () => {
    const newIdx = formEnterprises.length;
    setFormEnterprises([
      ...formEnterprises,
      { id: Date.now(), name: '', isCustom: false, banks: [] }
    ]);
    setOpenBankDropdownIdx(newIdx);
  };

  // Group Form: Remove an enterprise row
  const handleRemoveEnterpriseRow = (idx) => {
    if (formEnterprises.length <= 1) return;
    setFormEnterprises(formEnterprises.filter((_, i) => i !== idx));
  };

  // Group Form: Change enterprise from dropdown or custom
  const handleEnterpriseDropdownChange = (idx, selectedVal) => {
    const updated = [...formEnterprises];
    if (selectedVal === '__NEW__') {
      updated[idx].isCustom = true;
      updated[idx].name = '';
    } else {
      updated[idx].isCustom = false;
      updated[idx].name = selectedVal;
    }
    setFormEnterprises(updated);
  };

  const handleEnterpriseCustomNameChange = (idx, val) => {
    const updated = [...formEnterprises];
    updated[idx].name = val.toUpperCase();
    setFormEnterprises(updated);
  };

  // Group Form: Toggle bank selection for a specific enterprise
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

  // Group Form: Submit Save
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
      setShowGroupModal(false);
      fetchGroups();
      fetchAvailableEnterprises();
    } catch (err) {
      notifyFn(err.message || 'Error saving group', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group Form: Delete Group
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
      fetchAvailableEnterprises();
    } catch (err) {
      notifyFn(err.message || 'Error deleting group', 'error');
    }
  };

  // Quick Modal: Add Enterprise
  const handleQuickAddEnterprise = async (e) => {
    e.preventDefault();
    const code = newEntCode.trim().toUpperCase();
    const name = (newEntName.trim() || code).toUpperCase();
    if (!code) {
      notifyFn('Enterprise Code is required', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/enterprises/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add enterprise');

      notifyFn(`Enterprise "${code}" added successfully!`, 'success');
      setNewEntCode('');
      setNewEntName('');
      fetchAvailableEnterprises();
    } catch (err) {
      notifyFn(err.message || 'Error adding enterprise', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEnterprise = async (code) => {
    const defaultCodes = ["JC", "ACE", "RE", "SS", "SN", "ASQ", "SSN"];
    if (defaultCodes.includes(code)) {
      notifyFn(`"${code}" is a core enterprise and cannot be deleted`, 'warning');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove enterprise "${code}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/enterprises/${encodeURIComponent(code)}`, { method: 'DELETE' });
      if (res.ok) {
        notifyFn(`Enterprise "${code}" removed`, 'success');
        fetchAvailableEnterprises();
        fetchGroups();
      }
    } catch (err) {
      notifyFn('Error deleting enterprise', 'error');
    }
  };

  // Quick Modal: Add Bank
  const handleQuickAddBank = async (e) => {
    e.preventDefault();
    const bName = newBankName.trim().toUpperCase();
    if (!bName) {
      notifyFn('Bank Name is required', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add bank');

      notifyFn(`Bank "${bName}" added successfully!`, 'success');
      setNewBankName('');
      fetchSupportedBanks();
    } catch (err) {
      notifyFn(err.message || 'Error adding bank', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBank = async (bName) => {
    const defaultBanks = ["ICICI", "KOTAK", "AXIS", "IDBI", "IDFC"];
    if (defaultBanks.includes(bName)) {
      notifyFn(`"${bName}" is a core parser bank and cannot be deleted`, 'warning');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove bank "${bName}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/banks/${encodeURIComponent(bName)}`, { method: 'DELETE' });
      if (res.ok) {
        notifyFn(`Bank "${bName}" removed`, 'success');
        fetchSupportedBanks();
      }
    } catch (err) {
      notifyFn('Error deleting bank', 'error');
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

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={enterpriseSearch}
                onChange={(e) => setEnterpriseSearch(e.target.value)}
                placeholder="Search group, enterprise, bank..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs"
              />
            </div>

            {/* + Add Group Button */}
            <button
              type="button"
              onClick={openAddGroupModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs cursor-pointer active:scale-[0.98] shrink-0"
              title="Add a new group with multiple enterprises and banks"
            >
              <Plus className="w-4 h-4" />
              <span>Add Group</span>
            </button>

            {/* + Add Enterprise Button */}
            <button
              type="button"
              onClick={() => setShowAddEnterpriseModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer active:scale-[0.98] shrink-0"
              title="Add a new enterprise entity to the system"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Add Enterprise</span>
            </button>

            {/* + Add Bank Button */}
            <button
              type="button"
              onClick={() => setShowAddBankModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer active:scale-[0.98] shrink-0"
              title="Add a new bank statement requirement option"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Add Bank</span>
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
                    {loading ? 'Loading configurations...' : 'No group configurations match your search. Click "Add Group" to create one.'}
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

      {/* 1. MODAL: Add / Edit Group & Enterprise Bank Requirements */}
      {showGroupModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGroupModal(false);
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
                  Configure group name, select/add enterprises via dropdown, and choose bank statements.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveGroup} className="flex flex-col">
              <div className="p-6 space-y-4 overflow-y-auto overscroll-contain max-h-[calc(90vh-140px)]">
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
                    <p className="text-[11px] text-slate-400">Select enterprise from dropdown or type new, then choose banks</p>
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

                      {/* Enterprise Dropdown Selector */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                          Enterprise Name / Code <span className="text-rose-500">*</span>
                        </label>
                        
                        <select
                          value={ent.name}
                          onChange={(e) => handleEnterpriseDropdownChange(idx, e.target.value)}
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none shadow-2xs cursor-pointer"
                        >
                          <option value="">Select Enterprise...</option>
                          {availableEnterprises.map((avail) => (
                            <option key={avail.code} value={avail.code}>
                              {avail.code} &mdash; {avail.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Bank Statement Dropdown Selector for this Enterprise */}
                      <div className="space-y-1.5 pt-1 relative">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-700 uppercase tracking-wider">
                            Required Bank Statements <span className="text-rose-500">*</span>
                          </span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {ent.banks.length} selected
                          </span>
                        </div>

                        {/* Dropdown Toggle Header */}
                        <div>
                          <button
                            type="button"
                            onClick={() => setOpenBankDropdownIdx(openBankDropdownIdx === idx ? null : idx)}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all outline-none shadow-2xs cursor-pointer text-left ${
                              openBankDropdownIdx === idx 
                                ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900 text-slate-900' 
                                : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <span className={ent.banks.length > 0 ? "text-slate-900 font-bold" : "text-slate-500 font-medium"}>
                              {ent.banks.length === 0 
                                ? "Choose bank statements from list..." 
                                : `✓ ${ent.banks.join(', ')} (${ent.banks.length} selected)`}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium shrink-0">
                              <span>{openBankDropdownIdx === idx ? 'Hide Options' : 'Select Banks'}</span>
                              <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${openBankDropdownIdx === idx ? 'rotate-180 text-slate-900' : 'text-slate-400'}`} />
                            </div>
                          </button>

                          {/* In-Card Expandable Bank Selector Grid (Never cut off by modal boundary!) */}
                          {openBankDropdownIdx === idx && (
                            <div className="mt-2 p-3.5 bg-slate-50/90 border border-slate-200/90 rounded-xl space-y-2.5 animate-in fade-in zoom-in-98 duration-100">
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1.5 border-b border-slate-200/70">
                                <span className="font-semibold text-slate-700">Click banks to select for this enterprise:</span>
                                <button
                                  type="button"
                                  onClick={() => setOpenBankDropdownIdx(null)}
                                  className="text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded cursor-pointer shadow-2xs"
                                >
                                  Done ✓
                                </button>
                              </div>
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
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/60 shadow-2xs'
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
                          )}
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
                  onClick={() => setShowGroupModal(false)}
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

      {/* 2. MODAL: Manage & Add Enterprise */}
      {showAddEnterpriseModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-enterprise-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddEnterpriseModal(false);
          }}
        >
          <div 
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start gap-3.5 px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Building2 className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h2 id="add-enterprise-modal-title" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Manage Enterprises
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  View registered enterprises or register a new enterprise entity.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddEnterpriseModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Section 1: Registered Enterprises List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Registered Enterprises ({availableEnterprises.length})
                  </label>
                  <span className="text-[11px] text-slate-400">Available in Group Dropdowns</span>
                </div>
                
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl max-h-40 overflow-y-auto space-y-1.5">
                  {availableEnterprises.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2 text-center">No enterprises registered yet.</p>
                  ) : (
                    availableEnterprises.map((ent) => {
                      const isDefault = ["JC", "ACE", "RE", "SS", "SN", "ASQ", "SSN"].includes(ent.code);
                      return (
                        <div 
                          key={ent.code}
                          className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-900 text-white text-[11px] tracking-wider shrink-0">
                              {ent.code}
                            </span>
                            <span className="font-semibold text-slate-800 truncate">
                              {ent.name || ent.code}
                            </span>
                          </div>
                          {isDefault ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteEnterprise(ent.code)}
                              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-0.5 rounded hover:bg-rose-50 shrink-0"
                              title={`Delete custom enterprise ${ent.code}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Section 2: Add New Enterprise Form */}
              <form onSubmit={handleQuickAddEnterprise} className="space-y-3 pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Add New Enterprise
                </label>
                
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">Enterprise Code <span className="text-rose-500">*</span></span>
                  <input
                    type="text"
                    placeholder="e.g. SS, SN, or JC"
                    value={newEntCode}
                    onChange={(e) => setNewEntCode(e.target.value.toUpperCase())}
                    required
                    maxLength={15}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none uppercase shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">Enterprise Full Name / Holder Name</span>
                  <input
                    type="text"
                    placeholder="e.g. SUDHAKAR S or JC ENTERPRISE"
                    value={newEntName}
                    onChange={(e) => setNewEntName(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none uppercase shadow-2xs"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newEntCode.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Adding...' : 'Add Enterprise'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowAddEnterpriseModal(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL: Manage & Add Bank */}
      {showAddBankModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-bank-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddBankModal(false);
          }}
        >
          <div 
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start gap-3.5 px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Landmark className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h2 id="add-bank-modal-title" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Manage Bank Statements
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  View configured banks or register a new statement requirement option.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddBankModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Section 1: Configured Banks List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Configured Banks ({supportedBanks.length})
                  </label>
                  <span className="text-[11px] text-slate-400">Active Statement Options</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl max-h-48 overflow-y-auto flex flex-wrap gap-2">
                  {supportedBanks.map((bName) => {
                    const isCore = ["ICICI", "KOTAK", "AXIS", "IDBI", "IDFC"].includes(bName);
                    return (
                      <div
                        key={bName}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider bg-white border border-slate-200 text-slate-800 shadow-2xs transition-all"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                        <span>{bName}</span>
                        {!isCore && (
                          <button
                            type="button"
                            onClick={() => handleDeleteBank(bName)}
                            className="ml-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-0.5 rounded hover:bg-rose-50"
                            title={`Delete custom bank ${bName}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Add New Bank Form */}
              <form onSubmit={handleQuickAddBank} className="space-y-3 pt-3 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Add New Bank Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. HDFC, CANARA, SBI, PNB, UNION..."
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value.toUpperCase())}
                      maxLength={20}
                      required
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none uppercase shadow-2xs"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting || !newBankName.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isSubmitting ? 'Adding...' : 'Add Bank'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Once registered, this bank will appear in enterprise bank statement options across all groups.
                  </p>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowAddBankModal(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
