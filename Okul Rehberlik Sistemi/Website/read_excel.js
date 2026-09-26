const ExcelJS = require('exceljs');

async function read() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('c:\\Users\\furka\\OneDrive\\Masaüstü\\okul-rehberlik-sistemi\\assets\\riba\\RİBA LİSE.xlsx');
  
  workbook.eachSheet((worksheet, sheetId) => {
    console.log(`Sheet: ${worksheet.name}`);
    worksheet.eachRow((row, rowNumber) => {
      // Just print if the row contains "(1)" or "(2)"
      const vals = row.values;
      if (vals) {
        const text = JSON.stringify(vals);
        if (text.includes('(1)') || text.includes('(2)') || text.includes('(3)')) {
          console.log(`Row ${rowNumber}: ${text}`);
        }
      }
    });
  });
}
read();