import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  GitCompare, 
  Plus, 
  Code2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Copy, 
  Check, 
  Pencil, 
  X, 
  Calendar, 
  User, 
  Tag, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Split,
  AlignLeft,
  FileCode,
  Trash2,
  RefreshCw,
  MessageSquare,
  Zap
} from 'lucide-react';
import { 
  fetchCalculators, 
  createCalculatorDefinition,
  updateCalculatorDefinition, 
  deleteCalculatorDefinition,
  fetchCalculatorVersions, 
  fetchVersionDetails, 
  saveCalculatorVersion, 
  submitCheckerReview, 
  deleteCalculatorVersion 
} from '../lib/api';
import { computeLineDiff } from '../lib/diffHelper';

export function getAutoVersionSuggestions(latestTag = '') {
  if (!latestTag) {
    return {
      patch: 'v1.0.0',
      minor: 'v1.0.0',
      major: 'v1.0.0',
      base: 'Initial'
    };
  }

  const clean = String(latestTag).trim();
  const match = clean.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i);

  if (!match) {
    return {
      patch: `${clean}.1`,
      minor: `${clean}-next`,
      major: `${clean}-v2`,
      base: clean
    };
  }

  const maj = parseInt(match[1] || '1', 10);
  const min = parseInt(match[2] || '0', 10);
  const pat = parseInt(match[3] || '0', 10);

  return {
    patch: `v${maj}.${min}.${pat + 1}`,
    minor: `v${maj}.${min + 1}.0`,
    major: `v${maj + 1}.0.0`,
    base: clean
  };
}

