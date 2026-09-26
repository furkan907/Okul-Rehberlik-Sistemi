import * as XLSX from 'xlsx';
import { Student } from '../types';

/**
 * e-Okul'dan alınan Excel/CSV verisini okur ve 
 * Firestore'a uygun Student dizisine dönüştürür.
 */
export const parseStudentExcel = (file: File): Promise<Partial<Student>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Veriyi JSON formatına çevir
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // e-Okul Excel kolon isimlerine göre eşleme (Örnektir, yüklenen dosyaya göre revize edilebilir)
        const students: Partial<Student>[] = jsonData.map((row: any) => ({
          tc: String(row['T.C. Kimlik No'] || row['TC'] || ''),
          ad: String(row['Adı'] || row['AD'] || ''),
          soyad: String(row['Soyadı'] || row['SOYAD'] || ''),
          sinif: String(row['Sınıfı'] || row['SINIF'] || ''),
          sube: String(row['Şubesi'] || row['SUBE'] || ''),
          form_dolduruldu: false,
          risk_skoru: 0,
          risk_detaylari: null,
        })).filter(s => s.tc && s.ad); // Boş satırları ele

        resolve(students);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
