// ============================================================
// pages/grades/grades.js
// e-Okul Ağırlıklı Ortalamasına Göre Başarı Sıralaması PDF'ini
// parse ederek 70 altındaki öğrencilerin idare_notlari alanında
// akademik_dusuk: true yapacak Firestore toplu güncellemesini yapar.
// ============================================================

import { adminKoruması }       from "./auth-guard.js";
import { notOrtalamasiGuncelle } from "./students.service.js";
import { toast }               from "./toast.js";

// ---------- PDF.js yapılandırması ----------
const pdfjsLib = window.pdfjsLib;
if (!pdfjsLib) throw new Error("PDF.js yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ============================================================
// Uygulama Durumu
// ============================================================
let parsedData = []; // [{ogrNo, adSoyad, sinif, sube, ortalama}]

// ============================================================
// Başlatma
// ============================================================
adminKoruması((user, profil) => {
  // Sadece admin ve superadmin erisebilir
  if (profil.role === "ogretmen") {
    window.location.href = "../dashboard/index.html";
    return;
  }
  kurUpload();
});

// ============================================================
// Upload Alanı
// ============================================================
function kurUpload() {
  const zone     = document.getElementById("upload-zone");
  const input    = document.getElementById("file-input");
  const resetBtn = document.getElementById("reset-btn");

  zone.addEventListener("click", () => input.click());

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") pdfIsle(file);
    else toast.uyari("Lütfen yalnızca PDF dosyası seçin.");
  });

  input.addEventListener("change", () => {
    if (input.files[0]) pdfIsle(input.files[0]);
  });

  resetBtn.addEventListener("click", () => {
    parsedData = [];
    input.value = "";
    document.getElementById("bolum-upload").classList.remove("hidden");
    document.getElementById("bolum-onizleme").classList.add("hidden");
    sifirlaUploadZone();
  });

  document.getElementById("yukle-btn").addEventListener("click", firestoreGuncelle);
}

function sifirlaUploadZone() {
  const zone = document.getElementById("upload-zone");
  zone.classList.remove("has-file", "drag-over");
  document.getElementById("upload-icon").textContent = "📄";
  document.getElementById("upload-text").textContent = "PDF dosyasını buraya sürükleyin";
  document.getElementById("upload-hint").textContent = "veya seçmek için tıklayın • Yalnızca .pdf";
}

// ============================================================
// PDF İşleme
// ============================================================
async function pdfIsle(file) {
  const zone = document.getElementById("upload-zone");
  zone.classList.add("has-file");
  document.getElementById("upload-icon").textContent = "⏳";
  document.getElementById("upload-text").textContent = "PDF okunuyor...";
  document.getElementById("upload-hint").textContent = file.name;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const sonuclar = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page        = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Boş öğeleri filtrele, Y eksenine göre yukarıdan aşağı sırala
      const items = textContent.items.filter(i => i.str && i.str.trim() !== "");
      items.sort((a, b) => b.transform[5] - a.transform[5]);

      // 5px toleransla satırlara grupla
      const lines     = [];
      let currentLine = [];
      let lastY       = items.length > 0 ? items[0].transform[5] : 0;

      for (const item of items) {
        if (Math.abs(lastY - item.transform[5]) <= 5) {
          currentLine.push(item);
        } else {
          if (currentLine.length > 0) lines.push(currentLine);
          currentLine = [item];
          lastY       = item.transform[5];
        }
      }
      if (currentLine.length > 0) lines.push(currentLine);

      // Her satırı işle
      for (const lineItems of lines) {
        // Soldan sağa sırala
        lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

        // Boşluk farkına göre metin oluştur (Türkçe karakterlerde width=0 olabilir)
        let lineStr  = "";
        let prevItem = null;
        for (const item of lineItems) {
          if (prevItem) {
            const fontSize      = prevItem.height || Math.abs(prevItem.transform[3]) || Math.abs(prevItem.transform[0]) || 10;
            const minReliable   = fontSize * 0.10;
            const effectiveWidth = (prevItem.width > minReliable)
              ? prevItem.width
              : prevItem.str.length * fontSize * 0.52;
            const prevXEnd = prevItem.transform[4] + effectiveWidth;
            const gap      = item.transform[4] - prevXEnd;
            if (gap > fontSize * 0.20 && !lineStr.endsWith(" ") && !item.str.startsWith(" ")) {
              lineStr += " ";
            }
          }
          lineStr  += item.str;
          prevItem  = item;
        }
        lineStr = lineStr.replace(/\s+/g, " ").trim();

        // Veri satırı tespiti:
        // Format: [Sıra] [Öğr.No] [Ad Soyad] [N. Sınıf / X Şubesi] [Ortalama?] [Sonuç]
        // Ortalama Türk ondalık biçiminde: 99,89 veya 70,00
        // Öğr.No 1 haneli olabilir (örn: 5), bu yüzden \d{1,6} kullanılır.
        const SINIF_RE = /^(\d{1,3})\s+(\d{1,6})\s+(.+?)\s+(\d+)\.?\s*S[ıi]n[ıi]f\s*\/\s*([A-ZÇĞİÖŞÜa-zçğışöü])\s*[Şş]ubesi/i;
        const baseMatch = SINIF_RE.exec(lineStr);
        if (!baseMatch) continue;

        // Sınıf/Şube'den sonra kalan metin
        const afterSinif = lineStr.slice(baseMatch[0].length).trim();

        // Numerik ortalama var mı? (örn: "99,89" veya "70,00")
        const gradeMatch = /^(\d{1,3}[,.]\d{2})\s+\S/.exec(afterSinif);

        let ortalama;
        if (gradeMatch) {
          ortalama = parseFloat(gradeMatch[1].replace(",", "."));
          if (isNaN(ortalama)) continue;
        } else if (afterSinif.length > 0) {
          // Ortalama sütunu boş; sonuç "TÜRKÇE ORTALAMASI 70'DEN KÜÇÜK" vb.
          // Bu öğrenciler notu olmayan öğrenciler → akademik başarısı düşük
          ortalama = null;
        } else {
          continue;
        }

        // Disiplin cezası tespiti: "KINAMA" veya "OKUL DEĞİŞTIRME CEZASI"
        const disiplinCezasi = /kinama|okul\s+değiştirme\s+ceza/i.test(afterSinif);

        sonuclar.push({
          ogrNo:    baseMatch[2],
          adSoyad:  baseMatch[3].trim(),
          sinif:    baseMatch[4],
          sube:     baseMatch[5].toUpperCase(),
          ortalama,
          disiplinCezasi,
        });
      }
    }

    if (sonuclar.length === 0) {
      toast.hata(
        "Bu PDF'den not ortalaması verisi çıkarılamadı. " +
        "e-Okul Ağırlıklı Ortalamasına Göre Başarı Sıralaması PDF'i olduğundan emin olun."
      );
      sifirlaUploadZone();
      return;
    }

    parsedData = sonuclar;
    onizlemeGoster();
    document.getElementById("bolum-upload").classList.add("hidden");
    document.getElementById("bolum-onizleme").classList.remove("hidden");

  } catch (e) {
    console.error("PDF parse hatası:", e);
    toast.hata("PDF okunamadı: " + e.message);
    sifirlaUploadZone();
  }
}

