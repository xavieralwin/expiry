const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

let cachedRecords = null;
let activeFetchPromise = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

export function invalidateCache() {
  cachedRecords = null;
  activeFetchPromise = null;
  cacheTimestamp = 0;
}

export async function fetchRecords() {
  const now = Date.now();
  if (cachedRecords && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedRecords;
  }
  
  if (activeFetchPromise) {
    return activeFetchPromise;
  }
  
  activeFetchPromise = fetch(`${API_BASE}/urls`)
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch records');
      return response.json();
    })
    .then(data => {
      cachedRecords = data;
      cacheTimestamp = Date.now();
      activeFetchPromise = null;
      return data;
    })
    .catch(err => {
      activeFetchPromise = null;
      throw err;
    });
    
  return activeFetchPromise;
}

export async function addRecord(data) {
  const response = await fetch(`${API_BASE}/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to add record');
  invalidateCache();
  return response.json();
}

export async function updateRecord(id, data) {
  const response = await fetch(`${API_BASE}/urls/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update record');
  invalidateCache();
  return response.json();
}

export async function deleteRecord(id) {
  const response = await fetch(`${API_BASE}/urls/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete record');
  invalidateCache();
  return response.json();
}

export async function batchImportCustomAPI(items) {
  const response = await fetch(`${API_BASE}/urls/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!response.ok) throw new Error('Failed to import records');
  invalidateCache();
  return response.json();
}

export async function sendExpiryNotifications(records) {
  const response = await fetch(`${API_BASE}/urls/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records })
  });
  if (!response.ok) throw new Error('Failed to send notifications');
  return response.json();
}

// ==================== MA LEAVES API HELPERS ====================

const INITIAL_MA_LEAVES = [
  { id: 'ma-1', seoId: 'AJ26015', idName: 'Alwin', mappingIds: 'Project', fromDate: '03-09-2026', toDate: '03-13-2026', applied: 'Done', maStatus: 'Completed' },
  { id: 'ma-2', seoId: 'am28856', idName: 'Asaithambi', mappingIds: 'Moenage', fromDate: '03-16-2026', toDate: '03-20-2026', applied: 'Done', maStatus: 'Completed' },
  { id: 'ma-3', seoId: 'AV90366', idName: 'Arun Kumar', mappingIds: 'BAU', fromDate: '04-13-2026', toDate: '04-17-2026', applied: 'Done', maStatus: 'Completed' },
  { id: 'ma-4', seoId: 'Dj26014', idName: 'Dhanya', mappingIds: 'MC', fromDate: '05-04-2026', toDate: '05-08-2026', applied: 'Done', maStatus: 'Completed' },
  { id: 'ma-5', seoId: 'DS13421', idName: 'Deepika', mappingIds: 'MboL', fromDate: '05-11-2026', toDate: '05-15-2026', applied: 'Done', maStatus: 'Completed' },
  { id: 'ma-6', seoId: 'KA10005', idName: 'Ankit', mappingIds: 'Moenage', fromDate: '06-08-2026', toDate: '06-12-2026', applied: 'Done', maStatus: 'Completed' },
  { id: 'ma-7', seoId: 'mm33844', idName: 'Mahadevi', mappingIds: 'BAU', fromDate: '07-06-2026', toDate: '07-10-2026', applied: 'Done', maStatus: 'Completed' },
  { id: 'ma-8', seoId: 'nc70471', idName: 'Naveen', mappingIds: 'Project', fromDate: '07-13-2026', toDate: '07-17-2026', applied: 'Done', maStatus: 'Completed' },
  { id: 'ma-9', seoId: 'Pg52851', idName: 'Prem Kumar', mappingIds: 'BAU', fromDate: '08-03-2026', toDate: '08-07-2026', applied: 'Done', maStatus: 'Completed' },
  { id: 'ma-10', seoId: 'ps09955', idName: 'Sunil Jagtap, Pratik', mappingIds: 'BAU', fromDate: '08-10-2026', toDate: '08-14-2026', applied: 'Done', maStatus: 'Completed' },
  { id: 'ma-11', seoId: 'SM39849', idName: 'Santhosh', mappingIds: 'BAU', fromDate: '09-14-2026', toDate: '09-18-2026', applied: 'Done', maStatus: 'Ongoing' },
  { id: 'ma-12', seoId: 'vb55549', idName: 'Vasanthakumar', mappingIds: 'Moenage', fromDate: '10-12-2026', toDate: '10-16-2026', applied: 'Done', maStatus: 'Not started' },
  { id: 'ma-13', seoId: 'TR71869', idName: 'Tamilarasi Rathinavelu', mappingIds: '', fromDate: '', toDate: '', applied: '', maStatus: 'Not started' }
];

export async function fetchMALeaves() {
  try {
    const res = await fetch(`${API_BASE}/ma-leaves`);
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      localStorage.setItem('ma_leaves_backup', JSON.stringify(data));
      return data;
    }
  } catch {
    // Fallback to localStorage or INITIAL_MA_LEAVES
  }
  const stored = localStorage.getItem('ma_leaves_backup');
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }
  localStorage.setItem('ma_leaves_backup', JSON.stringify(INITIAL_MA_LEAVES));
  return INITIAL_MA_LEAVES;
}

export async function addMALeave(data) {
  try {
    const res = await fetch(`${API_BASE}/ma-leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) return await res.json();
  } catch { /* ignore */ }

  const current = await fetchMALeaves();
  const newItem = { id: `ma-${Date.now()}`, ...data };
  const updated = [newItem, ...current];
  localStorage.setItem('ma_leaves_backup', JSON.stringify(updated));
  return newItem;
}

export async function updateMALeave(id, data) {
  try {
    const res = await fetch(`${API_BASE}/ma-leaves/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) return await res.json();
  } catch { /* ignore */ }

  const current = await fetchMALeaves();
  const updated = current.map(item => item.id === id ? { ...item, ...data } : item);
  localStorage.setItem('ma_leaves_backup', JSON.stringify(updated));
  return { id, ...data };
}

export async function deleteMALeave(id) {
  try {
    const res = await fetch(`${API_BASE}/ma-leaves/${id}`, { method: 'DELETE' });
    if (res.ok) return await res.json();
  } catch { /* ignore */ }

  const current = await fetchMALeaves();
  const updated = current.filter(item => item.id !== id);
  localStorage.setItem('ma_leaves_backup', JSON.stringify(updated));
  return { success: true, id };
}

