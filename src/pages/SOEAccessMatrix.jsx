import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Download, 
  CheckCircle2, 
  User, 
  Server, 
  X, 
  Filter, 
  Sparkles,
  Layers,
  Key,
  Globe,
  Database,
  Link,
  Users
} from 'lucide-react';
import { fetchSOEAccess, addSOEResource, updateSOEResource, deleteSOEResource } from '../lib/api';
import { exportToCsv } from '../lib/exportCsv';
import { trackButtonClick } from '../lib/analytics';

// System Platform definitions with display labels & colors
const PLATFORMS = [
  { key: 'drupal_sg', category: 'Drupal', label: 'Drupal SG', color: 'bg-emerald-500 text-white' },
  { key: 'drupal_ipb', category: 'Drupal', label: 'Drupal IPB', color: 'bg-emerald-600 text-white' },
  { key: 'drupal_uat2_sg', category: 'Drupal UAT2', label: 'Drupal UAT2 SG', color: 'bg-teal-500 text-white' },
  { key: 'drupal_uat2_ipb', category: 'Drupal UAT2', label: 'Drupal UAT2 IPB', color: 'bg-teal-600 text-white' },
  { key: 'drupal_cloud_sg', category: 'Drupal Cloud', label: 'Drupal Cloud SG', color: 'bg-indigo-500 text-white' },
  { key: 'drupal_cloud_ipb', category: 'Drupal Cloud', label: 'Drupal Cloud IPB', color: 'bg-indigo-600 text-white' },
  { key: 'drupal_cloud_uat2_sg', category: 'Drupal Cloud UAT2', label: 'Drupal Cloud UAT2 SG', color: 'bg-blue-500 text-white' },
  { key: 'drupal_cloud_uat2_ipb', category: 'Drupal Cloud UAT2', label: 'Drupal Cloud UAT2 IPB', color: 'bg-blue-600 text-white' },
  { key: 'moengage_sg', category: 'Moengage', label: 'Moengage SG', color: 'bg-purple-500 text-white' },
  { key: 'moengage_ipb', category: 'Moengage', label: 'Moengage IPB', color: 'bg-purple-600 text-white' },
  { key: 'aem_sg', category: 'AEM', label: 'AEM SG', color: 'bg-amber-500 text-white' },
  { key: 'aem_uat2_sg', category: 'AEM UAT2', label: 'AEM UAT2 SG', color: 'bg-orange-500 text-white' },
  { key: 'akamai_sg', category: 'Akamai', label: 'Akamai SG', color: 'bg-cyan-600 text-white' },
  { key: 'intralinks', category: 'IntraLinks', label: 'IntraLinks', color: 'bg-rose-500 text-white' },
  { key: 'icms_uat', category: 'ICMS', label: 'ICMS UAT', color: 'bg-slate-500 text-white' },
  { key: 'icms_rel1', category: 'ICMS', label: 'ICMS REL1', color: 'bg-slate-600 text-white' },
  { key: 'icms_rel2', category: 'ICMS', label: 'ICMS REL2', color: 'bg-slate-700 text-white' },
  { key: 'icms_ipb_uat', category: 'ICMS IPB', label: 'ICMS IPB UAT', color: 'bg-zinc-500 text-white' },
  { key: 'icms_ipb_rel1', category: 'ICMS IPB', label: 'ICMS IPB REL1', color: 'bg-zinc-600 text-white' },
  { key: 'icms_ipb_rel2', category: 'ICMS IPB', label: 'ICMS IPB REL2', color: 'bg-zinc-700 text-white' },
];