// ============================================================
// Önizleme
// ============================================================
function onizlemeGoster() {
  const dusukSayisi = parsedData.filter(o => o.ortalama === null || o.ortalama < 70).length;

  document.getElementById("ozet-bar").innerHTML = `
    <span class="ozet-item"><strong>${parsedData.length}</strong> Öğrenci</span>
    <span class="ozet-item"><strong>${dusukSayisi}</strong> Akademik Başarısı Düşük (< 70 veya notu yok)</span>
  `;

  const tbody = document.getElementById("onizleme-tbody");
  if (parsedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="tablo-bos">Veri bulunamadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = parsedData.map((o, i) => {
    const dusuk = o.ortalama === null || o.ortalama < 70;
    const ortalamaGoster = o.ortalama !== null
      ? o.ortalama.toFixed(2).replace(".", ",")
      : `<span style="color:var(--neutral-400)">—</span>`;
    const durumBadge = dusuk
      ? `<span class="dusuk-badge">Akademik Düşük</span>`
      : `<span class="normal-badge">${o.ortalama >= 85 ? "Takdir" : "Teşekkür/Başarı"}</span>`;
    return `
      <tr>
        <td style="color:var(--neutral-400)">${i + 1}</td>
        <td><strong>${o.ogrNo}</strong></td>
        <td>${o.adSoyad}</td>
        <td><span class="badge badge-neutral">${o.sinif}-${o.sube}</span></td>
        <td style="font-weight:600;${dusuk ? "color:#dc2626" : ""}">${ortalamaGoster}</td>
        <td>${durumBadge}</td>
      </tr>
    `;
  }).join("");
}

// ============================================================
// Firestore Güncelle
// ============================================================
function zamanAsimi(promise, ms = 60000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`İşlem zaman aşımına uğradı (${ms / 1000}s). Bağlantınızı kontrol edin.`)),
      ms
    )
  );
  return Promise.race([promise, timeout]);
}

async function firestoreGuncelle() {
  const yukleBtn     = document.getElementById("yukle-btn");
  const progressWrap = document.getElementById("progress-wrap");
  const progressBar  = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");

  yukleBtn.disabled    = true;
  yukleBtn.textContent = "Güncelleniyor...";
  progressWrap.classList.remove("hidden");
  progressText.classList.remove("hidden");
  progressText.textContent = "Öğrenciler eşleştiriliyor...";
  progressBar.style.width  = "30%";

  try {
    const { eslesen, eslesmedi, akademikDusuk } =
      await zamanAsimi(notOrtalamasiGuncelle(parsedData));
    progressBar.style.width = "100%";

    if (eslesmedi > 0) {
      toast.uyari(
        `${eslesen} öğrenci güncellendi (${akademikDusuk} tanesi Akademik Düşük işaretlendi). ` +
        `${eslesmedi} öğrenci sistemde bulunamadı (önce öğrenci listesini yükleyin).`
      );
    } else {
      toast.basari(
        `${eslesen} öğrencinin not ortalaması kaydedildi. ` +
        `${akademikDusuk} öğrenci Akademik Başarısı Düşük olarak işaretlendi.`
      );
    }

    setTimeout(() => {
      window.location.href = "../dashboard/index.html";
    }, 2500);

  } catch (e) {
    console.error("Firestore güncelleme hatası:", e);
    toast.hata("Güncelleme başarısız: " + e.message);
    yukleBtn.disabled    = false;
    yukleBtn.textContent = "☁️ İdare Notlarını Güncelle";
    progressWrap.classList.add("hidden");
    progressText.classList.add("hidden");
  }
}
