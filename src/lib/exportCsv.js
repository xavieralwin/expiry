import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export function getReleaseMonth(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const month = monthNames[monthIdx];
    const weekNum = Math.ceil(day / 7);
    return `${month} W${weekNum}`;
  }
  return '-';
}

export function exportToCsv(filename, rows) {
  if (!rows || !rows.length) {
    alert('No records to download');
    return;
  }
  
  const headers = ['Full & Complete URL', 'Landing URL', 'Content owner SOEID', 'Content Owner Email ID', 'Page Type', 'Environment', 'Page Status', 'Expiry Date', 'Content Owner', 'WMR', 'CHG', 'Release Date', 'Release Month'];
  
  const csvContent = [
    headers.join(','),
    ...rows.map(r => {
      const expiryDate = r.expiryDate ? format(new Date(r.expiryDate), 'yyyy-MM-dd') : '';
      const releaseDate = r.releaseDate ? format(new Date(r.releaseDate), 'yyyy-MM-dd') : '';
      const releaseMonth = getReleaseMonth(r.releaseDate);
      return [
        `"${r.url || ''}"`,
        `"${r.landingUrl || ''}"`,
        `"${(r.ownerSoeid || '').replace(/"/g, '""')}"`,
        `"${(r.ownerEmail || '').replace(/"/g, '""')}"`,
        `"${r.pageType || ''}"`,
        `"${r.environment || ''}"`,
        `"${r.status || ''}"`,
        `"${expiryDate}"`,
        `"${(r.ownerName || '').replace(/"/g, '""')}"`,
        `"${r.wmrNo || ''}"`,
        `"${r.chgNo || ''}"`,
        `"${releaseDate}"`,
        `"${releaseMonth}"`
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
    'Environment': r.environment || '',
    'Page Status': r.status || '',
    'Expiry Date': r.expiryDate ? format(new Date(r.expiryDate), 'yyyy-MM-dd') : '',
    'Content Owner': r.ownerName || '',
    'WMR': r.wmrNo || '',
    'CHG': r.chgNo || '',
    'Release Date': r.releaseDate ? format(new Date(r.releaseDate), 'yyyy-MM-dd') : '',
    'Release Month': getReleaseMonth(r.releaseDate)
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vanity URLs');
  
  XLSX.writeFile(workbook, filename);
}
