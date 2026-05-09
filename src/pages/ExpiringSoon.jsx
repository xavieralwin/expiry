import { useState, useEffect } from 'react';
import { fetchRecords, sendExpiryNotifications } from '../lib/api';
import { format, differenceInDays } from 'date-fns';
import { ExternalLink, AlertTriangle, Download, Search, Mail } from 'lucide-react';
import { exportToCsv } from '../lib/exportCsv';
import { trackButtonClick } from '../lib/analytics';

export default function ExpiringSoon() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sendingEmail, setSendingEmail] = useState(false);
  const rowsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchRecords()
      .then(fetched => {
        const filtered = fetched.filter(record => {
          if (record.pageType === 'Akamai 301 Redirect') return false;
          if ((record.status !== 'Active' && record.status !== 'Live') || !record.expiryDate) return false;
          const daysToExpiry = differenceInDays(new Date(record.expiryDate), new Date());
          return daysToExpiry <= 30 && daysToExpiry >= -9999; // include already expired ones
        });
        
        // Sort by closest expiry first
        filtered.sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate));

        setRecords(filtered);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  let filteredDisplayRecords = records.filter(record => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (record.url || '').toLowerCase().includes(term) ||
      (record.ownerName || '').toLowerCase().includes(term) ||
      (record.ownerSoeid || '').toLowerCase().includes(term) ||
      (record.ownerEmail || '').toLowerCase().includes(term) ||
      (record.pageType || '').toLowerCase().includes(term) ||
      (record.environment || '').toLowerCase().includes(term)
    );
  });

  // Smart Exact Match: If the user searches for an exact URL, only show that specific URL.
  if (searchTerm) {
    const exactMatches = filteredDisplayRecords.filter(r => (r.url || '').toLowerCase() === searchTerm.toLowerCase());
    if (exactMatches.length > 0) {
      filteredDisplayRecords = exactMatches;
    }
  }

  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRecords = filteredDisplayRecords.slice(startIndex, startIndex + rowsPerPage);
  const totalPages = Math.ceil(filteredDisplayRecords.length / rowsPerPage);

  const handleSendAlerts = async () => {
    if (filteredDisplayRecords.length === 0) {
      alert("No expiring records currently displayed to send.");
      return;
    }
    
    setSendingEmail(true);
    try {
      const response = await sendExpiryNotifications(filteredDisplayRecords);
      if (response.previewUrl) {
         console.log("Email Preview URL:", response.previewUrl);
         alert("Alert sent successfully! (Check console for ethereal preview URL)");
      } else {
         alert("Alert sent successfully!");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to send alerts. Check console for details.");
    }
    setSendingEmail(false);
  };

  return (
    <div className="p-8">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center bg-pink-50 border border-pink-100 p-6 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-3xl font-bold text-pink-900 flex items-center gap-2">
            <AlertTriangle className="w-8 h-8 text-pink-500" /> Expiring Soon
          </h2>
          <p className="text-pink-700/80 mt-1">URLs that are active and expiring within the next 30 days</p>
        </div>
        <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search expiring..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none w-64 text-sm bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <button 
            onClick={() => { trackButtonClick('ExpiringSoon - Send Alerts'); handleSendAlerts(); }}
            disabled={sendingEmail}
            className="bg-[#fbcfe8] border-none hover:bg-pink-300 text-pink-950 px-4 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Mail className="w-4 h-4" />
            <span>{sendingEmail ? 'Sending...' : 'Send Alerts'}</span>
          </button>
          <button 
            onClick={() => { trackButtonClick('ExpiringSoon - Export CSV'); exportToCsv('expiring_records.csv', filteredDisplayRecords); }}
            className="bg-[#bfdbfe] border-none hover:bg-blue-300 text-blue-900 px-4 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <div className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold shadow shadow-orange-200">
            {records.length} Action Needed
          </div>
        </div>
      </header>
      
      <div className="bg-white rounded-2xl shadow-sm border border-pink-200 overflow-x-auto">
        <table className="w-full text-left min-w-[1000px]">
          <thead>
            <tr className="border-b border-pink-200 bg-pink-50/50 text-slate-500 text-sm">
              <th className="p-4 font-medium">Full & Complete URL</th>
              <th className="p-4 font-medium">Page Type</th>
              <th className="p-4 font-medium min-w-[100px]">Environment</th>
              <th className="p-4 font-medium">Owner SOEID & Email</th>
              <th className="p-4 font-medium">Content Owner</th>
              <th className="p-4 font-medium">Expiry Date</th>
              <th className="p-4 font-medium text-right">Days Left</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr><td colSpan="7" className="p-8 text-center text-slate-400">Loading records...</td></tr>
            ) : paginatedRecords.length === 0 ? (
              <tr><td colSpan="7" className="p-12 text-center text-slate-400">No records found.</td></tr>
            ) : paginatedRecords.map(record => {
              const daysLeft = differenceInDays(new Date(record.expiryDate), new Date());
              const isExpired = daysLeft < 0;

              return (
              <tr key={record.id} className="hover:bg-pink-50/30 transition-colors">
                <td className="p-4">
                  <a href={record.url} target="_blank" rel="noreferrer" className="text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 w-48 truncate" title={record.url}>
                    {record.url} <ExternalLink className="w-3 h-3 inline" />
                  </a>
                </td>
                <td className="p-4 text-slate-600 font-medium">{record.pageType || '-'}</td>
                <td className="p-4 text-slate-600 font-medium">{record.environment || 'ICMS'}</td>
                <td className="p-4">
                  <div className="flex flex-col gap-1 w-48 truncate">
                    <span className="text-slate-700 font-medium">{record.ownerSoeid || '-'}</span>
                    <span className="text-slate-500 text-xs truncate" title={record.ownerEmail}>{record.ownerEmail || '-'}</span>
                  </div>
                </td>
                <td className="p-4 text-slate-600">{record.ownerName || '-'}</td>
                <td className="p-4 font-bold text-red-600">
                  {format(new Date(record.expiryDate), 'MMM d, yyyy')}
                </td>
                <td className="p-4 text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${isExpired ? 'bg-[#fbcfe8] text-pink-950' : 'bg-[#fef08a] text-yellow-950'}`}>
                    {isExpired ? 'Expired' : `${daysLeft} Days`}
                  </span>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-pink-200 bg-white px-4 py-3 sm:px-6 rounded-b-2xl">
            <div className="flex flex-1 justify-between sm:hidden">
              <button type="button" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Previous</button>
              <button type="button" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(startIndex + rowsPerPage, filteredDisplayRecords.length)}</span> of <span className="font-medium">{filteredDisplayRecords.length}</span> results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button type="button" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center rounded-l-md px-2 py-2 text-orange-400 ring-1 ring-inset ring-orange-300 hover:bg-orange-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 cursor-pointer">
                    <span className="sr-only">Previous</span>
                    &lt;
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-orange-900 ring-1 ring-inset ring-orange-300 focus:outline-offset-0 bg-orange-50/50">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button type="button" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="relative inline-flex items-center rounded-r-md px-2 py-2 text-orange-400 ring-1 ring-inset ring-orange-300 hover:bg-orange-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 cursor-pointer">
                    <span className="sr-only">Next</span>
                    &gt;
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
