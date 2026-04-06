const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchRecords() {
  const response = await fetch(`${API_BASE}/urls`);
  if (!response.ok) throw new Error('Failed to fetch records');
  return response.json();
}

export async function addRecord(data) {
  const response = await fetch(`${API_BASE}/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to add record');
  return response.json();
}

export async function updateRecord(id, data) {
  const response = await fetch(`${API_BASE}/urls/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update record');
  return response.json();
}

export async function deleteRecord(id) {
  const response = await fetch(`${API_BASE}/urls/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete record');
  return response.json();
}

export async function batchImportCustomAPI(items) {
  const response = await fetch(`${API_BASE}/urls/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!response.ok) throw new Error('Failed to import records');
  return response.json();
}
