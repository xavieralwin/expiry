import { useState } from 'react';
import { addRecord, updateRecord, fetchRecords } from '../lib/api';

export default function RecordForm({ initialData, onClose, onSave, defaultPageType }) {
  const defaultFormState = {
    url: '',
    ownerSoeid: '',
    ownerEmail: '',
    pageType: defaultPageType || 'HTML',
    status: 'Live',
    expiryDate: '',
    ownerName: '',
    environment: 'ICMS'
  };

  const [formData, setFormData] = useState(initialData ? { ...defaultFormState, ...initialData } : defaultFormState);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    try {
      // Check for unique URL
      // If we are editing, we ignore the check if the URL didn't change
      if (!initialData || initialData.url !== formData.url) {
        const existingRecords = await fetchRecords();
        const exists = existingRecords.some(r => r.url === formData.url);
        if (exists) {
          setError('This URL already exists in the database. URLs must be unique.');
          setSaving(false);
          return;
        }
      }

      // Add or Update
      if (initialData && initialData.id) {
        await updateRecord(initialData.id, formData);
      } else {
        await addRecord(formData);
      }

      onSave();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save record. Check console or firebase config.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center overflow-auto p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">{initialData ? 'Edit Record' : 'Add New Record'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full & Complete URL (Must be unique)</label>
            <input type="url" name="url" required value={formData.url} onChange={handleChange} placeholder="https://www.citibank.com.sg/..." className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content owner SOEID</label>
              <input type="text" name="ownerSoeid" required value={formData.ownerSoeid} onChange={handleChange} placeholder="e.g. AB12345" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content Owner Email ID</label>
              <input type="email" name="ownerEmail" required value={formData.ownerEmail} onChange={handleChange} placeholder="owner@citi.com" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Page Type</label>
              <select name="pageType" value={formData.pageType} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all">
                <option value="HTML">HTML</option>
                <option value="PDF">PDF</option>
                <option value="EDM">EDM</option>
                <option value="Landing page">Landing page</option>
                <option value="Vanity URL">Vanity URL</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Page Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all">
                <option value="Live">Live</option>
                <option value="Deleted">Deleted</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Environment</label>
              <select name="environment" value={formData.environment} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all">
                <option value="ICMS">ICMS</option>
                <option value="AEM">AEM</option>
                <option value="Drupal">Drupal</option>
              </select>
            </div>

            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
              <input type="date" name="expiryDate" required value={formData.expiryDate} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content Owner</label>
            <input type="text" name="ownerName" required value={formData.ownerName} onChange={handleChange} placeholder="Owner Name" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all" />
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-lg font-medium shadow-sm shadow-purple-200 transition-all disabled:opacity-50 cursor-pointer">
              {saving ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
