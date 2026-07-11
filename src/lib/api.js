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
