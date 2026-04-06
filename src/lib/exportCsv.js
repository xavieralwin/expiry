import { format } from 'date-fns';

export function exportToCsv(filename, rows) {
  if (!rows || !rows.length) {
    alert('No records to download');
    return;
  }
  
  const headers = ['Full & Complete URL', 'Content owner SOEID', 'Content Owner Email ID', 'Page Type', 'Page Status', 'Expiry Date', 'Content Owner'];
  
  const csvContent = [
    headers.join(','),
    ...rows.map(r => {
      const expiryDate = r.expiryDate ? format(new Date(r.expiryDate), 'yyyy-MM-dd') : '';
      return [
        `"${r.url || ''}"`,
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
