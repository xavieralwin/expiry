import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  Filter, 
  Bell, 
  UserCheck, 
  Save, 
  Sparkles,
  Users
} from 'lucide-react';
import { fetchMALeaves, addMALeave, updateMALeave, deleteMALeave } from '../lib/api';
import { exportToCsv } from '../lib/exportCsv';
import { trackButtonClick } from '../lib/analytics';

function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.trim();
  if (!str) return null;

  const mdYMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (mdYMatch) {
    const month = parseInt(mdYMatch[1], 10) - 1;
    const day = parseInt(mdYMatch[2], 10);
    const year = parseInt(mdYMatch[3], 10);
    return new Date(year, month, day);
  }

  const yMdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yMdMatch) {
    const year = parseInt(yMdMatch[1], 10);
    const month = parseInt(yMdMatch[2], 10) - 1;
    const day = parseInt(yMdMatch[3], 10);
    return new Date(year, month, day);
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function evaluateLeaveStatus(record, today) {
  const from = parseDateString(record.fromDate);
  const to = parseDateString(record.toDate);

  // Mark Completed once current date reaches or passes end date
  if (to) {
    const endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);
    if (today > endOfDay) {
      return 'Completed';
    }
  }

  if (from && to) {
    const startOfDay = new Date(from);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);
    if (today >= startOfDay && today <= endOfDay) {
      return 'Ongoing';
    }
    if (today < startOfDay) {
      return 'Not started';
    }
  }

  return record.maStatus || 'Not started';
}

function processLeaves(rawLeaves) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const evaluated = rawLeaves.map(item => ({
    ...item,
    maStatus: evaluateLeaveStatus(item, today)
  }));

  // Sort date-wise chronologically by fromDate
  return evaluated.sort((a, b) => {
    const dateA = parseDateString(a.fromDate);
    const dateB = parseDateString(b.fromDate);
    if (dateA && dateB) return dateA - dateB;
    if (dateA) return -1;
    if (dateB) return 1;
    return (a.idName || '').localeCompare(b.idName || '');
  });
}