export default function SOEAccessMatrix() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('person'); // 'person' or 'system'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    soeId: '',
    email: '',
    accessFlags: {}
  });

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    setLoading(true);
    try {
      const data = await fetchSOEAccess();
      setResources(data);
    } catch (err) {
      console.error('Failed to load SOE access records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    trackButtonClick('SOE Access - Add Resource Modal');
    setEditingResource(null);
    setFormData({
      name: '',
      soeId: '',
      email: '',
      accessFlags: {}
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (resource) => {
    trackButtonClick('SOE Access - Edit Resource Modal');
    setEditingResource(resource);
    setFormData({
      name: resource.name || '',
      soeId: resource.soeId || '',
      email: resource.email || '',
      accessFlags: resource.accessFlags || {}
    });
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.soeId) {
      alert('Name and SOE ID are required');
      return;
    }

    try {
      if (editingResource) {
        const updated = await updateSOEResource(editingResource.id, formData);
        setResources(prev => prev.map(item => item.id === editingResource.id ? updated : item));
      } else {
        const created = await addSOEResource(formData);
        setResources(prev => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('Error saving resource access: ' + err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete access records for ${name}?`)) return;
    try {
      await deleteSOEResource(id);
      setResources(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      alert('Failed to delete resource: ' + err.message);
    }
  };

  // Quick toggle access flag directly on card/modal
  const handleToggleAccessFlag = async (resource, flagKey) => {
    try {
      const updatedFlags = {
        ...resource.accessFlags,
        [flagKey]: !resource.accessFlags?.[flagKey]
      };
      const updatedData = { ...resource, accessFlags: updatedFlags };
      const updated = await updateSOEResource(resource.id, updatedData);
      setResources(prev => prev.map(item => item.id === resource.id ? updated : item));
    } catch (err) {
      alert('Failed to toggle access: ' + err.message);
    }
  };

  // Filtered resources
  const filteredResources = resources.filter(res => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = 
      (res.name || '').toLowerCase().includes(term) ||
      (res.soeId || '').toLowerCase().includes(term) ||
      (res.email || '').toLowerCase().includes(term);

    if (selectedFilter === 'ALL') return matchesSearch;
    if (selectedFilter === 'AKAMAI') return matchesSearch && res.accessFlags?.akamai_sg;
    if (selectedFilter === 'DRUPAL') return matchesSearch && (res.accessFlags?.drupal_sg || res.accessFlags?.drupal_cloud_sg);
    if (selectedFilter === 'MOENGAGE') return matchesSearch && (res.accessFlags?.moengage_sg || res.accessFlags?.moengage_ipb);
    if (selectedFilter === 'AEM') return matchesSearch && (res.accessFlags?.aem_sg || res.accessFlags?.aem_uat2_sg);
    if (selectedFilter === 'INTRALINKS') return matchesSearch && res.accessFlags?.intralinks;
    return matchesSearch;
  });

  // Calculate stats
  const totalResources = resources.length;
  const aemAccessCount = resources.filter(r => r.accessFlags?.aem_sg || r.accessFlags?.aem_uat2_sg).length;
  const drupalAccessCount = resources.filter(r => r.accessFlags?.drupal_sg || r.accessFlags?.drupal_cloud_sg).length;
  const moengageAccessCount = resources.filter(r => r.accessFlags?.moengage_sg || r.accessFlags?.moengage_ipb).length;

  // Export CSV
  const handleExportCSV = () => {
    trackButtonClick('SOE Access - Export CSV');
    const exportData = filteredResources.map(r => {
      const activePlatforms = PLATFORMS.filter(p => r.accessFlags?.[p.key]).map(p => p.label).join('; ');
      return {
        'Resource Name': r.name,
        'SOE ID': r.soeId,
        'Email': r.email,
        'Total Granted Platforms': PLATFORMS.filter(p => r.accessFlags?.[p.key]).length,
        'Granted Platforms': activePlatforms || 'None'
      };
    });
    exportToCsv(exportData, `SOE_Access_Matrix_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 backdrop-blur-sm">
              <ShieldCheck className="w-6 h-6 text-indigo-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">SOE Access</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full">
              SOE Permissions
            </span>
          </div>
          <p className="text-indigo-200/80 text-sm pl-10">
            View, manage, and audit platform access rights for team members across Drupal, Akamai, Moengage, AEM, and ICMS.
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
            className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Resource</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Resources</p>
            <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{totalResources}</p>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-sm flex items-center justify-between bg-amber-50/20 dark:bg-amber-950/20">
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">AEM Access</p>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-300 mt-1">{aemAccessCount}</p>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-xl text-amber-700 dark:text-amber-300">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-sm flex items-center justify-between bg-emerald-50/20 dark:bg-emerald-950/20">
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Drupal Access</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-300 mt-1">{drupalAccessCount}</p>
          </div>
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl text-emerald-700 dark:text-emerald-300">
            <Server className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-purple-200 dark:border-purple-900/60 shadow-sm flex items-center justify-between bg-purple-50/20 dark:bg-purple-950/20">
          <div>
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Moengage Access</p>
            <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-300 mt-1">{moengageAccessCount}</p>
          </div>
          <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-xl text-purple-700 dark:text-purple-300">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Bar: View Switcher, Search, Filter Pills */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* View Switcher Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full md:w-auto">
          <button 
            onClick={() => setViewMode('person')}
            className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'person' ? 'bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Person Cards View</span>
          </button>
          
          <button 
            onClick={() => setViewMode('system')}
            className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'system' ? 'bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>System Auditor View</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input 
            type="text"
            placeholder="Search by SOE ID, Name, or Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'AKAMAI', label: 'Akamai' },
            { id: 'DRUPAL', label: 'Drupal' },
            { id: 'MOENGAGE', label: 'Moengage' },
            { id: 'AEM', label: 'AEM' },
            { id: 'INTRALINKS', label: 'IntraLinks' }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedFilter === filter.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium">Loading SOE Access records...</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <ShieldCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">No resources found</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Try adjusting search query or platform filters.</p>
        </div>
      ) : viewMode === 'person' ? (
        
        /* VIEW 1: PERSON PROFILE CARDS GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.map(resource => {
            const activeFlags = PLATFORMS.filter(p => resource.accessFlags?.[p.key]);
            const coveragePercent = Math.round((activeFlags.length / PLATFORMS.length) * 100);

            return (
              <div 
                key={resource.id} 
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  
                  {/* Card Header: Avatar, Name, SOE ID */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center shadow-md shadow-indigo-500/20 text-sm">
                        {resource.name ? resource.name.substring(0, 2).toUpperCase() : 'SO'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {resource.name}
                        </h3>
                        <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded w-fit mt-0.5 border border-indigo-100 dark:border-indigo-800/40">
                          {resource.soeId}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditModal(resource)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer"
                        title="Edit Permissions"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(resource.id, resource.name)}
                        className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                    {resource.email || 'No email associated'}
                  </p>

                  {/* Coverage Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-500 dark:text-slate-400">Access Coverage</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{activeFlags.length} / {PLATFORMS.length}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${coveragePercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Active Platform Badges */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Platforms</p>
                    {activeFlags.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">No platform access granted</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {activeFlags.map(p => (
                          <span 
                            key={p.key} 
                            className={`px-2 py-0.5 text-[11px] font-bold rounded-md shadow-2xs ${p.color}`}
                          >
                            {p.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleOpenEditModal(resource)}
                  className="w-full py-2 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 text-xs font-bold rounded-xl transition-all border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 flex items-center justify-center space-x-1.5 cursor-pointer mt-4"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Manage Access Rights</span>
                </button>
              </div>
            );
          })}
        </div>

      ) : (
        
        /* VIEW 2: SYSTEM ACCESS AUDITOR VIEW (BY PLATFORM) */
        <div className="space-y-4">
          {(() => {
            const displayPlatforms = PLATFORMS.filter(platform => {
              if (selectedFilter === 'AKAMAI') return platform.category === 'Akamai';
              if (selectedFilter === 'DRUPAL') return platform.category.toLowerCase().includes('drupal');
              if (selectedFilter === 'MOENGAGE') return platform.category === 'Moengage';
              if (selectedFilter === 'AEM') return platform.category.toLowerCase().includes('aem');
              if (selectedFilter === 'INTRALINKS') return platform.category === 'IntraLinks';
              return true;
            });

            // Filter out platforms with 0 members if search query is active
            const visiblePlatforms = displayPlatforms.filter(platform => {
              const membersWithAccess = filteredResources.filter(r => r.accessFlags?.[platform.key]);
              if (searchQuery.trim().length > 0) {
                return membersWithAccess.length > 0;
              }
              return true;
            });

            if (visiblePlatforms.length === 0) {
              return (
                <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Server className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-200">No platform access matches your filter</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Try selecting a different filter pill or clearing your search.</p>
                </div>
              );
            }

            return visiblePlatforms.map(platform => {
              const membersWithAccess = filteredResources.filter(r => r.accessFlags?.[platform.key]);

              return (
                <div key={platform.key} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-xs ${platform.color}`}>
                        {platform.label}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        Category: <span className="text-slate-800 dark:text-slate-200">{platform.category}</span>
                      </span>
                    </div>
                    
                    <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                      {membersWithAccess.length} Authorized Members
                    </span>
                  </div>

                  {membersWithAccess.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">No team members currently hold access to this environment.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                      {membersWithAccess.map(member => (
                        <div 
                          key={member.id} 
                          className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 transition-colors"
                        >
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                              {member.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{member.name}</p>
                              <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">{member.soeId}</p>
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleAccessFlag(member, platform.key)}
                            className="text-[11px] font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded transition-colors cursor-pointer"
                            title="Revoke Access"
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Permission Switch Manager Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingResource ? `Manage Access Rights: ${formData.name || 'Resource'}` : 'Add New Resource'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4 overflow-y-auto pr-1 flex-1">
              
              {/* Profile Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Resource Name *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Alwin"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">SOE ID *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. AJ26015"
                    value={formData.soeId}
                    onChange={(e) => setFormData({ ...formData, soeId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Official Email</label>
                  <input 
                    type="email"
                    placeholder="name@citi.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Toggable Platform Access Switches */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    Platform & Environment Access Toggles
                  </h4>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                    {PLATFORMS.filter(p => formData.accessFlags?.[p.key]).length} Granted
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PLATFORMS.map(platform => {
                    const isGranted = !!formData.accessFlags?.[platform.key];

                    return (
                      <div 
                        key={platform.key}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            accessFlags: {
                              ...formData.accessFlags,
                              [platform.key]: !isGranted
                            }
                          });
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isGranted ? 'bg-indigo-50/70 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700' : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isGranted ? 'bg-indigo-600 dark:bg-indigo-400 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                          <span className={`text-xs font-bold ${isGranted ? 'text-indigo-950 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-300'}`}>
                            {platform.label}
                          </span>
                        </div>

                        {/* Modern Switch UI */}
                        <div className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                          isGranted ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}>
                          <div className={`w-4 h-4 rounded-full bg-white dark:bg-slate-100 shadow-md transform transition-transform ${
                            isGranted ? 'translate-x-4' : 'translate-x-0'
                          }`}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer"
                >
                  Save Access Rights
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
