import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export function exportToCsv(filename, rows) {
  if (!rows || !rows.length) {
    alert('No records to download');
    return;
  }
  
  const headers = ['Full & Complete URL', 'Landing URL', 'Content owner SOEID', 'Content Owner Email ID', 'Page Type', 'Page Status', 'Expiry Date', 'Content Owner'];
  
  const csvContent = [
    headers.join(','),
    ...rows.map(r => {
      const expiryDate = r.expiryDate ? format(new Date(r.expiryDate), 'yyyy-MM-dd') : '';
      return [
        `"${r.url || ''}"`,
        `"${r.landingUrl || ''}"`,
        `"${(r.ownerSoeid || '').replace(/"/g, '""')}"`,
        `"${(r.ownerEmail || '').replace(/"/g, '""')}"`,
        `"${r.pageType || ''}"`,
        `"${r.status || ''}"`,
        `"${expiryDate}"`,
        `"${(r.ownerName || '').replace(/"/g, '""')}"`
      ].join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function exportToXlsx(filename, rows) {
  if (!rows || !rows.length) {
    alert('No records to download');
    return;
  }

  const worksheetData = rows.map(r => ({
    'Full & Complete URL': r.url || '',
    'Landing URL': r.landingUrl || '',
    'Content owner SOEID': r.ownerSoeid || '',
    'Content Owner Email ID': r.ownerEmail || '',
    'Page Type': r.pageType || '',
    'Page Status': r.status || '',
    'Expiry Date': r.expiryDate ? format(new Date(r.expiryDate), 'yyyy-MM-dd') : '',
    'Content Owner': r.ownerName || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vanity URLs');
  
  XLSX.writeFile(workbook, filename);
}