export default function CalculatorDiffTracker() {
  const [calculators, setCalculators] = useState([]);
  const [selectedCalcId, setSelectedCalcId] = useState('calc-1');
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [error, setError] = useState(null);

  // Selected versions for comparison
  const [targetVersionId, setTargetVersionId] = useState('');
  const [baseVersionId, setBaseVersionId] = useState('');
  const [targetVersionData, setTargetVersionData] = useState(null);
  const [baseVersionData, setBaseVersionData] = useState(null);

  // Diff view settings
  const [diffViewMode, setDiffViewMode] = useState('sideBySide'); // 'sideBySide' | 'unified'
  const [copiedCode, setCopiedCode] = useState(false);

  // Modal states
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [isEditingCalcName, setIsEditingCalcName] = useState(false);
  const [editCalcName, setEditCalcName] = useState('');
  const [editCalcDesc, setEditCalcDesc] = useState('');

  // Add New Page modal states
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [newPageDescription, setNewPageDescription] = useState('');
  const [creatingPage, setCreatingPage] = useState(false);
  const [pageCreateError, setPageCreateError] = useState('');

  // New Version Form State
  const [formVersionTag, setFormVersionTag] = useState('');
  const [formVersionBump, setFormVersionBump] = useState('patch'); // 'patch' | 'minor' | 'major' | 'custom'
  const [formCodeContent, setFormCodeContent] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formTicketNo, setFormTicketNo] = useState('');
  const [formModifiedBy, setFormModifiedBy] = useState('');
  const [formEnvironment, setFormEnvironment] = useState('Production');
  const [formBaseVersionId, setFormBaseVersionId] = useState('');
  const [submittingVersion, setSubmittingVersion] = useState(false);
  const [formError, setFormError] = useState('');

  // Base version tag for auto-incrementing
  const currentBaseTag = useMemo(() => {
    if (formBaseVersionId) {
      const found = versions.find(v => v.id === formBaseVersionId);
      if (found) return found.versionTag;
    }
    return versions.length > 0 ? versions[0].versionTag : '';
  }, [formBaseVersionId, versions]);

  // Auto-calculated suggestions based on currentBaseTag
  const autoSuggestions = useMemo(() => {
    return getAutoVersionSuggestions(currentBaseTag);
  }, [currentBaseTag]);

  // Automatically update formVersionTag whenever base version changes (unless user typed a custom tag)
  useEffect(() => {
    if (isNewVersionModalOpen && formVersionBump !== 'custom') {
      const next = autoSuggestions[formVersionBump] || autoSuggestions.patch;
      setFormVersionTag(next);
    }
  }, [currentBaseTag, formVersionBump, autoSuggestions, isNewVersionModalOpen]);

  // Checker Review State
  const [checkerName, setCheckerName] = useState('');
  const [checkerComments, setCheckerComments] = useState('');
  const [checkerStatus, setCheckerStatus] = useState('Approved');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState('');

  // Load Initial Calculators
  useEffect(() => {
    loadCalculators();
  }, []);

  // When selected calculator changes, load its versions
  useEffect(() => {
    if (selectedCalcId) {
      loadVersionsForCalc(selectedCalcId);
    }
  }, [selectedCalcId]);

  const loadCalculators = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCalculators();
      setCalculators(data);
      if (data.length > 0 && !selectedCalcId) {
        setSelectedCalcId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load calculators. Make sure server is running.');
    } finally {
      setLoading(false);
    }
  };

  const loadVersionsForCalc = async (calcId) => {
    try {
      setLoading(true);
      setError(null);
      const verList = await fetchCalculatorVersions(calcId);
      setVersions(verList);

      if (verList.length > 0) {
        // Set the latest as target
        const latest = verList[0];
        setTargetVersionId(latest.id);

        // Set previous version if exists
        if (verList.length > 1) {
          setBaseVersionId(verList[1].id);
        } else {
          setBaseVersionId('');
        }
      } else {
        setTargetVersionId('');
        setBaseVersionId('');
        setTargetVersionData(null);
        setBaseVersionData(null);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load version history for this calculator.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch full details of target and base versions whenever their IDs change
  useEffect(() => {
    if (!targetVersionId) {
      setTargetVersionData(null);
      setBaseVersionData(null);
      return;
    }

    const loadComparisonDetails = async () => {
      try {
        setLoadingDiff(true);
        const targetDetails = await fetchVersionDetails(targetVersionId);
        setTargetVersionData(targetDetails);

        // Prepopulate checker review form
        setCheckerName(targetDetails.checkerName || '');
        setCheckerComments(targetDetails.checkerComments || '');
        setCheckerStatus(targetDetails.status || 'Pending Review');
        setReviewSuccessMsg('');

        if (baseVersionId && baseVersionId !== targetVersionId) {
          const baseDetails = await fetchVersionDetails(baseVersionId);
          setBaseVersionData(baseDetails);
        } else if (targetDetails.previousVersionId) {
          const baseDetails = await fetchVersionDetails(targetDetails.previousVersionId);
          setBaseVersionData(baseDetails);
        } else {
          setBaseVersionData(null);
        }
      } catch (err) {
        console.error('Failed to load comparison details', err);
      } finally {
        setLoadingDiff(false);
      }
    };

    loadComparisonDetails();
  }, [targetVersionId, baseVersionId]);

  const activeCalculator = useMemo(() => {
    return calculators.find(c => c.id === selectedCalcId) || {
      id: selectedCalcId,
      name: 'Calculator',
      description: ''
    };
  }, [calculators, selectedCalcId]);

  // Compute Diff using diffHelper
  const diffResult = useMemo(() => {
    const oldCode = baseVersionData?.codeContent || '';
    const newCode = targetVersionData?.codeContent || '';
    return computeLineDiff(oldCode, newCode);
  }, [baseVersionData, targetVersionData]);

  // Live preview diff in modal
  const modalLiveDiff = useMemo(() => {
    if (!formCodeContent) return null;
    let baseCode = '';
    if (formBaseVersionId) {
      const found = versions.find(v => v.id === formBaseVersionId);
      if (found) {
        // Will diff against current active target if available
        baseCode = targetVersionData?.codeContent || '';
      }
    } else if (targetVersionData) {
      baseCode = targetVersionData.codeContent || '';
    }
    return computeLineDiff(baseCode, formCodeContent);
  }, [formCodeContent, formBaseVersionId, versions, targetVersionData]);

  // Copy code to clipboard
  const handleCopyCode = () => {
    if (!targetVersionData?.codeContent) return;
    navigator.clipboard.writeText(targetVersionData.codeContent);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Open Paste Modal
  const handleOpenPasteModal = () => {
    const defaultBaseId = versions.length > 0 ? versions[0].id : '';
    const baseTag = versions.length > 0 ? versions[0].versionTag : '';
    const suggestions = getAutoVersionSuggestions(baseTag);

    setFormVersionBump('patch');
    setFormVersionTag(suggestions.patch);
    setFormCodeContent('');
    setFormReason('');
    setFormSummary('');
    setFormTicketNo('');
    setFormModifiedBy('');
    setFormEnvironment('Production');
    setFormBaseVersionId(defaultBaseId);
    setFormError('');
    setIsNewVersionModalOpen(true);
  };

  // Submit New Code Version
  const handleSubmitNewVersion = async (e) => {
    e.preventDefault();
    let finalVersionTag = formVersionTag.trim();
    if (!finalVersionTag) {
      finalVersionTag = autoSuggestions[formVersionBump] || autoSuggestions.patch || 'v1.0.0';
      setFormVersionTag(finalVersionTag);
    }
    if (!formCodeContent.trim()) {
      setFormError('Please paste the complete code of the calculator.');
      return;
    }
    if (!formReason.trim()) {
      setFormError('Please provide the reason why this code was modified.');
      return;
    }

    try {
      setSubmittingVersion(true);
      setFormError('');
      const payload = {
        versionTag: finalVersionTag,
        codeContent: formCodeContent,
        reasonForChange: formReason.trim(),
        changeSummary: formSummary.trim(),
        ticketNo: formTicketNo.trim(),
        modifiedBy: formModifiedBy.trim() || 'Team Member',
        environment: formEnvironment,
        previousVersionId: formBaseVersionId || (versions.length > 0 ? versions[0].id : null)
      };

      const created = await saveCalculatorVersion(selectedCalcId, payload);
      setIsNewVersionModalOpen(false);
      // Reload versions and calculators
      await loadCalculators();
      await loadVersionsForCalc(selectedCalcId);
      setTargetVersionId(created.id);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Failed to save code version.');
    } finally {
      setSubmittingVersion(false);
    }
  };

  // Submit Checker Review
  const handleSubmitCheckerReview = async (e) => {
    e.preventDefault();
    if (!targetVersionId) return;

    try {
      setSubmittingReview(true);
      setReviewSuccessMsg('');
      await submitCheckerReview(targetVersionId, {
        checkerComments: checkerComments.trim(),
        checkerName: checkerName.trim() || 'Checker',
        status: checkerStatus
      });
      setReviewSuccessMsg('Review & comments saved successfully!');
      setTimeout(() => setReviewSuccessMsg(''), 4000);
      // Refresh version list to update status badge
      const verList = await fetchCalculatorVersions(selectedCalcId);
      setVersions(verList);
      loadCalculators();
    } catch (err) {
      console.error(err);
      alert('Failed to save checker review: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Delete version
  const handleDeleteVersion = async (verId, verTag) => {
    if (!window.confirm(`Are you sure you want to delete version ${verTag}? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteCalculatorVersion(verId);
      await loadVersionsForCalc(selectedCalcId);
      await loadCalculators();
    } catch (err) {
      alert('Failed to delete version: ' + err.message);
    }
  };

  // Rename Page
  const handleSaveCalcName = async () => {
    if (!editCalcName.trim()) return;
    try {
      await updateCalculatorDefinition(selectedCalcId, {
        name: editCalcName.trim(),
        description: editCalcDesc.trim()
      });
      setIsEditingCalcName(false);
      await loadCalculators();
    } catch (err) {
      alert('Failed to update page: ' + err.message);
    }
  };

  // Add New Page
  const handleCreateNewPage = async (e) => {
    e.preventDefault();
    if (!newPageName.trim()) {
      setPageCreateError('Page name is required');
      return;
    }
    try {
      setCreatingPage(true);
      setPageCreateError('');
      const created = await createCalculatorDefinition({
        name: newPageName.trim(),
        description: newPageDescription.trim(),
        category: 'AEM Page'
      });
      await loadCalculators();
      setSelectedCalcId(created.id);
      setIsAddPageModalOpen(false);
      setNewPageName('');
      setNewPageDescription('');
    } catch (err) {
      console.error(err);
      setPageCreateError(err.message || 'Failed to create page');
    } finally {
      setCreatingPage(false);
    }
  };

  // Delete Page
  const handleDeletePage = async () => {
    if (!window.confirm(`Are you sure you want to delete "${activeCalculator.name}" and all its recorded code versions? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteCalculatorDefinition(selectedCalcId);
      const updated = await fetchCalculators();
      setCalculators(updated);
      if (updated.length > 0) {
        setSelectedCalcId(updated[0].id);
      } else {
        setSelectedCalcId('');
        setVersions([]);
      }
    } catch (err) {
      alert('Failed to delete page: ' + err.message);
    }
  };

  // Export Version History to CSV
  const handleExportCSV = () => {
    if (versions.length === 0) {
      alert('No version history to export.');
      return;
    }
    const headers = [
      'Page Name',
      'Version Tag',
      'Deployment Date',
      'Modified By',
      'Ticket No',
      'Environment',
      'Lines Added',
      'Lines Removed',
      'Reason For Modification',
      'Change Summary',
      'Checker Status',
      'Checker Name',
      'Checker Comments'
    ];

    const rows = versions.map(v => [
      `"${activeCalculator.name.replace(/"/g, '""')}"`,
      `"${(v.versionTag || '').replace(/"/g, '""')}"`,
      `"${(v.createdAt || '').slice(0, 10)}"`,
      `"${(v.modifiedBy || '').replace(/"/g, '""')}"`,
      `"${(v.ticketNo || '').replace(/"/g, '""')}"`,
      `"${(v.environment || '').replace(/"/g, '""')}"`,
      v.linesAdded || 0,
      v.linesRemoved || 0,
      `"${(v.reasonForChange || '').replace(/"/g, '""')}"`,
      `"${(v.changeSummary || '').replace(/"/g, '""')}"`,
      `"${(v.status || '').replace(/"/g, '""')}"`,
      `"${(v.checkerName || '').replace(/"/g, '""')}"`,
      `"${(v.checkerComments || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeCalculator.name.replace(/\s+/g, '_')}_audit_history.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-800 dark:text-slate-100">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <GitCompare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Page Code Difference & Version Tracker
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Paste page code changes, view line-by-line diffs, document reasons for modification, and manage checker approvals.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-3 flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export Audit Log</span>
          </button>
          
          <button
            onClick={handleOpenPasteModal}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold shadow-md shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Paste New Page Code</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Page Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {calculators.map((calc, idx) => {
          const isSelected = calc.id === selectedCalcId;
          const hasPending = (calc.pendingCount || 0) > 0;
          return (
            <button
              key={calc.id}
              onClick={() => setSelectedCalcId(calc.id)}
              className={`text-left p-4 rounded-2xl border transition-all relative overflow-hidden cursor-pointer ${
                isSelected 
                  ? 'bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border-indigo-500 shadow-md ring-2 ring-indigo-500/20 dark:border-indigo-400' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Page {idx + 1}
                </span>
                {hasPending && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                    Review Needed
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {calc.name}
              </h3>
              <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {calc.latestVersion ? calc.latestVersion.versionTag : 'No versions'}
                  </span>
                </div>
                <span>{calc.totalVersions || 0} revisions</span>
              </div>
            </button>
          );
        })}

        {/* Add New Page Button Card */}
        <button
          onClick={() => {
            setNewPageName('');
            setNewPageDescription('');
            setPageCreateError('');
            setIsAddPageModalOpen(true);
          }}
          className="p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-400 bg-white/40 dark:bg-slate-900/40 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all flex flex-col items-center justify-center text-center group cursor-pointer min-h-[105px]"
        >
          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-purple-600">
            + Add New Page
          </span>
          <span className="text-[10px] text-slate-400">Track another AEM page</span>
        </button>
      </div>

      {/* Page Header & Rename Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {isEditingCalcName ? (
          <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              type="text"
              value={editCalcName}
              onChange={(e) => setEditCalcName(e.target.value)}
              placeholder="Page Name (e.g. Loan Application Page)"
              className="px-3 py-1.5 rounded-lg border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-800 text-sm font-semibold w-full sm:w-64 focus:outline-hidden"
            />
            <input
              type="text"
              value={editCalcDesc}
              onChange={(e) => setEditCalcDesc(e.target.value)}
              placeholder="Page Description / URL Path"
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm w-full sm:w-80 focus:outline-hidden"
            />
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSaveCalcName}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingCalcName(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {activeCalculator.name}
                </h2>
                <button
                  onClick={() => {
                    setEditCalcName(activeCalculator.name);
                    setEditCalcDesc(activeCalculator.description || '');
                    setIsEditingCalcName(true);
                  }}
                  title="Rename page"
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDeletePage}
                  title="Delete this page"
                  className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeCalculator.description || 'AEM Page Component'}
              </p>
            </div>
          </div>
        )}

        {/* Quick KPI stats */}
        <div className="flex items-center space-x-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <span className="text-slate-400">Total Versions:</span>
            <span className="font-bold text-slate-900 dark:text-white">{versions.length}</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <span className="text-slate-400">Current Live:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {versions[0]?.versionTag || 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Diff & Review Workspace */}
      {versions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
            <Code2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            No code versions logged for {activeCalculator.name} yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2 mb-6">
            Paste the current or updated page code from AEM to start tracking code diffs, reasons for modification, and checker comments.
          </p>
          <button
            onClick={handleOpenPasteModal}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Paste Initial Page Code</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Version Selector & Diff Controls Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Version Pickers */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Compare Version:</span>
                <select
                  value={targetVersionId}
                  onChange={(e) => setTargetVersionId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.versionTag} ({v.createdAt ? v.createdAt.slice(0, 10) : ''} - {v.modifiedBy})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">With Previous:</span>
                <select
                  value={baseVersionId}
                  onChange={(e) => setBaseVersionId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">(None / Initial Version)</option>
                  {versions.filter(v => v.id !== targetVersionId).map(v => (
                    <option key={v.id} value={v.id}>
                      {v.versionTag} ({v.createdAt ? v.createdAt.slice(0, 10) : ''})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* View Mode & Stats */}
            <div className="flex items-center space-x-3">
              {/* Diff Add/Remove Counters */}
              <div className="flex items-center space-x-2 text-xs font-mono font-bold">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  +{diffResult.stats.additions} added
                </span>
                <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                  -{diffResult.stats.deletions} removed
                </span>
              </div>

              {/* View Switcher: Side-by-Side vs Unified */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setDiffViewMode('sideBySide')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    diffViewMode === 'sideBySide'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>Split View</span>
                </button>
                <button
                  onClick={() => setDiffViewMode('unified')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    diffViewMode === 'unified'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Unified View</span>
                </button>
              </div>

              {/* Copy Code */}
              <button
                onClick={handleCopyCode}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Copy current version code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          {/* Reason for Modification & Metadata Banner */}
          {targetVersionData && (
            <div className="bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-slate-900/5 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-slate-900/40 border-l-4 border-l-purple-600 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-600 text-white shadow-xs">
                    {targetVersionData.versionTag}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Deployed on {targetVersionData.createdAt ? targetVersionData.createdAt.slice(0, 10) : 'N/A'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Modified by: <strong className="font-bold">{targetVersionData.modifiedBy}</strong>
                  </span>
                  {targetVersionData.ticketNo && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {targetVersionData.ticketNo}
                      </span>
                    </>
                  )}
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {targetVersionData.environment || 'Production'}
                  </span>
                </div>

                {/* Status Badge */}
                <div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center space-x-1.5 ${
                    targetVersionData.status === 'Approved'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      : targetVersionData.status === 'Changes Requested'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      targetVersionData.status === 'Approved' ? 'bg-emerald-500' : targetVersionData.status === 'Changes Requested' ? 'bg-rose-500' : 'bg-amber-500'
                    }`} />
                    <span>{targetVersionData.status || 'Pending Review'}</span>
                  </span>
                </div>
              </div>

              {/* The "Why it was modified" statement */}
              <div className="bg-white/70 dark:bg-slate-900/70 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-xs font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1">
                  Why this code was modified:
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {targetVersionData.reasonForChange}
                </p>
                {targetVersionData.changeSummary && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                    <strong>Change Summary:</strong> {targetVersionData.changeSummary}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Visual Difference Viewer */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-indigo-500" />
                <span>Code Difference ({diffViewMode === 'sideBySide' ? 'Split Side-by-Side' : 'Unified Lines'})</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {diffResult.stats.additions + diffResult.stats.deletions === 0 
                  ? 'No changes between selected versions'
                  : `${diffResult.stats.additions} additions, ${diffResult.stats.deletions} deletions`}
              </div>
            </div>

            {loadingDiff ? (
              <div className="p-12 text-center text-slate-400 flex items-center justify-center space-x-2">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                <span className="text-sm font-semibold">Computing code difference...</span>
              </div>
            ) : diffViewMode === 'sideBySide' ? (
              
              /* Side-by-Side Diff Table */
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                      <th className="w-12 py-2 px-2 text-right border-r border-slate-200 dark:border-slate-800">#</th>
                      <th className="w-1/2 py-2 px-3 text-left border-r border-slate-200 dark:border-slate-800">
                        {baseVersionData ? `${baseVersionData.versionTag} (Previous)` : 'Baseline'}
                      </th>
                      <th className="w-12 py-2 px-2 text-right border-r border-slate-200 dark:border-slate-800">#</th>
                      <th className="w-1/2 py-2 px-3 text-left">
                        {targetVersionData ? `${targetVersionData.versionTag} (Target)` : 'New Code'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffResult.sideBySide.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">No code to display</td>
                      </tr>
                    ) : (
                      diffResult.sideBySide.map((row, idx) => {
                        const leftType = row.left?.type;
                        const rightType = row.right?.type;

                        const leftBg = leftType === 'removed' ? 'bg-rose-500/15 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200' : '';
                        const rightBg = rightType === 'added' ? 'bg-emerald-500/15 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200' : '';

                        return (
                          <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            {/* Left line number */}
                            <td className="w-12 px-2 py-1 text-right text-slate-400 select-none border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                              {row.left ? row.left.lineNumber : ''}
                            </td>
                            {/* Left content */}
                            <td className={`w-1/2 px-3 py-1 whitespace-pre-wrap break-all border-r border-slate-200 dark:border-slate-800 ${leftBg}`}>
                              {row.left ? row.left.content : ''}
                            </td>
                            {/* Right line number */}
                            <td className="w-12 px-2 py-1 text-right text-slate-400 select-none border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                              {row.right ? row.right.lineNumber : ''}
                            </td>
                            {/* Right content */}
                            <td className={`w-1/2 px-3 py-1 whitespace-pre-wrap break-all ${rightBg}`}>
                              {row.right ? row.right.content : ''}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            ) : (

              /* Unified Diff View */
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                      <th className="w-12 py-2 px-2 text-right border-r border-slate-200 dark:border-slate-800">Old</th>
                      <th className="w-12 py-2 px-2 text-right border-r border-slate-200 dark:border-slate-800">New</th>
                      <th className="w-8 py-2 text-center border-r border-slate-200 dark:border-slate-800">+/-</th>
                      <th className="py-2 px-3 text-left">Code Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffResult.unified.map((edit, idx) => {
                      let rowStyle = '';
                      let sign = ' ';
                      let signStyle = 'text-slate-400';

                      if (edit.type === 'added') {
                        rowStyle = 'bg-emerald-500/15 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold';
                        sign = '+';
                        signStyle = 'text-emerald-600 font-bold';
                      } else if (edit.type === 'removed') {
                        rowStyle = 'bg-rose-500/15 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200';
                        sign = '-';
                        signStyle = 'text-rose-600 font-bold';
                      }

                      return (
                        <tr key={idx} className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${rowStyle}`}>
                          <td className="w-12 px-2 py-0.5 text-right text-slate-400 select-none border-r border-slate-200 dark:border-slate-800">
                            {edit.oldLineNumber || ''}
                          </td>
                          <td className="w-12 px-2 py-0.5 text-right text-slate-400 select-none border-r border-slate-200 dark:border-slate-800">
                            {edit.newLineNumber || ''}
                          </td>
                          <td className={`w-8 px-1 py-0.5 text-center select-none border-r border-slate-200 dark:border-slate-800 ${signStyle}`}>
                            {sign}
                          </td>
                          <td className="px-3 py-0.5 whitespace-pre-wrap break-all">
                            {edit.content}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Checker / Reviewer Comments Panel */}
          {targetVersionData && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Checker Review & Sign-Off
                  </h3>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Target Version: <span className="font-bold text-purple-600">{targetVersionData.versionTag}</span>
                </div>
              </div>

              {reviewSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{reviewSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmitCheckerReview} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Checker Name / SOE ID:
                    </label>
                    <input
                      type="text"
                      value={checkerName}
                      onChange={(e) => setCheckerName(e.target.value)}
                      placeholder="e.g. Alwin / Lead Reviewer"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Approval Status:
                    </label>
                    <select
                      value={checkerStatus}
                      onChange={(e) => setCheckerStatus(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Approved">Verified & Approved (Ready for AEM)</option>
                      <option value="Pending Review">Pending Review</option>
                      <option value="Changes Requested">Changes Requested (Fix Required)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Checker Comments / Validation Notes:
                  </label>
                  <textarea
                    rows={3}
                    value={checkerComments}
                    onChange={(e) => setCheckerComments(e.target.value)}
                    placeholder="Provide review feedback (e.g. 'Verified formula calculation against sample test cases in UAT. All rounding rules match requirements.')"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{submittingReview ? 'Saving Review...' : 'Save Checker Sign-Off'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Complete Version History Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Version History & Audit Log ({activeCalculator.name})
                </h3>
              </div>
              <span className="text-xs text-slate-400">Total {versions.length} revisions</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Modified By</th>
                    <th className="py-3 px-4">Ticket #</th>
                    <th className="py-3 px-4">Why It Was Modified</th>
                    <th className="py-3 px-4">Diff</th>
                    <th className="py-3 px-4">Checker Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {versions.map((ver) => {
                    const isSelected = ver.id === targetVersionId;
                    return (
                      <tr 
                        key={ver.id}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                          isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <button
                            onClick={() => setTargetVersionId(ver.id)}
                            className="hover:underline text-purple-600 dark:text-purple-400"
                          >
                            {ver.versionTag}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {ver.createdAt ? ver.createdAt.slice(0, 10) : '-'}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {ver.modifiedBy}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {ver.ticketNo || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={ver.reasonForChange}>
                          {ver.reasonForChange}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono">
                          <span className="text-emerald-600 font-bold">+{ver.linesAdded || 0}</span>
                          {' / '}
                          <span className="text-rose-600 font-bold">-{ver.linesRemoved || 0}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ver.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : ver.status === 'Changes Requested'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}>
                            {ver.status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => setTargetVersionId(ver.id)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 font-bold cursor-pointer"
                          >
                            View Diff
                          </button>
                          <button
                            onClick={() => handleDeleteVersion(ver.id, ver.versionTag)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete version"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: PASTE NEW CODE VERSION                        */}
      {/* ==================================================== */}
      {isNewVersionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full p-6 md:p-8 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-purple-600 text-white">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    Paste New Page Code Version
                  </h3>
                  <p className="text-xs text-slate-500">
                    Recording modification for <strong className="text-indigo-600 dark:text-indigo-400">{activeCalculator.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewVersionModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitNewVersion} className="space-y-4">
              
              {/* Auto-Updated Version Tag Section */}
              <div className="bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-slate-500/5 dark:from-purple-950/20 dark:via-indigo-950/20 dark:to-slate-900/40 p-4 rounded-2xl border border-purple-200/70 dark:border-purple-800/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>Version Tag</span>
                      </label>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        ⚡ Auto-Updates Automatically
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Automatically calculated from base version <strong className="font-mono text-purple-600 dark:text-purple-400 font-bold">{currentBaseTag || 'None'}</strong>. Select an increment type or type a custom tag.
                    </p>
                  </div>

                  {/* Version Tag Input */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      required
                      value={formVersionTag}
                      onChange={(e) => {
                        setFormVersionTag(e.target.value);
                        setFormVersionBump('custom');
                      }}
                      placeholder="e.g. v1.1.1"
                      className="px-3 py-1.5 rounded-xl border-2 border-purple-400 dark:border-purple-600 bg-white dark:bg-slate-800 text-sm font-mono font-extrabold text-purple-700 dark:text-purple-300 w-36 text-center focus:outline-hidden focus:ring-2 focus:ring-purple-500 shadow-xs"
                    />
                    {formVersionBump === 'custom' && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormVersionBump('patch');
                          setFormVersionTag(autoSuggestions.patch);
                        }}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                      >
                        Reset to Auto
                      </button>
                    )}
                  </div>
                </div>

                {/* Auto-Increment Type Selection Pills */}
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-purple-100 dark:border-purple-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Auto-Increment:</span>

                  <button
                    type="button"
                    onClick={() => {
                      setFormVersionBump('patch');
                      setFormVersionTag(autoSuggestions.patch);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      formVersionBump === 'patch'
                        ? 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-400/30'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-purple-300'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-amber-300" />
                    <span>Patch: {autoSuggestions.patch}</span>
                    <span className="text-[10px] font-normal opacity-80">(Bug fix / tweak)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormVersionBump('minor');
                      setFormVersionTag(autoSuggestions.minor);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      formVersionBump === 'minor'
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400/30'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <span>Minor: {autoSuggestions.minor}</span>
                    <span className="text-[10px] font-normal opacity-80">(Formula / logic update)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormVersionBump('major');
                      setFormVersionTag(autoSuggestions.major);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      formVersionBump === 'major'
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/30'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                    }`}
                  >
                    <span>Major: {autoSuggestions.major}</span>
                    <span className="text-[10px] font-normal opacity-80">(Major release)</span>
                  </button>
                </div>
              </div>

              {/* Row 1: Environment & Ticket No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Jira / Ticket # / Reference
                  </label>
                  <input
                    type="text"
                    value={formTicketNo}
                    onChange={(e) => setFormTicketNo(e.target.value)}
                    placeholder="e.g. GCPC-20776 or CHG-9842"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Environment
                  </label>
                  <select
                    value={formEnvironment}
                    onChange={(e) => setFormEnvironment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Production">Production</option>
                    <option value="UAT">UAT</option>
                    <option value="Staging">Staging</option>
                    <option value="DEV">DEV</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Modified By & Compare Against */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Modified By (Developer / SOE ID)
                  </label>
                  <input
                    type="text"
                    value={formModifiedBy}
                    onChange={(e) => setFormModifiedBy(e.target.value)}
                    placeholder="e.g. Alwin (AJ26015)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Compare Against Previous Version
                  </label>
                  <select
                    value={formBaseVersionId}
                    onChange={(e) => setFormBaseVersionId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {versions.length === 0 ? (
                      <option value="">(No previous versions - this will be v1)</option>
                    ) : (
                      versions.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.versionTag} ({v.createdAt ? v.createdAt.slice(0, 10) : ''})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* The "Why it was modified" input */}
              <div>
                <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 mb-1">
                  Why was this code modified? (Reason / Root Cause) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="e.g. Revised statutory interest rate ceiling from 7.5% to 8.2% per regulatory circular. Updated amortization formula to match new schedule."
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-purple-300 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-950/20 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Full Code Content Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                    Paste Full Page Code <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formCodeContent ? `${formCodeContent.split(/\r?\n/).length} lines` : '0 lines'}
                  </span>
                </div>
                <textarea
                  required
                  rows={10}
                  value={formCodeContent}
                  onChange={(e) => setFormCodeContent(e.target.value)}
                  placeholder="// Paste your complete page JS / HTML / HTL script code here..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Instant Diff Preview inside modal */}
              {modalLiveDiff && modalLiveDiff.stats && formCodeContent && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-bold">Instant Diff Preview:</span>
                  <div className="space-x-3">
                    <span className="text-emerald-600 font-bold">+{modalLiveDiff.stats.additions} lines added</span>
                    <span className="text-rose-600 font-bold">-{modalLiveDiff.stats.deletions} lines removed</span>
                    <span className="text-slate-500 font-normal">{modalLiveDiff.stats.unchanged} unchanged</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewVersionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingVersion}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingVersion ? 'Saving Version...' : 'Save & Track Version'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD NEW PAGE                                  */}
      {/* ==================================================== */}
      {isAddPageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-purple-600 text-white">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Add New Page to Track
                  </h3>
                  <p className="text-xs text-slate-500">
                    Register another AEM page to track code changes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddPageModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pageCreateError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {pageCreateError}
              </div>
            )}

            <form onSubmit={handleCreateNewPage} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Page Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder="e.g. Credit Card Apply Page"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  AEM URL Path / Description
                </label>
                <input
                  type="text"
                  value={newPageDescription}
                  onChange={(e) => setNewPageDescription(e.target.value)}
                  placeholder="e.g. /content/citi/sg/en/cards/apply"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPageModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPage}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {creatingPage ? 'Creating Page...' : 'Create & Start Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