export default function MALeaveTracker() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  
  // Modal state for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    seoId: '',
    idName: '',
    mappingIds: '',
    fromDate: '',
    toDate: '',
    applied: 'Done',
    maStatus: 'Not started'
  });

  // Inline editing row ID
  const [inlineEditingId, setInlineEditingId] = useState(null);
  const [inlineData, setInlineData] = useState({});

  useEffect(() => {
    loadLeaves();
  }, []);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const data = await fetchMALeaves();
      setLeaves(processLeaves(data));
    } catch (err) {
      console.error('Failed to load MA leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    trackButtonClick('MA Leave Tracker - Add New Record');
    setEditingRecord(null);
    setFormData({
      seoId: '',
      idName: '',
      mappingIds: 'Moenage',
      fromDate: '',
      toDate: '',
      applied: 'Done',
      maStatus: 'Not started'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record) => {
    trackButtonClick('MA Leave Tracker - Edit Modal');
    setEditingRecord(record);
    setFormData({
      seoId: record.seoId || '',
      idName: record.idName || '',
      mappingIds: record.mappingIds || '',
      fromDate: record.fromDate || '',
      toDate: record.toDate || '',
      applied: record.applied || 'Done',
      maStatus: record.maStatus || 'Not started'
    });
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!formData.seoId || !formData.idName) {
      alert('SEO ID and ID Name are required');
      return;
    }

    try {
      if (editingRecord) {
        const updated = await updateMALeave(editingRecord.id, formData);
        setLeaves(prev => processLeaves(prev.map(item => item.id === editingRecord.id ? { ...item, ...updated } : item)));
      } else {
        const created = await addMALeave(formData);
        setLeaves(prev => processLeaves([created, ...prev]));
      }
      setIsModalOpen(false);
      // Trigger event for layout to refresh active notification banner
      window.dispatchEvent(new Event('ma-leaves-updated'));
    } catch (err) {
      alert('Error saving MA leave record: ' + err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete MA Leave record for ${name}?`)) return;
    try {
      await deleteMALeave(id);
      setLeaves(prev => prev.filter(item => item.id !== id));
      window.dispatchEvent(new Event('ma-leaves-updated'));
    } catch (err) {
      alert('Failed to delete record: ' + err.message);
    }
  };

  // Inline editing handlers
  const handleStartInlineEdit = (record) => {
    setInlineEditingId(record.id);
    setInlineData({ ...record });
  };

  const handleSaveInlineEdit = async (id) => {
    try {
      const updated = await updateMALeave(id, inlineData);
      setLeaves(prev => processLeaves(prev.map(item => item.id === id ? { ...item, ...updated } : item)));
      setInlineEditingId(null);
      window.dispatchEvent(new Event('ma-leaves-updated'));
    } catch (err) {
      alert('Failed to save edit: ' + err.message);
    }
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingId(null);
  };

  // Quick Status Toggle
  const handleQuickStatusChange = async (record, newStatus) => {
    try {
      const updatedData = { ...record, maStatus: newStatus };
      await updateMALeave(record.id, updatedData);
      setLeaves(prev => processLeaves(prev.map(item => item.id === record.id ? updatedData : item)));
      window.dispatchEvent(new Event('ma-leaves-updated'));
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  // Quick Notify Announcement button
  const handleSetGlobalNotification = (record) => {
    const notifyText = `📢 MA Leave Alert: ${record.seoId} (${record.idName}) is on mandatory leave (${record.maStatus || 'Ongoing'}) ${record.fromDate ? `from ${record.fromDate} to ${record.toDate}` : 'this week'}!`;
    localStorage.setItem('custom_ma_notification', notifyText);
    window.dispatchEvent(new Event('ma-leaves-updated'));
    alert(`Global banner updated across all pages to:\n"${notifyText}"`);
  };

  // Filtering
  const filteredLeaves = leaves.filter(record => {
    const matchesSearch = 
      (record.seoId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.idName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.mappingIds || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedStatus === 'ALL') return matchesSearch;
    return matchesSearch && (record.maStatus || '').toLowerCase() === selectedStatus.toLowerCase();
  });

  // Export to CSV
  const handleExportCSV = () => {
    trackButtonClick('MA Leave Tracker - Export CSV');
    const exportData = filteredLeaves.map(r => ({
      'SEO ID': r.seoId,
      'ID Name': r.idName,
      'Mapping IDs': r.mappingIds,
      'From Date': r.fromDate,
      'To Date': r.toDate,
      'Applied': r.applied,
      'MA Status': r.maStatus
    }));
    exportToCsv(exportData, `MA_Leave_Tracker_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Calculate statistics
  const totalCount = leaves.length;
  const completedCount = leaves.filter(l => l.maStatus === 'Completed').length;
  const ongoingCount = leaves.filter(l => l.maStatus === 'Ongoing').length;
  const notStartedCount = leaves.filter(l => l.maStatus === 'Not started').length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 flex items-center gap-1 w-fit"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>;
      case 'Ongoing':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center gap-1 w-fit animate-pulse"><Clock className="w-3.5 h-3.5" /> Ongoing</span>;
      default:
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1 w-fit"><AlertCircle className="w-3.5 h-3.5" /> Not started</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-400/30 backdrop-blur-sm">
              <UserCheck className="w-6 h-6 text-purple-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">MA Leave Tracker</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30 rounded-full">
              Mandatory Leave
            </span>
          </div>
          <p className="text-purple-200/80 text-sm pl-10">
            Track, schedule, and notify team members regarding Mandatory Absence (MA) leaves.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-all border border-white/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button 
            onClick={handleOpenAddModal}
            className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add MA Leave</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Records</p>
            <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{totalCount}</p>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{completedCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm flex items-center justify-between bg-amber-50/20 dark:bg-amber-950/10">
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Ongoing / Active</p>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{ongoingCount}</p>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-700 dark:text-amber-300">
            <Clock className="w-6 h-6 animate-spin-slow" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Not Started</p>
            <p className="text-2xl font-extrabold text-slate-600 dark:text-slate-300 mt-1">{notStartedCount}</p>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filter Tabs */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input 
            type="text"
            placeholder="Search by SEO ID, Name, or Mapping ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Leaves' },
            { id: 'Ongoing', label: 'Ongoing' },
            { id: 'Completed', label: 'Completed' },
            { id: 'Not started', label: 'Not Started' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedStatus === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-medium">Loading MA Leave records...</p>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-base font-semibold text-slate-700">No MA leave records found</p>
            <p className="text-xs text-slate-400">Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white text-xs uppercase font-bold tracking-wider">
                  <th className="py-3.5 px-4 rounded-tl-xl">SEO ID</th>
                  <th className="py-3.5 px-4">ID Name</th>
                  <th className="py-3.5 px-4">Mapping IDs</th>
                  <th className="py-3.5 px-4">From (MM/DD/YYYY)</th>
                  <th className="py-3.5 px-4">To (MM/DD/YYYY)</th>
                  <th className="py-3.5 px-4">Applied</th>
                  <th className="py-3.5 px-4">MA Status</th>
                  <th className="py-3.5 px-4 text-right rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200">
                {filteredLeaves.map((record, index) => {
                  const isInlineEditing = inlineEditingId === record.id;
                  const isHighlighted = record.maStatus === 'Ongoing';

                  if (isInlineEditing) {
                    return (
                      <tr key={record.id} className="bg-purple-50/50 dark:bg-purple-950/30">
                        <td className="p-3">
                          <input 
                            type="text" 
                            value={inlineData.seoId || ''} 
                            onChange={(e) => setInlineData({ ...inlineData, seoId: e.target.value })}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-slate-800 dark:text-slate-100 rounded text-xs focus:outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            value={inlineData.idName || ''} 
                            onChange={(e) => setInlineData({ ...inlineData, idName: e.target.value })}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-slate-800 dark:text-slate-100 rounded text-xs focus:outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            value={inlineData.mappingIds || ''} 
                            onChange={(e) => setInlineData({ ...inlineData, mappingIds: e.target.value })}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-slate-800 dark:text-slate-100 rounded text-xs focus:outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            placeholder="MM-DD-YYYY"
                            value={inlineData.fromDate || ''} 
                            onChange={(e) => setInlineData({ ...inlineData, fromDate: e.target.value })}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-slate-800 dark:text-slate-100 rounded text-xs focus:outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            placeholder="MM-DD-YYYY"
                            value={inlineData.toDate || ''} 
                            onChange={(e) => setInlineData({ ...inlineData, toDate: e.target.value })}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-slate-800 dark:text-slate-100 rounded text-xs focus:outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            value={inlineData.applied || ''} 
                            onChange={(e) => setInlineData({ ...inlineData, applied: e.target.value })}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-slate-800 dark:text-slate-100 rounded text-xs focus:outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <select 
                            value={inlineData.maStatus || 'Not started'} 
                            onChange={(e) => setInlineData({ ...inlineData, maStatus: e.target.value })}
                            className="px-2 py-1 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-slate-800 dark:text-slate-100 rounded text-xs focus:outline-none"
                          >
                            <option value="Completed">Completed</option>
                            <option value="Ongoing">Ongoing</option>
                            <option value="Not started">Not started</option>
                          </select>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button 
                              onClick={() => handleSaveInlineEdit(record.id)}
                              className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                              title="Save Inline Edit"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={handleCancelInlineEdit}
                              className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr 
                      key={record.id} 
                      className={`hover:bg-purple-50/40 dark:hover:bg-purple-900/20 transition-colors ${
                        isHighlighted 
                          ? 'bg-amber-50/30 dark:bg-amber-950/20' 
                          : index % 2 === 0 
                            ? 'bg-white dark:bg-slate-900' 
                            : 'bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-purple-950 dark:text-purple-300 font-mono text-xs">
                        {record.seoId}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-100">
                        {record.idName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700">
                          {record.mappingIds || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {record.fromDate || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {record.toDate || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          record.applied === 'Done' ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          {record.applied || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(record.maStatus)}
                          <select 
                            value={record.maStatus || 'Not started'} 
                            onChange={(e) => handleQuickStatusChange(record, e.target.value)}
                            className="text-xs bg-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 border-none focus:outline-none cursor-pointer"
                            title="Quick Status Selector"
                          >
                            <option value="Completed" className="dark:bg-slate-900">Completed</option>
                            <option value="Ongoing" className="dark:bg-slate-900">Ongoing</option>
                            <option value="Not started" className="dark:bg-slate-900">Not started</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleSetGlobalNotification(record)}
                            className="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors cursor-pointer"
                            title="Set as Global Top Notification Banner"
                          >
                            <Bell className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleStartInlineEdit(record)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors cursor-pointer"
                            title="Quick Inline Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(record)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer"
                            title="Open Edit Dialog"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(record.id, record.idName)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span>{editingRecord ? 'Edit MA Leave Record' : 'Add New MA Leave'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">SEO ID *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. KA10005"
                    value={formData.seoId}
                    onChange={(e) => setFormData({ ...formData, seoId: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">ID Name *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Ankit"
                    value={formData.idName}
                    onChange={(e) => setFormData({ ...formData, idName: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Mapping IDs</label>
                <input 
                  type="text"
                  placeholder="e.g. Moenage, BAU, Project"
                  value={formData.mappingIds}
                  onChange={(e) => setFormData({ ...formData, mappingIds: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">From (MM/DD/YYYY)</label>
                  <input 
                    type="text"
                    placeholder="06-08-2026"
                    value={formData.fromDate}
                    onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">To (MM/DD/YYYY)</label>
                  <input 
                    type="text"
                    placeholder="06-12-2026"
                    value={formData.toDate}
                    onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Applied</label>
                  <select 
                    value={formData.applied}
                    onChange={(e) => setFormData({ ...formData, applied: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Done">Done</option>
                    <option value="Pending">Pending</option>
                    <option value="Not Applied">Not Applied</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">MA Status</label>
                  <select 
                    value={formData.maStatus}
                    onChange={(e) => setFormData({ ...formData, maStatus: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Not started">Not started</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
