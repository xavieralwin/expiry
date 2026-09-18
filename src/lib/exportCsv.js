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

export function exportToCsv(arg1, arg2) {
  let filename = 'export.csv';
  let rows = [];

  if (typeof arg1 === 'string') {
    filename = arg1;
    rows = arg2;
  } else if (Array.isArray(arg1)) {
    rows = arg1;
    filename = typeof arg2 === 'string' ? arg2 : 'export.csv';
  }

  if (!rows || !rows.length) {
    alert('No records to download');
    return;
  }
  
  const firstRow = rows[0];
  const isGenericObjectArray = firstRow && typeof firstRow === 'object' && !('url' in firstRow);

  let csvContent = '';

  if (isGenericObjectArray) {
    const keys = Object.keys(firstRow);
    const headerLine = keys.map(k => `"${k.replace(/"/g, '""')}"`).join(',');
    const dataLines = rows.map(row => 
      keys.map(k => {
        const val = row[k] === null || row[k] === undefined ? '' : String(row[k]);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    );
    csvContent = [headerLine, ...dataLines].join('\n');
  } else {
    const headers = ['Full & Complete URL', 'Landing URL', 'Content owner SOEID', 'Content Owner Email ID', 'Page Type', 'Environment', 'Page Status', 'Expiry Date', 'Content Owner', 'WMR', 'CHG', 'Release Date', 'Release Month'];
    
    csvContent = [
      headers.join(','),
      ...rows.map(r => {
        const expiryDate = r.expiryDate ? format(new Date(r.expiryDate), 'yyyy-MM-dd') : '';
        const releaseDate = r.releaseDate ? format(new Date(r.releaseDate), 'yyyy-MM-dd') : '';
        const releaseMonth = getReleaseMonth(r.releaseDate);
        return [
          `"${(r.url || '').replace(/"/g, '""')}"`,
          `"${(r.landingUrl || '').replace(/"/g, '""')}"`,
          `"${(r.ownerSoeid || '').replace(/"/g, '""')}"`,
          `"${(r.ownerEmail || '').replace(/"/g, '""')}"`,
          `"${(r.pageType || '').replace(/"/g, '""')}"`,
          `"${(r.environment || '').replace(/"/g, '""')}"`,
          `"${(r.status || '').replace(/"/g, '""')}"`,
          `"${expiryDate}"`,
          `"${(r.ownerName || '').replace(/"/g, '""')}"`,
          `"${(r.wmrNo || '').replace(/"/g, '""')}"`,
          `"${(r.chgNo || '').replace(/"/g, '""')}"`,
          `"${releaseDate}"`,
          `"${releaseMonth}"`
        ].join(',');
      })
    ].join('\n');
  }

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

export function exportToXlsx(arg1, arg2) {
  let filename = 'export.xlsx';
  let rows = [];

  if (typeof arg1 === 'string') {
    filename = arg1;
    rows = arg2;
  } else if (Array.isArray(arg1)) {
    rows = arg1;
    filename = typeof arg2 === 'string' ? arg2 : 'export.xlsx';
  }

  if (!rows || !rows.length) {
    alert('No records to download');
    return;
  }

  const firstRow = rows[0];
  const isGenericObjectArray = firstRow && typeof firstRow === 'object' && !('url' in firstRow);

  let worksheetData = [];
  if (isGenericObjectArray) {
    worksheetData = rows;
  } else {
    worksheetData = rows.map(r => ({
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
  }

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  XLSX.writeFile(workbook, filename);
}
