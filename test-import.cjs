const XLSX = require('xlsx');
const fs = require('fs');

try {
  const workbook = XLSX.readFile('C:\\Users\\Alwin\\Desktop\\input.xlsx', { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  
  if (rawJson.length > 0) {
    const out = {
      length: rawJson.length,
      headers: Object.keys(rawJson[0]),
      firstRow: rawJson[0]
    };
    fs.writeFileSync('output.json', JSON.stringify(out, null, 2));
    console.log("Wrote mapping to output.json");
  } else {
    console.log("Sheet is empty.");
  }
} catch (error) {
  console.error("Failed to read excel file:", error);
}
