import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { 
  TableProperties, 
  RefreshCw, 
  Search, 
  Download, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  CheckCircle2, 
  FolderGit2, 
  Calendar, 
  Layers, 
  TrendingUp, 
  Filter, 
  ExternalLink,
  PieChart,
  BarChart3,
  SlidersHorizontal,
  X,
  FileText,
  Tag
} from 'lucide-react';
import { fetchTrackerData, syncTrackerData } from '../lib/api';
import { trackButtonClick } from '../lib/analytics';

// Month sort order
const MONTH_ORDER = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

// Standard environment display priority
const ENV_ORDER = ['AEM', 'ICMS', 'Drupal', 'MOE'];

// Extract core GCPC code (e.g. "GCPC-20776", "GCPC-17344") from raw titles
function extractWmrKey(raw) {
  if (!raw) return 'Unknown';
  const str = raw.trim();
  const match = str.match(/GCPC[-\s]?\d+/i);
  if (match) {
    return match[0].toUpperCase().replace(/\s+/, '-');
  }
  return str;
}

function sortEnvs(a, b) {
  const ia = ENV_ORDER.indexOf(a);
  const ib = ENV_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

function getEnvBadgeStyles(env) {
  switch (env) {
    case 'AEM':
      return {
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
        dot: 'bg-indigo-600 dark:bg-indigo-400',
        border: 'border-l-4 border-l-indigo-500',
        bar: 'bg-indigo-500'
      };
    case 'ICMS':
      return {
        badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
        dot: 'bg-sky-500 dark:bg-sky-400',
        border: 'border-l-4 border-l-sky-500',
        bar: 'bg-sky-500'
      };
    case 'Drupal':
      return {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        border: 'border-l-4 border-l-emerald-500',
        bar: 'bg-emerald-500'
      };
    case 'MOE':
      return {
        badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        dot: 'bg-amber-500 dark:bg-amber-400',
        border: 'border-l-4 border-l-amber-500',
        bar: 'bg-amber-500'
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        dot: 'bg-slate-500 dark:bg-slate-400',
        border: 'border-l-4 border-l-slate-400',
        bar: 'bg-slate-500'
      };
  }
}

function parseChangeCount(val) {
  if (val == null || val === '') return 0;
  let str = String(val).trim();
  // If comma is used as decimal separator (e.g. "1,5"), convert to "1.5" instead of stripping it
  if (/^\d+,\d+$/.test(str)) {
    str = str.replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseIterationCount(val) {
  if (val == null || val === '') return 0;
  const num = parseInt(String(val).replace(/,/g, '').trim(), 10);
  return isNaN(num) ? 0 : num;
}

function formatCount(num) {
  if (num == null || num === 0) return '-';
  // If whole number (or very close), display as whole integer
  if (Math.abs(num - Math.round(num)) < 0.0001) {
    return Math.round(num).toString();
  }
  // Otherwise display up to 2 decimal places, removing unnecessary trailing zeros
  return parseFloat(num.toFixed(2)).toString();
}

export default function ResourceTracker() {
  const [dataRows, setDataRows] = useState([]);
  const [lastSynced, setLastSynced] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Active Tab: 'resource' (View 1), 'wmr' (View 2), 'weekly' (View 3), 'environment' (View 4)
  const [activeTab, setActiveTab] = useState('resource');

  // Global Filters
  const [selectedMonth, setSelectedMonth] = useState('Oct');
  const [selectedResource, setSelectedResource] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Expand states for hierarchical tables
  const [expandedResources, setExpandedResources] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedEnvironments, setExpandedEnvironments] = useState({});

  // Tab 4 State (Environment Breakdown)
  const [envTimeView, setEnvTimeView] = useState('daily'); // 'daily' | 'weekly'
  const [envSubViewBy, setEnvSubViewBy] = useState('taskTypes'); // 'taskTypes' | 'resources'
  const [selectedEnvFilter, setSelectedEnvFilter] = useState('ALL'); // 'ALL' | 'AEM' | 'ICMS' | 'Drupal' | 'MOE'
  const [activeTaskTypeDetails, setActiveTaskTypeDetails] = useState(null);
  const [taskDetailsSearch, setTaskDetailsSearch] = useState('');

  // Pagination for WMR Tab
  const [wmrPage, setWmrPage] = useState(1);
  const [wmrPageSize, setWmrPageSize] = useState(25);
  const [wmrSortField, setWmrSortField] = useState('changes'); // 'changes', 'iterations', 'wmr'
  const [wmrSortAsc, setWmrSortAsc] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchTrackerData();
      if (res && res.rows) {
        setDataRows(res.rows);
        setLastSynced(res.lastSynced);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data from Google Sheet');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      trackButtonClick('Tracker - Sync Now');
      const res = await syncTrackerData();
      if (res && res.rows) {
        setDataRows(res.rows);
        setLastSynced(res.lastSynced);
      }
    } catch (err) {
      console.error(err);
      setError('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Discover all distinct months in data
  const availableMonths = useMemo(() => {
    const set = new Set();
    dataRows.forEach(r => {
      if (r.Month) set.add(r.Month);
    });
    return Array.from(set).sort((a, b) => {
      const ia = MONTH_ORDER.indexOf(a);
      const ib = MONTH_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [dataRows]);

  // Discover all distinct resources
  const availableResources = useMemo(() => {
    const set = new Set();
    dataRows.forEach(r => {
      const name = r['Resource Name'];
      if (name && name.trim()) set.add(name.trim());
    });
    return Array.from(set).sort();
  }, [dataRows]);

  // Discover all distinct environments
  const availableEnvironments = useMemo(() => {
    const set = new Set();
    dataRows.forEach(r => {
      if (r.Environment) {
        r.Environment.split(',').forEach(e => {
          const trimmed = e.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort(sortEnvs);
  }, [dataRows]);

  // Filtered rows by month
  const monthFilteredRows = useMemo(() => {
    if (selectedMonth === 'ALL') return dataRows;
    return dataRows.filter(r => r.Month === selectedMonth);
  }, [dataRows, selectedMonth]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const targetRows = monthFilteredRows;
    let totalChanges = 0;
    let ftrCount = 0;
    const uniqueWmrs = new Set();
    const activeStaff = new Set();

    targetRows.forEach(r => {
      const c = parseChangeCount(r['Changes Count']);
      totalChanges += c;
      if (r.WMR) {
        uniqueWmrs.add(extractWmrKey(r.WMR));
      }
      if (r['Resource Name']) activeStaff.add(r['Resource Name'].trim());
      if (r['QC Status'] === 'FTR') ftrCount++;
    });

    const ftrRate = targetRows.length > 0 ? ((ftrCount / targetRows.length) * 100).toFixed(1) : 100;

    return {
      totalChanges,
      totalTasks: targetRows.length,
      uniqueWmrs: uniqueWmrs.size,
      activeStaff: activeStaff.size,
      ftrRate
    };
  }, [monthFilteredRows]);

  // ==========================================
  // VIEW 1: Resource Changes by Date Aggregation
  // ==========================================
  const view1Data = useMemo(() => {
    const targetRows = monthFilteredRows.filter(r => {
      if (selectedResource === 'ALL') return true;
      return r['Resource Name'] === selectedResource;
    });

    // 1. Collect all unique dates and sort chronologically
    const dateMap = {}; // { '1-Oct-2026': timestamp }
    targetRows.forEach(r => {
      const d = r.Date;
      if (d && !dateMap[d]) {
        // Try parsing date string like '1-Oct-2026'
        const parts = d.split('-');
        let time = 0;
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const mon = parts[1];
          const yr = parseInt(parts[2], 10);
          const monIdx = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
            .indexOf(mon.toLowerCase());
          time = new Date(yr, monIdx, day).getTime();
        }
        dateMap[d] = isNaN(time) ? 0 : time;
      }
    });

    const dates = Object.keys(dateMap).sort((a, b) => (dateMap[a] || 0) - (dateMap[b] || 0));

    // 2. Aggregate per resource and environment
    const resources = {};
    const dateGrandTotals = {};
    dates.forEach(d => { dateGrandTotals[d] = 0; });
    let overallGrandTotal = 0;

    targetRows.forEach(r => {
      const res = r['Resource Name'] ? r['Resource Name'].trim() : 'Unknown';
      const rawEnv = r.Environment ? r.Environment.trim() : 'Unspecified';
      const d = r.Date;
      const count = parseChangeCount(r['Changes Count']);

      if (!resources[res]) {
        resources[res] = {
          name: res,
          total: 0,
          byDate: {},
          environments: {}
        };
      }

      resources[res].total += count;
      resources[res].byDate[d] = (resources[res].byDate[d] || 0) + count;

      // Option 1: Split multi-environment (e.g. "Drupal, AEM, ICMS") equally across single environments
      const envList = rawEnv.split(',').map(s => s.trim()).filter(Boolean);
      const effectiveEnvs = envList.length > 0 ? envList : ['Unspecified'];
      const perEnvCount = count / effectiveEnvs.length;

      effectiveEnvs.forEach(env => {
        if (!resources[res].environments[env]) {
          resources[res].environments[env] = {
            envName: env,
            total: 0,
            byDate: {}
          };
        }
        resources[res].environments[env].total += perEnvCount;
        resources[res].environments[env].byDate[d] = (resources[res].environments[env].byDate[d] || 0) + perEnvCount;
      });

      if (d) {
        dateGrandTotals[d] = (dateGrandTotals[d] || 0) + count;
      }
      overallGrandTotal += count;
    });

    const resourceList = Object.values(resources).sort((a, b) => a.name.localeCompare(b.name));

    return {
      dates,
      resources: resourceList,
      dateGrandTotals,
      overallGrandTotal
    };
  }, [monthFilteredRows, selectedResource]);

  const toggleExpandResource = (name) => {
    setExpandedResources(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // ==========================================
  // VIEW 2: WMR Changes & Iterations Summary
  // ==========================================
  const view2Data = useMemo(() => {
    const wmrMap = {};

    monthFilteredRows.forEach(r => {
      const rawWmr = r.WMR ? r.WMR.trim() : 'Unknown';
      const key = extractWmrKey(rawWmr);
      const changes = parseChangeCount(r['Changes Count']);
      const iterations = parseIterationCount(r['Iteration Count']);
      const res = r['Resource Name'] ? r['Resource Name'].trim() : '';
      const rawEnv = r.Environment ? r.Environment.trim() : '';
      const cat = r['Job Category'] ? r['Job Category'].trim() : '';
      const qc = r['QC Status'] ? r['QC Status'].trim() : '';

      if (!wmrMap[key]) {
        wmrMap[key] = {
          wmr: key,
          originalTitles: new Set(),
          sumChanges: 0,
          sumIterations: 0,
          resources: new Set(),
          environments: new Set(),
          categories: new Set(),
          qcStatuses: new Set(),
          almIds: new Set()
        };
      }

      if (rawWmr !== key) {
        wmrMap[key].originalTitles.add(rawWmr);
      }
      wmrMap[key].sumChanges += changes;
      wmrMap[key].sumIterations += iterations;
      if (res) wmrMap[key].resources.add(res);
      if (rawEnv) {
        rawEnv.split(',').forEach(e => {
          const trimmed = e.trim();
          if (trimmed) wmrMap[key].environments.add(trimmed);
        });
      }
      if (cat) wmrMap[key].categories.add(cat);
      if (qc) wmrMap[key].qcStatuses.add(qc);
      if (r['ALM ID']) wmrMap[key].almIds.add(String(r['ALM ID']).trim());
    });

    let list = Object.values(wmrMap).map(item => {
      const details = Array.from(item.originalTitles).map(t => {
        return t.replace(new RegExp(item.wmr, 'gi'), '').replace(/^[:\-\s]+/, '').trim();
      }).filter(Boolean);

      return {
        ...item,
        subtitle: details.length > 0 ? Array.from(new Set(details)).slice(0, 2).join(' • ') : '',
        searchCorpus: `${item.wmr} ${Array.from(item.originalTitles).join(' ')}`.toLowerCase(),
        resourceStr: Array.from(item.resources).join(', '),
        envStr: Array.from(item.environments).sort(sortEnvs).join(', '),
        catStr: Array.from(item.categories).join(', '),
        almStr: Array.from(item.almIds).join(', '),
        qcStr: Array.from(item.qcStatuses).join(', ')
      };
    });

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => 
        item.searchCorpus.includes(q) ||
        item.resourceStr.toLowerCase().includes(q) ||
        item.envStr.toLowerCase().includes(q) ||
        item.almStr.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let diff = 0;
      if (wmrSortField === 'changes') {
        diff = a.sumChanges - b.sumChanges;
      } else if (wmrSortField === 'iterations') {
        diff = a.sumIterations - b.sumIterations;
      } else {
        diff = a.wmr.localeCompare(b.wmr);
      }
      return wmrSortAsc ? diff : -diff;
    });

    return list;
  }, [monthFilteredRows, searchQuery, wmrSortField, wmrSortAsc]);

  // Paginated WMR list
  const paginatedWmrList = useMemo(() => {
    const start = (wmrPage - 1) * wmrPageSize;
    return view2Data.slice(start, start + wmrPageSize);
  }, [view2Data, wmrPage, wmrPageSize]);

  const totalWmrPages = Math.ceil(view2Data.length / wmrPageSize) || 1;

  // ==========================================
  // VIEW 3: Weekly Changes Matrix Aggregation
  // ==========================================
  const view3Data = useMemo(() => {
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];
    const monthsData = {};
    const weekGrandTotals = {};
    weeks.forEach(w => { weekGrandTotals[w] = 0; });
    let totalAllWeeks = 0;

    dataRows.forEach(r => {
      const mon = r.Month ? r.Month.trim() : 'Unknown';
      const wk = r.Week ? r.Week.trim() : 'Other';
      const taskType = r['Task Type'] ? r['Task Type'].trim() : 'BAU';
      const count = parseChangeCount(r['Changes Count']);

      if (!monthsData[mon]) {
        monthsData[mon] = {
          month: mon,
          total: 0,
          byWeek: {},
          byTaskType: {}
        };
      }

      monthsData[mon].total += count;
      monthsData[mon].byWeek[wk] = (monthsData[mon].byWeek[wk] || 0) + count;

      if (!monthsData[mon].byTaskType[taskType]) {
        monthsData[mon].byTaskType[taskType] = {
          taskType,
          total: 0,
          byWeek: {}
        };
      }
      monthsData[mon].byTaskType[taskType].total += count;
      monthsData[mon].byTaskType[taskType].byWeek[wk] = 
        (monthsData[mon].byTaskType[taskType].byWeek[wk] || 0) + count;

      if (weeks.includes(wk)) {
        weekGrandTotals[wk] = (weekGrandTotals[wk] || 0) + count;
      }
      totalAllWeeks += count;
    });

    const monthList = Object.values(monthsData).sort((a, b) => {
      const ia = MONTH_ORDER.indexOf(a.month);
      const ib = MONTH_ORDER.indexOf(b.month);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    return {
      weeks,
      months: monthList,
      weekGrandTotals,
      totalAllWeeks
    };
  }, [dataRows]);

  const toggleExpandMonth = (month) => {
    setExpandedMonths(prev => ({
      ...prev,
      [month]: !prev[month]
    }));
  };

  // ==========================================
  // VIEW 4: Environment Breakdown Aggregation
  // ==========================================
  const view4Data = useMemo(() => {
    const targetRows = monthFilteredRows;
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];

    // 1. Collect all unique dates and sort chronologically
    const dateMap = {};
    targetRows.forEach(r => {
      const d = r.Date;
      if (d && !dateMap[d]) {
        const parts = d.split('-');
        let time = 0;
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const mon = parts[1];
          const yr = parseInt(parts[2], 10);
          const monIdx = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
            .indexOf(mon.toLowerCase());
          time = new Date(yr, monIdx, day).getTime();
        }
        dateMap[d] = isNaN(time) ? 0 : time;
      }
    });
    const dates = Object.keys(dateMap).sort((a, b) => (dateMap[a] || 0) - (dateMap[b] || 0));

    // 2. Aggregate per environment
    const envs = {};
    const dateGrandTotals = {};
    const weekGrandTotals = {};
    dates.forEach(d => { dateGrandTotals[d] = 0; });
    weeks.forEach(w => { weekGrandTotals[w] = 0; });
    let overallGrandTotal = 0;
    let totalTasksCount = 0;

    targetRows.forEach(r => {
      const rawEnv = r.Environment ? r.Environment.trim() : 'Unspecified';
      const count = parseChangeCount(r['Changes Count']);
      const res = (r['Resource Name'] || 'Unknown').trim();
      const cat = (r['Job Category'] || 'Unspecified').trim();
      const d = r.Date;
      const wk = (r.Week || '').trim() || 'Other';
      const isFtr = r['QC Status'] === 'FTR';
      const rawWmr = r.WMR ? r.WMR.trim() : '';

      const envList = rawEnv.split(',').map(s => s.trim()).filter(Boolean);
      const effectiveEnvs = envList.length > 0 ? envList : ['Unspecified'];
      const perEnvCount = count / effectiveEnvs.length;

      overallGrandTotal += count;
      totalTasksCount += 1;
      if (d) dateGrandTotals[d] = (dateGrandTotals[d] || 0) + count;
      if (weeks.includes(wk)) weekGrandTotals[wk] = (weekGrandTotals[wk] || 0) + count;

      effectiveEnvs.forEach(env => {
        if (!envs[env]) {
          envs[env] = {
            name: env,
            total: 0,
            taskCount: 0,
            ftrCount: 0,
            wmrs: new Set(),
            byDate: {},
            byWeek: {},
            resources: {},
            categories: {}
          };
        }

        const eObj = envs[env];
        eObj.total += perEnvCount;
        eObj.taskCount += 1;
        if (isFtr) eObj.ftrCount += 1;
        if (rawWmr) eObj.wmrs.add(extractWmrKey(rawWmr));

        if (d) eObj.byDate[d] = (eObj.byDate[d] || 0) + perEnvCount;
        eObj.byWeek[wk] = (eObj.byWeek[wk] || 0) + perEnvCount;

        // Resource sub-row aggregation
        if (!eObj.resources[res]) {
          eObj.resources[res] = {
            name: res,
            total: 0,
            taskCount: 0,
            byDate: {},
            byWeek: {}
          };
        }
        eObj.resources[res].total += perEnvCount;
        eObj.resources[res].taskCount += 1;
        if (d) eObj.resources[res].byDate[d] = (eObj.resources[res].byDate[d] || 0) + perEnvCount;
        eObj.resources[res].byWeek[wk] = (eObj.resources[res].byWeek[wk] || 0) + perEnvCount;

        // Task Type sub-row aggregation & full detail records collection
        const taskType = (r['Task Type'] || 'BAU').trim();
        if (!eObj.taskTypes) eObj.taskTypes = {};
        if (!eObj.taskTypes[taskType]) {
          eObj.taskTypes[taskType] = {
            name: taskType,
            total: 0,
            taskCount: 0,
            byDate: {},
            byWeek: {},
            records: []
          };
        }
        eObj.taskTypes[taskType].total += perEnvCount;
        eObj.taskTypes[taskType].taskCount += 1;
        if (d) eObj.taskTypes[taskType].byDate[d] = (eObj.taskTypes[taskType].byDate[d] || 0) + perEnvCount;
        eObj.taskTypes[taskType].byWeek[wk] = (eObj.taskTypes[taskType].byWeek[wk] || 0) + perEnvCount;
        eObj.taskTypes[taskType].records.push({
          date: d,
          week: wk,
          wmr: rawWmr,
          wmrKey: extractWmrKey(rawWmr),
          almId: r['ALM ID'],
          resource: res,
          jobCategory: cat,
          taskType: taskType,
          changesCount: count,
          perEnvChangesCount: perEnvCount,
          iterationCount: r['Iteration Count'],
          qcStatus: r['QC Status'],
          pageType: r['Page Type'],
          environment: rawEnv
        });
      });
    });

    const envList = Object.values(envs).map(env => ({
      ...env,
      resourcesList: Object.values(env.resources).sort((a, b) => b.total - a.total),
      taskTypesList: Object.values(env.taskTypes || {}).sort((a, b) => b.total - a.total)
    })).sort((a, b) => sortEnvs(a.name, b.name));

    const filteredEnvironments = envList.filter(e => {
      if (selectedEnvFilter === 'ALL') return true;
      return e.name === selectedEnvFilter;
    });

    return {
      dates,
      weeks,
      allEnvironments: envList,
      filteredEnvironments,
      dateGrandTotals,
      weekGrandTotals,
      overallGrandTotal,
      totalTasksCount
    };
  }, [monthFilteredRows, selectedEnvFilter]);

  const toggleExpandEnvironment = (name) => {
    setExpandedEnvironments(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const toggleAllEnvironments = (shouldExpand) => {
    const nextState = {};
    view4Data.allEnvironments.forEach(e => {
      nextState[e.name] = shouldExpand;
    });
    setExpandedEnvironments(nextState);
  };

  // CSV Export helper for active tab
  const handleExportCsv = () => {
    trackButtonClick(`Tracker - Export ${activeTab}`);
    let csvContent = '';
    
    if (activeTab === 'resource') {
      const headers = ['Resource', 'Environment', ...view1Data.dates, 'Grand Total'];
      const rows = [];
      view1Data.resources.forEach(r => {
        const row = [r.name, 'All', ...view1Data.dates.map(d => r.byDate[d] || 0), r.total];
        rows.push(row);
        Object.values(r.environments).forEach(env => {
          rows.push([`↳ ${r.name}`, env.envName, ...view1Data.dates.map(d => env.byDate[d] || 0), env.total]);
        });
      });
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (activeTab === 'wmr') {
      const headers = ['WMR', 'Resources', 'Environment', 'Job Category', 'Iteration Count', 'Changes Count'];
      const rows = view2Data.map(w => [
        `"${w.wmr.replace(/"/g, '""')}"`,
        `"${w.resourceStr.replace(/"/g, '""')}"`,
        `"${w.envStr.replace(/"/g, '""')}"`,
        `"${w.catStr.replace(/"/g, '""')}"`,
        w.sumIterations,
        w.sumChanges
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (activeTab === 'environment') {
      const isDaily = envTimeView === 'daily';
      const cols = isDaily ? view4Data.dates : view4Data.weeks;
      const subLabel = envSubViewBy === 'resources' ? 'Team Member' : 'Task Type';
      const headers = ['Environment', subLabel, ...cols, 'Grand Total'];
      const rows = [];
      
      view4Data.filteredEnvironments.forEach(env => {
        const envRow = [
          `"${env.name}"`,
          'Total',
          ...cols.map(c => formatCount(isDaily ? (env.byDate[c] || 0) : (env.byWeek[c] || 0))),
          formatCount(env.total)
        ];
        rows.push(envRow);

        const subItems = envSubViewBy === 'resources' ? env.resourcesList : env.taskTypesList;
        subItems.forEach(sub => {
          rows.push([
            `"↳ ${env.name}"`,
            `"${sub.name}"`,
            ...cols.map(c => formatCount(isDaily ? (sub.byDate[c] || 0) : (sub.byWeek[c] || 0))),
            formatCount(sub.total)
          ]);
        });
      });
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else {
      const headers = ['Month', 'Task Type', ...view3Data.weeks, 'Grand Total'];
      const rows = [];
      view3Data.months.forEach(m => {
        rows.push([m.month, 'Total', ...view3Data.weeks.map(w => m.byWeek[w] || 0), m.total]);
        Object.values(m.byTaskType).forEach(tt => {
          rows.push([m.month, tt.taskType, ...view3Data.weeks.map(w => tt.byWeek[w] || 0), tt.total]);
        });
      });
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tracker_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Top Header & Live Sync Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
              <TableProperties className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                WMR Tracker
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Directly synced with Google Sheets</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>
                  {lastSynced 
                    ? `Last synced: ${new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` 
                    : 'Loading...'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleSync}
            disabled={syncing || loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm hover:shadow disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-violet-50 dark:bg-violet-950/50 rounded-xl text-violet-600 dark:text-violet-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {kpis.totalChanges.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {selectedMonth === 'ALL' ? 'Total Changes (All Months)' : `Total Changes (${selectedMonth})`}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {kpis.uniqueWmrs}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Unique WMR Requests</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {kpis.activeStaff}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Active Team Members</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {kpis.ftrRate}%
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">First-Time-Right (FTR) Quality</div>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => { setActiveTab('resource'); setWmrPage(1); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'resource'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>1. Resource Daily Changes</span>
            </button>

            <button
              onClick={() => { setActiveTab('wmr'); setWmrPage(1); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'wmr'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FolderGit2 className="w-4 h-4" />
              <span>2. WMR Breakdown</span>
            </button>

            <button
              onClick={() => { setActiveTab('weekly'); setWmrPage(1); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'weekly'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>3. Weekly Changes</span>
            </button>

            <button
              onClick={() => { setActiveTab('environment'); setWmrPage(1); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'environment'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>4. Environment Breakdown</span>
            </button>
          </div>

          {/* Month Filter Selector (Applies to Tabs 1, 2 & 4) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Month:
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setWmrPage(1); }}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Months</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m} 2026</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab-Specific Secondary Filters */}
        {activeTab === 'resource' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Resource Filter:
              </span>
              <select
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Resources (Team Total View)</option>
                {availableResources.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 italic">
              💡 Tip: Click [+] on any person to expand their CMS/Environment breakdown.
            </div>
          </div>
        )}

        {activeTab === 'wmr' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setWmrPage(1); }}
                placeholder="Search WMR, GCPC, Resource..."
                className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Sort by:</span>
              <button
                onClick={() => {
                  if (wmrSortField === 'changes') setWmrSortAsc(!wmrSortAsc);
                  else { setWmrSortField('changes'); setWmrSortAsc(false); }
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                  wmrSortField === 'changes'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 text-indigo-600 dark:text-indigo-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                Changes Count {wmrSortField === 'changes' ? (wmrSortAsc ? '↑' : '↓') : ''}
              </button>
              <button
                onClick={() => {
                  if (wmrSortField === 'iterations') setWmrSortAsc(!wmrSortAsc);
                  else { setWmrSortField('iterations'); setWmrSortAsc(false); }
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                  wmrSortField === 'iterations'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 text-indigo-600 dark:text-indigo-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                Iterations {wmrSortField === 'iterations' ? (wmrSortAsc ? '↑' : '↓') : ''}
              </button>
            </div>
          </div>
        )}

        {/* Tab 4 Secondary Controls */}
        {activeTab === 'environment' && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            {/* Left Controls: Filter specific environment & Sub-breakdown */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Filter Env:
                </span>
                <select
                  value={selectedEnvFilter}
                  onChange={(e) => setSelectedEnvFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All Environments (AEM, ICMS, Drupal, MOE)</option>
                  {availableEnvironments.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Sub-Row:
                </span>
                <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
                  <button
                    onClick={() => setEnvSubViewBy('taskTypes')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      envSubViewBy === 'taskTypes'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    Task Type
                  </button>
                  <button
                    onClick={() => setEnvSubViewBy('resources')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      envSubViewBy === 'resources'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    Team Members
                  </button>
                </div>
              </div>
            </div>

            {/* Right Controls: Daily/Weekly View Toggle & Expand/Collapse */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setEnvTimeView('daily')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    envTimeView === 'daily'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  Daily Dates
                </button>
                <button
                  onClick={() => setEnvTimeView('weekly')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    envTimeView === 'weekly'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  Weekly Matrix
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleAllEnvironments(true)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 cursor-pointer"
                  title="Expand all environments"
                >
                  Expand All
                </button>
                <button
                  onClick={() => toggleAllEnvironments(false)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 cursor-pointer"
                  title="Collapse all environments"
                >
                  Collapse All
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 p-16 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-medium">Fetching fresh records from Google Sheet...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-6 rounded-2xl text-red-600 dark:text-red-400">
          <p className="font-semibold">{error}</p>
          <button onClick={loadData} className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold cursor-pointer">
            Retry Loading
          </button>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* TAB 1: RESOURCE CHANGES BY DATE TABLE (SCREENSHOT 1) */}
          {/* ======================================================== */}
          {activeTab === 'resource' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white dark:bg-indigo-950 dark:text-indigo-100 border-b border-slate-700">
                      <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider sticky left-0 z-10 bg-slate-800 dark:bg-indigo-950 min-w-[220px]">
                        Resource Name / Environment
                      </th>
                      {view1Data.dates.map(date => (
                        <th key={date} className="py-3 px-3 font-semibold text-xs text-right whitespace-nowrap min-w-[90px]">
                          {date}
                        </th>
                      ))}
                      <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-right bg-slate-900 dark:bg-indigo-900 min-w-[110px]">
                        Grand Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {view1Data.resources.length === 0 ? (
                      <tr>
                        <td colSpan={view1Data.dates.length + 2} className="py-8 text-center text-slate-400">
                          No resource records found for this period.
                        </td>
                      </tr>
                    ) : (
                      view1Data.resources.map(res => {
                        const isExpanded = expandedResources[res.name] || selectedResource === res.name;
                        // Sort environments cleanly: AEM, ICMS, Drupal, MOE
                        const envKeys = Object.keys(res.environments).sort(sortEnvs);

                        return (
                          <Fragment key={res.name}>
                            {/* Main Resource Row */}
                            <tr className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 transition-colors group font-semibold text-slate-800 dark:text-slate-100">
                              <td className="py-3 px-4 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-indigo-50/40 dark:group-hover:bg-slate-800/60 flex items-center gap-2">
                                <button
                                  onClick={() => toggleExpandResource(res.name)}
                                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                                  title="Expand Environment breakdown"
                                >
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                <span>{res.name} Total</span>
                              </td>

                              {view1Data.dates.map(date => {
                                const val = res.byDate[date];
                                return (
                                  <td key={date} className="py-3 px-3 text-right font-medium">
                                    {val ? (
                                      <span className="text-slate-800 dark:text-slate-200">{formatCount(val)}</span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700">-</span>
                                    )}
                                  </td>
                                );
                              })}

                              <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400 bg-slate-50/60 dark:bg-slate-800/30">
                                {formatCount(res.total)}
                              </td>
                            </tr>

                            {/* Sub-rows for single Environment breakdown when expanded */}
                            {isExpanded && envKeys.map(envKey => {
                              const env = res.environments[envKey];
                              return (
                                <tr key={envKey} className="bg-slate-50/70 dark:bg-slate-800/30 text-xs text-slate-600 dark:text-slate-400">
                                  <td className="py-2 px-4 pl-10 sticky left-0 z-10 bg-slate-50 dark:bg-slate-850 flex items-center gap-1.5 font-medium">
                                    <span className="text-slate-400">↳</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{env.envName}</span>
                                  </td>

                                  {view1Data.dates.map(date => {
                                    const val = env.byDate[date];
                                    return (
                                      <td key={date} className="py-2 px-3 text-right">
                                        {val ? (
                                          <span className="text-slate-600 dark:text-slate-300">{formatCount(val)}</span>
                                        ) : (
                                          <span className="text-slate-300 dark:text-slate-700">-</span>
                                        )}
                                      </td>
                                    );
                                  })}

                                  <td className="py-2 px-4 text-right font-semibold text-slate-700 dark:text-slate-300">
                                    {formatCount(env.total)}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                  {/* Summary Grand Total Footer */}
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
                      <td className="py-3.5 px-4 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800/80 text-sm">
                        Grand Total
                      </td>
                      {view1Data.dates.map(date => (
                        <td key={date} className="py-3.5 px-3 text-right text-sm">
                          {formatCount(view1Data.dateGrandTotals[date])}
                        </td>
                      ))}
                      <td className="py-3.5 px-4 text-right text-base text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50">
                        {formatCount(view1Data.overallGrandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: WMR CHANGES & ITERATION TABLE (SCREENSHOT 2) */}
          {/* ======================================================== */}
          {activeTab === 'wmr' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white dark:bg-indigo-950 dark:text-indigo-100 border-b border-slate-700">
                      <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider min-w-[260px]">
                        WMR Request
                      </th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider min-w-[140px]">
                        Resource(s)
                      </th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider min-w-[120px]">
                        Environment
                      </th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider min-w-[110px]">
                        Category
                      </th>
                      <th className="py-3 px-3 font-bold text-xs uppercase tracking-wider text-right min-w-[130px]">
                        SUM of Iteration Count
                      </th>
                      <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-right min-w-[140px] bg-slate-900 dark:bg-indigo-900">
                        SUM of Changes Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedWmrList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No matching WMRs found.
                        </td>
                      </tr>
                    ) : (
                      paginatedWmrList.map(item => (
                        <tr key={item.wmr} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{item.wmr}</span>
                              {item.subtitle && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal line-clamp-1" title={item.subtitle}>
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                            {item.resourceStr || '-'}
                          </td>
                          <td className="py-3 px-3 text-xs">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300">
                              {item.envStr || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-500">
                            {item.catStr || '-'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                              item.sumIterations > 0
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {item.sumIterations}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCount(item.sumChanges)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Showing {((wmrPage - 1) * wmrPageSize) + 1} to {Math.min(wmrPage * wmrPageSize, view2Data.length)} of {view2Data.length} WMRs</span>
                  <select
                    value={wmrPageSize}
                    onChange={(e) => { setWmrPageSize(Number(e.target.value)); setWmrPage(1); }}
                    className="ml-2 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer"
                  >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setWmrPage(prev => Math.max(prev - 1, 1))}
                    disabled={wmrPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer font-medium"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 font-semibold text-slate-700 dark:text-slate-300">
                    Page {wmrPage} of {totalWmrPages}
                  </span>
                  <button
                    onClick={() => setWmrPage(prev => Math.min(prev + 1, totalWmrPages))}
                    disabled={wmrPage === totalWmrPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer font-medium"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: WEEKLY CHANGES MATRIX (SCREENSHOT 3) */}
          {/* ======================================================== */}
          {activeTab === 'weekly' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white dark:bg-indigo-950 dark:text-indigo-100 border-b border-slate-700">
                      <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider sticky left-0 z-10 bg-slate-800 dark:bg-indigo-950 min-w-[200px]">
                        Month / Task Type
                      </th>
                      {view3Data.weeks.map(wk => (
                        <th key={wk} className="py-3 px-3 font-semibold text-xs text-right whitespace-nowrap min-w-[90px]">
                          {wk}
                        </th>
                      ))}
                      <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-right bg-slate-900 dark:bg-indigo-900 min-w-[110px]">
                        Grand Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {view3Data.months.map(m => {
                      const isExpanded = expandedMonths[m.month];
                      const taskTypes = Object.values(m.byTaskType);

                      return (
                        <React.Fragment key={m.month}>
                          {/* Main Month Row */}
                          <tr className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 transition-colors group font-semibold text-slate-800 dark:text-slate-100">
                            <td className="py-3 px-4 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-indigo-50/40 dark:group-hover:bg-slate-800/60 flex items-center gap-2">
                              <button
                                onClick={() => toggleExpandMonth(m.month)}
                                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                                title="Expand Task Type breakdown"
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                              <span>{m.month} Total</span>
                            </td>

                            {view3Data.weeks.map(wk => {
                              const val = m.byWeek[wk];
                              return (
                                <td key={wk} className="py-3 px-3 text-right font-medium">
                                  {val ? (
                                    <span className="text-slate-800 dark:text-slate-200">{val}</span>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700">-</span>
                                  )}
                                </td>
                              );
                            })}

                            <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400 bg-slate-50/60 dark:bg-slate-800/30">
                              {m.total}
                            </td>
                          </tr>

                          {/* Sub-rows for Task Type breakdown when expanded */}
                          {isExpanded && taskTypes.map(tt => (
                            <tr key={tt.taskType} className="bg-slate-50/70 dark:bg-slate-800/30 text-xs text-slate-600 dark:text-slate-400">
                              <td className="py-2 px-4 pl-10 sticky left-0 z-10 bg-slate-50 dark:bg-slate-850 flex items-center gap-1.5 font-medium">
                                <span className="text-slate-400">↳</span>
                                <span>{tt.taskType}</span>
                              </td>

                              {view3Data.weeks.map(wk => {
                                const val = tt.byWeek[wk];
                                return (
                                  <td key={wk} className="py-2 px-3 text-right">
                                    {val ? (
                                      <span className="text-slate-600 dark:text-slate-300">{val}</span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700">-</span>
                                    )}
                                  </td>
                                );
                              })}

                              <td className="py-2 px-4 text-right font-semibold text-slate-700 dark:text-slate-300">
                                {tt.total}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {/* Summary Grand Total Footer */}
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
                      <td className="py-3.5 px-4 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800/80 text-sm">
                        Grand Total
                      </td>
                      {view3Data.weeks.map(wk => (
                        <td key={wk} className="py-3.5 px-3 text-right text-sm">
                          {view3Data.weekGrandTotals[wk] ? view3Data.weekGrandTotals[wk].toLocaleString() : '-'}
                        </td>
                      ))}
                      <td className="py-3.5 px-4 text-right text-base text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50">
                        {view3Data.totalAllWeeks.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: ENVIRONMENT BREAKDOWN WITH MONTH FILTER */}
          {/* ======================================================== */}
          {activeTab === 'environment' && (
            <div className="space-y-6">
              {/* Active Month Banner / Context Pill */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/80 via-white to-sky-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span>Environment Breakdown</span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {selectedMonth === 'ALL' ? 'All Months' : `${selectedMonth} 2026`}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Aggregated changes, tasks, and team contributions across CMS platforms (AEM, ICMS, Drupal, MOE).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Month Filter:
                  </span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
                  >
                    <option value="ALL">All Months</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>{m} 2026</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Environment KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {view4Data.allEnvironments.map(env => {
                  const styles = getEnvBadgeStyles(env.name);
                  const sharePercent = view4Data.overallGrandTotal > 0 
                    ? ((env.total / view4Data.overallGrandTotal) * 100).toFixed(1)
                    : '0.0';
                  const isSelected = selectedEnvFilter === env.name;
                  const ftrRate = env.taskCount > 0 ? ((env.ftrCount / env.taskCount) * 100).toFixed(1) : 100;
                  const topTaskType = env.taskTypesList?.length > 0 ? env.taskTypesList[0].name : 'N/A';

                  return (
                    <div 
                      key={env.name}
                      onClick={() => setSelectedEnvFilter(selectedEnvFilter === env.name ? 'ALL' : env.name)}
                      className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${styles.border} ${
                        isSelected 
                          ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 border-indigo-400 dark:border-indigo-600' 
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                      title={isSelected ? 'Click to show all environments' : `Click to filter by ${env.name}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${styles.dot}`}></span>
                          <span className="font-bold text-base text-slate-800 dark:text-slate-100">{env.name}</span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}>
                          {sharePercent}% Share
                        </span>
                      </div>

                      <div className="mt-3 flex items-baseline justify-between">
                        <div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                            {formatCount(env.total)}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            Changes in {selectedMonth === 'ALL' ? 'All Months' : `${selectedMonth} 2026`}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-indigo-600 text-white rounded-md">
                            Filtered
                          </span>
                        )}
                      </div>

                      {/* Share Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${styles.bar}`}
                          style={{ width: `${Math.min(parseFloat(sharePercent) || 0, 100)}%` }}
                        />
                      </div>

                      {/* Detailed Metric Pills */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{env.taskCount}</span> tasks
                          <span className="text-[11px] text-slate-400 ml-1">({env.wmrs.size} WMRs)</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{env.resourcesList.length}</span> team members
                        </div>
                        <div className="col-span-2 flex items-center justify-between text-[11px] pt-1">
                          <span className="text-slate-400">FTR Quality:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{ftrRate}%</span>
                        </div>
                        <div className="col-span-2 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Top Task Type:</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-[140px]" title={topTaskType}>{topTaskType}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Main Environment Breakdown Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {envTimeView === 'daily' ? 'Daily Environment Matrix' : 'Weekly Environment Matrix'}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({view4Data.filteredEnvironments.length} {view4Data.filteredEnvironments.length === 1 ? 'Environment' : 'Environments'})
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 italic">
                    💡 Tip: Click any <span className="font-semibold text-indigo-600 dark:text-indigo-400">Task Type</span> to open full related task details list.
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white dark:bg-indigo-950 dark:text-indigo-100 border-b border-slate-700">
                        <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider sticky left-0 z-10 bg-slate-800 dark:bg-indigo-950 min-w-[260px]">
                          Environment / {envSubViewBy === 'resources' ? 'Team Member' : 'Task Type'}
                        </th>
                        {(envTimeView === 'daily' ? view4Data.dates : view4Data.weeks).map(col => (
                          <th key={col} className="py-3 px-3 font-semibold text-xs text-right whitespace-nowrap min-w-[85px]">
                            {col}
                          </th>
                        ))}
                        <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-right bg-slate-900 dark:bg-indigo-900 min-w-[120px]">
                          Grand Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {view4Data.filteredEnvironments.length === 0 ? (
                        <tr>
                          <td 
                            colSpan={(envTimeView === 'daily' ? view4Data.dates.length : view4Data.weeks.length) + 2} 
                            className="py-12 text-center text-slate-400"
                          >
                            No environment records found for this period.
                          </td>
                        </tr>
                      ) : (
                        view4Data.filteredEnvironments.map(env => {
                          const isExpanded = expandedEnvironments[env.name];
                          const styles = getEnvBadgeStyles(env.name);
                          const isDaily = envTimeView === 'daily';
                          const cols = isDaily ? view4Data.dates : view4Data.weeks;
                          const subItems = envSubViewBy === 'resources' ? env.resourcesList : (env.taskTypesList || []);

                          return (
                            <Fragment key={env.name}>
                              {/* Primary Environment Row */}
                              <tr className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 transition-colors group font-semibold text-slate-800 dark:text-slate-100">
                                <td className="py-3 px-4 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-indigo-50/40 dark:group-hover:bg-slate-800/60 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => toggleExpandEnvironment(env.name)}
                                      className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                                      title={isExpanded ? 'Collapse' : 'Expand breakdown'}
                                    >
                                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-md border ${styles.badge}`}>
                                      {env.name}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">Total</span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 font-normal pr-2">
                                    {env.taskCount} tasks
                                  </span>
                                </td>

                                {cols.map(col => {
                                  const val = isDaily ? env.byDate[col] : env.byWeek[col];
                                  return (
                                    <td key={col} className="py-3 px-3 text-right font-medium">
                                      {val ? (
                                        <span className="text-slate-800 dark:text-slate-200">{formatCount(val)}</span>
                                      ) : (
                                        <span className="text-slate-300 dark:text-slate-700">-</span>
                                      )}
                                    </td>
                                  );
                                })}

                                <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400 bg-slate-50/60 dark:bg-slate-800/30">
                                  {formatCount(env.total)}
                                </td>
                              </tr>

                              {/* Sub-rows */}
                              {isExpanded && subItems.map(item => (
                                <tr key={item.name} className="bg-slate-50/70 dark:bg-slate-800/30 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="py-2.5 px-4 pl-10 sticky left-0 z-10 bg-slate-50 dark:bg-slate-850 flex items-center justify-between font-medium">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-400">↳</span>
                                      {envSubViewBy === 'taskTypes' ? (
                                        <button
                                          onClick={() => {
                                            setActiveTaskTypeDetails({
                                              envName: env.name,
                                              taskTypeName: item.name,
                                              month: selectedMonth,
                                              records: item.records || [],
                                              totalChanges: item.total
                                            });
                                            setTaskDetailsSearch('');
                                          }}
                                          className="group/btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                                          title="Click to view full related task details list"
                                        >
                                          <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                          <span>{item.name}</span>
                                          <span className="text-[10px] font-normal text-indigo-500 dark:text-indigo-400 ml-1 underline decoration-dotted group-hover/btn:underline">
                                            ({item.taskCount} {item.taskCount === 1 ? 'task' : 'tasks'} • View Details ↗)
                                          </span>
                                        </button>
                                      ) : (
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{item.name}</span>
                                      )}
                                    </div>
                                    {envSubViewBy !== 'taskTypes' && (
                                      <span className="text-[10px] text-slate-400 font-normal pr-2">
                                        {item.taskCount} {item.taskCount === 1 ? 'task' : 'tasks'}
                                      </span>
                                    )}
                                  </td>

                                  {cols.map(col => {
                                    const val = isDaily ? item.byDate[col] : item.byWeek[col];
                                    return (
                                      <td key={col} className="py-2.5 px-3 text-right">
                                        {val ? (
                                          <span className="text-slate-600 dark:text-slate-300 font-medium">{formatCount(val)}</span>
                                        ) : (
                                          <span className="text-slate-300 dark:text-slate-700">-</span>
                                        )}
                                      </td>
                                    );
                                  })}

                                  <td className="py-2.5 px-4 text-right font-semibold text-slate-700 dark:text-slate-300 bg-slate-100/40 dark:bg-slate-800/20">
                                    {formatCount(item.total)}
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                    {/* Summary Grand Total Footer */}
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
                        <td className="py-3.5 px-4 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800/80 text-sm">
                          Grand Total {selectedEnvFilter !== 'ALL' ? `(${selectedEnvFilter})` : ''}
                        </td>
                        {(envTimeView === 'daily' ? view4Data.dates : view4Data.weeks).map(col => {
                          const isDaily = envTimeView === 'daily';
                          const total = view4Data.filteredEnvironments.reduce((sum, e) => {
                            return sum + (isDaily ? (e.byDate[col] || 0) : (e.byWeek[col] || 0));
                          }, 0);
                          return (
                            <td key={col} className="py-3.5 px-3 text-right text-sm">
                              {formatCount(total)}
                            </td>
                          );
                        })}
                        <td className="py-3.5 px-4 text-right text-base text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50">
                          {formatCount(view4Data.filteredEnvironments.reduce((sum, e) => sum + e.total, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* TASK TYPE RELATED DETAILS MODAL */}
      {/* ======================================================== */}
      {activeTaskTypeDetails && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6"
          onClick={() => setActiveTaskTypeDetails(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Task Details: {activeTaskTypeDetails.envName} › {activeTaskTypeDetails.taskTypeName}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-md border ${getEnvBadgeStyles(activeTaskTypeDetails.envName).badge}`}>
                      {activeTaskTypeDetails.envName}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {activeTaskTypeDetails.taskTypeName}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {activeTaskTypeDetails.month === 'ALL' ? 'All Months' : `${activeTaskTypeDetails.month} 2026`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Granular breakdown of all individual tasks and WMRs under this platform and task type.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setActiveTaskTypeDetails(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <div>
                <div className="text-xs text-slate-400">Total Tasks</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{activeTaskTypeDetails.records.length}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Total Changes</div>
                <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                  {formatCount(activeTaskTypeDetails.records.reduce((acc, r) => acc + (r.changesCount || 0), 0))}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Unique WMRs</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  {new Set(activeTaskTypeDetails.records.map(r => r.wmrKey)).size}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Contributing Staff</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  {new Set(activeTaskTypeDetails.records.map(r => r.resource)).size}
                </div>
              </div>
            </div>

            {/* Filter and Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={taskDetailsSearch}
                  onChange={(e) => setTaskDetailsSearch(e.target.value)}
                  placeholder="Search WMR, GCPC, ALM, Resource..."
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => {
                    const { envName, taskTypeName, records } = activeTaskTypeDetails;
                    trackButtonClick(`Tracker - Export Details ${envName} ${taskTypeName}`);
                    const headers = ['#', 'Date', 'Week', 'Environment', 'Task Type', 'WMR Key', 'WMR Title', 'ALM ID', 'Resource Name', 'Job Category', 'Changes Count', 'Iteration Count', 'QC Status', 'Page Type'];
                    const rows = records.map((r, idx) => [
                      idx + 1,
                      `"${r.date || ''}"`,
                      `"${r.week || ''}"`,
                      `"${r.environment || envName}"`,
                      `"${r.taskType || taskTypeName}"`,
                      `"${r.wmrKey || ''}"`,
                      `"${(r.wmr || '').replace(/"/g, '""')}"`,
                      `"${r.almId || ''}"`,
                      `"${(r.resource || '').replace(/"/g, '""')}"`,
                      `"${(r.jobCategory || '').replace(/"/g, '""')}"`,
                      r.changesCount || 0,
                      r.iterationCount || 0,
                      `"${r.qcStatus || ''}"`,
                      `"${r.pageType || ''}"`
                    ]);
                    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `tasks_${envName}_${taskTypeName}_${selectedMonth}_${new Date().toISOString().split('T')[0]}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Task List CSV</span>
                </button>
              </div>
            </div>

            {/* Details Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 font-bold w-12 text-center">#</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap min-w-[90px]">Date</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap min-w-[70px]">Week</th>
                    <th className="py-2.5 px-4 font-bold min-w-[240px]">WMR Request / Title</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap min-w-[80px]">ALM ID</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap min-w-[120px]">Resource</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap min-w-[100px]">Category</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap min-w-[80px]">Changes</th>
                    <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap min-w-[60px]">QC</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap min-w-[70px]">Page</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(() => {
                    const q = taskDetailsSearch.toLowerCase().trim();
                    const filtered = activeTaskTypeDetails.records.filter(r => {
                      if (!q) return true;
                      return (
                        (r.wmr || '').toLowerCase().includes(q) ||
                        (r.wmrKey || '').toLowerCase().includes(q) ||
                        (r.resource || '').toLowerCase().includes(q) ||
                        (r.almId || '').toString().toLowerCase().includes(q) ||
                        (r.jobCategory || '').toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-slate-400">
                            No matching tasks found.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((rec, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-medium font-mono text-[11px]">{rec.date}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">{rec.week}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                          <div className="flex flex-col">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{rec.wmrKey}</span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1" title={rec.wmr}>
                              {rec.wmr.replace(rec.wmrKey, '').replace(/^[:\-\s]+/, '').trim() || rec.wmr}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{rec.almId || '-'}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{rec.resource}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px]">
                            {rec.jobCategory || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                          {formatCount(rec.changesCount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.qcStatus === 'FTR'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {rec.qcStatus || 'FTR'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">{rec.pageType || '-'}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span>Showing tasks associated with {activeTaskTypeDetails.envName} in {activeTaskTypeDetails.month}</span>
              <button
                onClick={() => setActiveTaskTypeDetails(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
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
