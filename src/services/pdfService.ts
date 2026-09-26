import * as pdfjsLib from 'pdfjs-dist';
import { Student } from '../types';

// PDF.js worker ayarı (CDN üzerinden yüklemek en güvenlisi)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * e-Okul'dan alınan PDF öğrenci listesini okur ve 
 * Firestore'a uygun Student dizisine dönüştürür.
 */
export const parseStudentPDF = async (file: File): Promise<Partial<Student>[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const students: Partial<Student>[] = [];

  // Sabit sayfa sınıf/şube bilgilerini taşımak için
  let currentClass = '';
  let currentBranch = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Satırları belirlemek için öğeleri dikey (Y) eksenine göre grupla
    const items = (textContent.items as any[]).filter(item => item.str && item.str.trim() !== '');
    
    // Y ekseninde (yukarıdan aşağı) sırala
    items.sort((a, b) => b.transform[5] - a.transform[5]);

    const lines: any[][] = [];
    let currentLine: any[] = [];
    let lastY = items.length > 0 ? items[0].transform[5] : 0;

    for (const item of items) {
      if (Math.abs(lastY - item.transform[5]) <= 5) {
        currentLine.push(item);
      } else {
        lines.push(currentLine);
        currentLine = [item];
        lastY = item.transform[5];
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    for (const lineItems of lines) {
      // Aynı satırdaki öğeleri soldan sağa (X koordinatına) göre sırala
      lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

      let lineStr = '';
      let prevItem = null;

      for (const item of lineItems) {
        if (prevItem) {
          const prevXEnd = prevItem.transform[4] + (prevItem.width || 0);
          const currentX = item.transform[4];
          
          // Öğeler arası mesafe 1.5'ten büyükse ve boşluk yoksa boşluk ekle.
          // (İ ile SMET arasındaki harf ayrılmalarını önleyip, İNCİ ADA gibi kelimeleri ayırmak için ortalama bir eşik)
          if (currentX - prevXEnd > 1.5 && !lineStr.endsWith(' ') && !item.str.startsWith(' ')) {
            lineStr += ' ';
          }
        }
        lineStr += item.str;
        prevItem = item;
      }
      
      lineStr = lineStr.replace(/\s+/g, ' ').trim();

      // Sınıf ve Şube bilgisini bulma
      const cMatch = /(\d+)\.?\s*Sınıf/i.exec(lineStr);
      if (cMatch) currentClass = cMatch[1];
      
      const bMatch = /([A-Z])\s*Şubesi/i.exec(lineStr);
      if (bMatch) currentBranch = bMatch[1].toUpperCase();

      // Öğrenci verisini bulma: [SıraNo] [ÖğrenciNo] [Ad Soyad] [Cinsiyet]
      // Cinsiyet kelimesi ile soyad birleşmişse bile (örn: ÇINARErkek) yakalamak için esnek regex
      const studentMatch = /(?:^|\s+)(\d+)\s+(\d{1,6})\s+(.+?)\s*(Erkek|Kız)$/i.exec(lineStr);

      if (studentMatch) {
        const studentNo = studentMatch[2];
        let adSoyadText = studentMatch[3].trim();
        
        // Şayet "Erkek" veya "Kız" isimle kelime arası boşluksuz bitiştiyse düzeltme (örn: ÇINARErkek -> yakalandı ama "ÇINAR" sonda kaldı)
        adSoyadText = adSoyadText.replace(/(Erkek|Kız)$/i, '').trim();

        // Ad ve Soyad ayrıştırması
        const nameParts = adSoyadText.split(/\s+/);
        let soyad = '';
        let ad = adSoyadText;
        
        if (nameParts.length > 1) {
          soyad = nameParts.pop() || '';
          ad = nameParts.join(' ');
        }

        students.push({
          tc: studentNo,
          ad: ad,
          soyad: soyad,
          sinif: currentClass,
          sube: currentBranch,
          form_dolduruldu: false,
          risk_skoru: 0,
          risk_detaylari: null,
        });
      }
    }
  }

  // T.C. / Okul No mükerrerliklerini güvenlik amaçlı temizleme
  const uniqueStudents = Array.from(new Map(students.map(s => [s.tc, s])).values());

  return uniqueStudents;
};
