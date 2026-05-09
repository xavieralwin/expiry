import { useState, useEffect } from 'react';
import { fetchRecords, deleteRecord } from '../lib/api';
import { format } from 'date-fns';
import { Trash2, Edit, ExternalLink, Download, Upload, Search, Network } from 'lucide-react';
import { exportToCsv, exportToXlsx } from '../lib/exportCsv';
import RecordForm from '../components/RecordForm';
import ImportForm from '../components/ImportForm';
import { trackButtonClick } from '../lib/analytics';

export default function AkamaiRedirects() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadRecords = () => {
    setLoading(true);
    fetchRecords()
      .then(fetched => {
        setRecords(fetched);
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await deleteRecord(id);
        setRecords(prev => prev.filter(r => r.id !== id));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  let filteredRecords = records.filter(record => {
    // Only show Akamai 301 Redirects
    if (record.pageType !== 'Akamai 301 Redirect') return false;
    
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (record.url || '').toLowerCase().includes(term) ||
      (record.landingUrl || '').toLowerCase().includes(term) ||
      (record.ownerName || '').toLowerCase().includes(term) ||
      (record.ownerSoeid || '').toLowerCase().includes(term) ||
      (record.ownerEmail || '').toLowerCase().includes(term) ||
      (record.pageType || '').toLowerCase().includes(term) ||
      (record.environment || '').toLowerCase().includes(term) ||
      (record.status || '').toLowerCase().includes(term)
    );
  });

  // Smart Exact Match
  if (searchTerm) {
    const exactMatches = filteredRecords.filter(r => (r.url || '').toLowerCase() === searchTerm.toLowerCase());
    if (exactMatches.length > 0) {
      filteredRecords = exactMatches;
    }
  }

  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + rowsPerPage);
  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);

  return (
    <div className="p-8">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Akamai 301 Redirects</h2>
          <p className="text-slate-500 mt-1">Manage and track all Akamai 301 Redirects</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search records..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none w-64 text-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <div className="flex gap-3">
          <button 
            onClick={() => { trackButtonClick('AkamaiRedirects - Import Data'); setShowImportForm(true); }}
            className="bg-[#bfdbfe] border-none hover:bg-blue-300 text-blue-900 px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Data</span>
          </button>
          <button 
            onClick={() => { trackButtonClick('AkamaiRedirects - Export CSV'); exportToCsv('akamai_records.csv', filteredRecords); }}
            className="bg-[#bfdbfe] border-none hover:bg-blue-300 text-blue-900 px-4 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
          <button 
            onClick={() => { trackButtonClick('AkamaiRedirects - Export XLSX'); exportToXlsx('akamai_records.xlsx', filteredRecords); }}
            className="bg-[#bfdbfe] border-none hover:bg-blue-300 text-blue-900 px-4 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>XLSX</span>
          </button>
          <button 
            onClick={() => { trackButtonClick('AkamaiRedirects - Add Record'); setEditingRecord(null); setShowForm(true); }}
            className="bg-[#a78bfa] hover:bg-[#9061f9] text-purple-950 px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>+ Add Record</span>
          </button>
        </div>
        </div>
      </header>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-sm">
              <th className="p-4 font-medium w-[30%] xl:w-[35%]">Source URL</th>
              <th className="p-4 font-medium w-full">Destination URL</th>
              <th className="p-4 font-medium text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr><td colSpan="3" className="p-8 text-center text-slate-400">Loading records...</td></tr>
            ) : paginatedRecords.length === 0 ? (
              <tr><td colSpan="3" className="p-12 text-center text-slate-400">No records found matching your criteria.</td></tr>
            ) : paginatedRecords.map(record => (
              <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <div className="w-full max-w-[300px] md:max-w-[400px] lg:max-w-[600px] xl:max-w-[800px]">
                    <a href={record.url} target="_blank" rel="noreferrer" className="text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 truncate" title={record.url}>
                      <span className="font-semibold truncate">{record.url}</span> <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                </td>
                <td className="p-4">
                  <div className="w-full max-w-[300px] md:max-w-[400px] lg:max-w-[600px] xl:max-w-[800px]">
                    {record.landingUrl ? (
                      <a href={record.landingUrl.startsWith('http') ? record.landingUrl : `https://${record.landingUrl}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-800 hover:underline text-xs truncate flex items-center gap-1" title={record.landingUrl}>
                        <span className="truncate">{record.landingUrl}</span> <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-right whitespace-nowrap space-x-2">
                  <button onClick={() => { trackButtonClick('AkamaiRedirects - Edit Record'); handleEdit(record); }} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer" title="Edit">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => { trackButtonClick('AkamaiRedirects - Delete Record'); handleDelete(record.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button type="button" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Previous</button>
              <button type="button" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(startIndex + rowsPerPage, filteredRecords.length)}</span> of <span className="font-medium">{filteredRecords.length}</span> results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button type="button" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 cursor-pointer">
                    <span className="sr-only">Previous</span>
                    &lt;
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 focus:outline-offset-0">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button type="button" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 cursor-pointer">
                    <span className="sr-only">Next</span>
                    &gt;
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <RecordForm 
          initialData={editingRecord}
          onClose={() => setShowForm(false)} 
          onSave={() => loadRecords()} 
          defaultPageType="Akamai 301 Redirect"
        />
      )}

      {showImportForm && (
        <ImportForm 
          onClose={() => setShowImportForm(false)} 
          onSave={() => { loadRecords(); setShowImportForm(false); }} 
          defaultPageType="Akamai 301 Redirect"
        />
      )}
    </div>
  );
}
