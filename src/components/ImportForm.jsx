import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { fetchRecords, batchImportCustomAPI } from '../lib/api';
import { trackButtonClick } from '../lib/analytics';

export default function ImportForm({ onClose, onSave, defaultPageType }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ total: 0, current: 0, success: 0, failed: 0 });
  const [importErrors, setImportErrors] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  };

  // Helper to parse dates from excel which are often numeric
  function parseExcelDate(val) {
    if (!val) return '';
    // If it's already a JS date object (parsed by SheetJS options)
    if (val instanceof Date) return val.toISOString();
    
    // If it's a known string format like 03/31/27 or YYYY-MM-DD
    if (typeof val === 'string') {
      const parsed = new Date(val);
      if (!isNaN(parsed)) return parsed.toISOString();
      return '';
    }
    
    // If it's an Excel serial date number
    if (typeof val === 'number') {
      const date = new Date((val - (25567 + 2)) * 86400 * 1000);
      if (!isNaN(date)) return date.toISOString();
      return '';
    }
    return '';
  }

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setImporting(true);
    setProgress({ total: 0, current: 0, success: 0, failed: 0 });
    setImportErrors([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (rawJson.length === 0) {
        setError('No data found in the file.');
        setImporting(false);
        return;
      }

      setProgress(prev => ({ ...prev, total: rawJson.length }));
      // OPTIMIZATION: Cache existing URLs to avoid 8000+ individual queries
      setProgress(prev => ({ ...prev, current: 'Fetching existing data...' }));
      const existingSnapshot = await fetchRecords();
      const existingAkamaiUrls = new Set(existingSnapshot.filter(d => d.pageType === 'Akamai 301 Redirect').map(d => d.url));
      const existingOtherUrls = new Set(existingSnapshot.filter(d => d.pageType !== 'Akamai 301 Redirect').map(d => d.url));
      
      let successes = 0;
      let failures = 0;
      let localErrors = [];
      let batch = [];
      let batchCount = 0;
      let currentIdx = 0;

      for (const row of rawJson) {
        currentIdx++;
        try {
          const keys = Object.keys(row);
          
          const urlKey = keys.find(k => k.toLowerCase().includes('url') || k.toLowerCase().includes('link'));
          if (!urlKey || !row[urlKey]) {
            throw new Error(`Missing URL column in row. Available headers: ${keys.slice(0, 3).join(', ')}...`);
          }
          const urlVal = String(row[urlKey]).trim();

          const soeidKey = keys.find(k => k.toLowerCase().includes('soeid'));
          const emailKey = keys.find(k => k.toLowerCase().includes('email'));
          const typeKey = keys.find(k => k.toLowerCase().includes('type'));
          const statusKey = keys.find(k => k.toLowerCase().includes('status'));
          const envKey = keys.find(k => k.toLowerCase().includes('env'));
          const landingKey = keys.find(k => k.toLowerCase().includes('landing'));
          // Strict expiry finding to avoid "Created Date"
          const expiryKey = keys.find(k => k.toLowerCase().includes('expiry') && k.toLowerCase().includes('date'));
          const ownerKey = keys.find(k => k.toLowerCase().includes('owner') && !k.toLowerCase().includes('soeid') && !k.toLowerCase().includes('email'));

          // Basic map
          const mappedRecord = {
            url: urlVal,
            landingUrl: landingKey ? String(row[landingKey]) : '',
            ownerSoeid: soeidKey ? String(row[soeidKey]) : '',
            ownerEmail: emailKey ? String(row[emailKey]) : '',
            pageType: defaultPageType || (typeKey ? String(row[typeKey]) : 'HTML'),
            status: statusKey && String(row[statusKey]).toLowerCase().includes('delete') ? 'Deleted' : 'Live',
            ownerName: ownerKey ? String(row[ownerKey]) : '',
            environment: envKey ? String(row[envKey]) : 'ICMS',
            expiryDate: expiryKey ? parseExcelDate(row[expiryKey]) : '',
            createdAt: new Date().toISOString()
          };

          const isAkamai = mappedRecord.pageType === 'Akamai 301 Redirect';
          const targetSet = isAkamai ? existingAkamaiUrls : existingOtherUrls;

          if (targetSet.has(urlVal)) {
            throw new Error(`Duplicate URL exists in this list: ${urlVal.substring(0,30)}...`);
          }

          // Queue in batch
          batch.push(mappedRecord);
          targetSet.add(urlVal); // Prevent duplicates within the same import file
          successes++;
          batchCount++;

          if (batchCount === 500) {
              await batchImportCustomAPI(batch);
            batch = [];
            batchCount = 0;
          }
        } catch(e) {
          failures++;
          if (localErrors.length < 50) {
            localErrors.push(`Row ${currentIdx} skipped: ${e.message}`);
          }
        }
        
        setProgress(prev => ({ ...prev, current: currentIdx, success: successes, failed: failures }));
      }

      // Commit any remaining records
      if (batchCount > 0) {
          await batchImportCustomAPI(batch);
      }

      if (failures > 0) {
        setImportErrors(localErrors);
      } else {
        onSave(); // Close modal if perfect success
      }

    } catch (err) {
      console.error(err);
      setError('An error occurred while parsing the file. Please make sure it is a valid Excel or CSV.');
    }
    
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">Bulk Import Data</h2>
          <button type="button" onClick={onClose} disabled={importing} className="text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-50">✕</button>
        </div>
        
        <div className="p-8 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200">{error}</div>}
          
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => !importing && fileInputRef.current?.click()}>
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              disabled={importing}
            />
            {file ? (
              <p className="text-slate-800 font-medium">Selected: <span className="text-purple-600">{file.name}</span></p>
            ) : (
              <div>
                <p className="text-slate-600 font-medium mb-1">Click to select an Excel or CSV file</p>
                <p className="text-slate-400 text-sm">We will try to auto-map columns like URL, Expiry Date, Subject, etc.</p>
              </div>
            )}
          </div>

          {importing && (
            <div className="space-y-2 bg-purple-50 p-4 rounded-xl border border-purple-100">
              <div className="flex justify-between text-sm font-semibold text-purple-900">
                <span>{typeof progress.current === 'string' ? progress.current : `Progress: ${progress.current} / ${progress.total}`}</span>
                <span>{typeof progress.current === 'string' ? '' : `${Math.round((progress.current / (progress.total || 1)) * 100)}%`}</span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2.5">
                <div className="bg-[#a78bfa] h-2.5 rounded-full" style={{ width: typeof progress.current === 'string' ? '100%' : `${Math.round((progress.current / (progress.total || 1)) * 100)}%` }}></div>
              </div>
              <p className="text-xs text-purple-700 pt-1">
                ✅ Imported: {progress.success} | ❌ Skipped (duplicates/errors): {progress.failed}
              </p>
            </div>
          )}

          {!importing && importErrors.length > 0 && (
            <div className="bg-red-50 p-4 rounded-xl border border-red-200 mt-4 max-h-48 overflow-y-auto">
              <h4 className="font-bold text-red-800 text-sm mb-2">Some rows failed to import:</h4>
              <ul className="text-xs text-red-700 space-y-1 list-disc pl-4 text-left">
                {importErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={() => { trackButtonClick('ImportForm - Close'); onClose(); }} disabled={importing} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer transition-colors disabled:opacity-50">Close</button>
            <button 
              type="button" 
              onClick={() => { trackButtonClick('ImportForm - Start Import'); handleImport(); }}
              disabled={!file || importing} 
              className="px-6 py-2.5 bg-[#a78bfa] hover:bg-[#9061f9] text-purple-950 rounded-xl font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {importing ? 'Importing...' : 'Start Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
