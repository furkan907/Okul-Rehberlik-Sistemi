// ============================================================
// pages/ozel-egitim/ozel-egitim.js
// e-Okul Özel Eğitim Gereksinimli Öğrenci Listesi PDF'ini
// parse ederek öğrencilerin idare_notlari ve engel_durumu
// alanlarını Firestore'da toplu günceller.
// ============================================================

import { adminKoruması }     from "./auth-guard.js";
import { ozelEgitimGuncelle } from "./students.service.js";
import { toast }              from "./toast.js";

// ---------- PDF.js yapılandırması ----------
const pdfjsLib = window.pdfjsLib;
if (!pdfjsLib) throw new Error("PDF.js yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ============================================================
// Uygulama Durumu
// ============================================================
let parsedData = []; // [{ogrNo, sinif, sube, adSoyad, cinsiyet, engeller:[]}]

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
// Özel Eğitim Sınıfı Türü Normalizasyonu
// ============================================================
function ozelEgitimTurNormalize(tur) {
  if (/hafif\s+zihinsel/i.test(tur))                      return "H.Zihinsel";
  if (/orta\s+d[uü]zeyde?\s+zihinsel/i.test(tur))         return "O.Zihinsel";
  if (/a[gğ][iı]r\s+d[uü]zeyde?\s+zihinsel/i.test(tur))    return "A.Zihinsel";
  if (/otistik\s+hafif|hafif\s+otistik/i.test(tur))       return "H.Otistik";
  if (/otistik/i.test(tur))                               return "Otistik";
  if (/i[sş]itme/i.test(tur))                             return "İşitme";
  if (/görme/i.test(tur))                                 return "Görme";
  if (/bedensel/i.test(tur))                              return "Bedensel";
  return tur.substring(0, 15).trim();
}

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

    // Engel Durumu sütununun X sınırlarını ilk sayfadan tespit ederiz
    let engelX  = -1;     // Engel Durumu sütununun sol kenarı
    let hizmetX = Infinity; // Önerilen Hizmet sütununun sol kenarı

    const tumSatirlar = []; // ham parse sonuçları (konsolidasyondan önce)

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

      // Sayfa 1'de başlık satırından sütun X sınırlarını tespit et
      if (engelX < 0) {
        for (const line of lines) {
          const lineText = line.map(i => i.str).join(" ");
          if (lineText.includes("Engel") && (lineText.includes("nerilen") || lineText.includes("Hizmet"))) {
            const engelItem  = line.find(i => i.str.includes("Engel"));
            const hizmetItem = line.find(i => i.str.includes("nerilen") || i.str.includes("Hizmet"));
            if (engelItem)  engelX  = engelItem.transform[4];
            if (hizmetItem) hizmetX = hizmetItem.transform[4];
            break;
          }
        }
      }

      // Her satırı işle
      for (const lineItems of lines) {
        // Soldan sağa sırala
        lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

        // Tam satır metnini oluştur (boşluk ilavesiyle)
        let lineStr  = "";
        let prevItem = null;
        for (const item of lineItems) {
          if (prevItem) {
            // ğ, ü, ş gibi Türkçe karakterlerde PDF.js width=0 raporlayabilir.
            // import.js'deki gibi font boyutundan efektif genişlik hesapla.
            const fontSize      = prevItem.height || Math.abs(prevItem.transform[3]) || Math.abs(prevItem.transform[0]) || 10;
            const minReliable   = fontSize * 0.10;
            const effectiveWidth = (prevItem.width > minReliable)
              ? prevItem.width
              : prevItem.str.length * fontSize * 0.52;
            const prevXEnd = prevItem.transform[4] + effectiveWidth;
            const gap      = item.transform[4] - prevXEnd;
            const spaceThreshold = fontSize * 0.20;
            if (gap > spaceThreshold && !lineStr.endsWith(" ") && !item.str.startsWith(" ")) {
              lineStr += " ";
            }
          }
          lineStr  += item.str;
          prevItem  = item;
        }
        lineStr = lineStr.replace(/\s+/g, " ").trim();

        // Veri satırı tespiti: normal ("N. Sınıf / A Şubesi") veya özel eğitim ("N. Sınıf-Hafif Zihinsel / A Şubesi")
        // Grup 4 = opsiyonel özel eğitim türü (örn: "Hafif Zihinsel"), Grup 5 = şube harfi
        const rowMatch = /^(\d{1,3})\s+(\d{2,6})\s+(\d+)\.?\s*S[\u0131i]n[\u0131i]f(?:[-–]([^/]+?))?\s*\/\s*([A-Za-zÇĞİÖŞÜçğışöü])\s*[Şş]ubesi\s+(.+?)\s+(Erkek|K[\u0131i]z)/i
          .exec(lineStr);

        if (!rowMatch) continue;

        // Engel Durumu metnini X koordinatıyla ayıkla
        let engelText = "";
        if (engelX >= 0) {
          const engelItems = lineItems.filter(
            i => i.transform[4] >= engelX - 15 && i.transform[4] < hizmetX - 15
          );
          // Aynı boşluk mantığını uygula (ğ/ü/ş gibi karakterlerde width=0 olabilir)
          let eStr = "";
          let ePrev = null;
          for (const item of engelItems) {
            if (ePrev) {
              const fs  = ePrev.height || Math.abs(ePrev.transform[3]) || Math.abs(ePrev.transform[0]) || 10;
              const minR = fs * 0.10;
              const ew  = (ePrev.width > minR) ? ePrev.width : ePrev.str.length * fs * 0.52;
              const gap = item.transform[4] - (ePrev.transform[4] + ew);
              if (gap > fs * 0.20 && !eStr.endsWith(" ") && !item.str.startsWith(" ")) {
                eStr += " ";
              }
            }
            eStr  += item.str;
            ePrev  = item;
          }
          engelText = eStr.replace(/\s+/g, " ").trim();
        }

        // Koordinat yöntemi başarısız olursa metin tabanlı yedek yöntem
        if (!engelText) {
          const afterGender = lineStr.split(/\b(?:Erkek|K[ıi]z)\b/);
          if (afterGender.length > 1) {
            const rest = afterGender[1].trim();
            // "Tam Zamanlı", "Yarı Zamanlı", "Özel Eğitim Okulu", "Özel Sınıf",
            // "Kaynaştırma/" ile başlayan servis metinlerini kes
            const serviceMatch = /^(.+?)\s+(?:Tam\s+Zamanl[ıi]|Yar[ıi]\s+Zamanl[ıi]|Özel\s+E[ğg]itim\s+Okulu|Özel\s+S[ıi]n[ıi]f|Kaynaştırma\s*[/])/
              .exec(rest);
            engelText = serviceMatch ? serviceMatch[1].trim() : rest;
          }
        }

        if (!engelText) continue;

        // Özel eğitim sınıfı mı ("N. Sınıf-Hafif Zihinsel / A Şubesi") yoksa normal sınıf mı?
        const ozelTip = rowMatch[4] ? rowMatch[4].trim() : null;
        tumSatirlar.push({
          ogrNo:    rowMatch[2],
          sinif:    ozelTip ? "Özel Eğitim" : rowMatch[3],
          sube:     ozelTip ? ozelEgitimTurNormalize(ozelTip) : rowMatch[5].toUpperCase(),
          adSoyad:  rowMatch[6].trim(),
          cinsiyet: /erkek/i.test(rowMatch[7]) ? "E" : "K",
          engelDurumu: engelText,
        });
      }
    }

    if (tumSatirlar.length === 0) {
      toast.hata(
        "Bu PDF'den özel eğitim verisi çıkarılamadı. " +
        "e-Okul Özel Eğitim Gereksinimli Öğrenci Listesi PDF'i olduğundan emin olun."
      );
      sifirlaUploadZone();
      return;
    }

    // Aynı öğrencinin birden fazla engel kaydını birleştir (öğrenci no'ya göre)
    const konsolide = {};
    for (const satir of tumSatirlar) {
      if (!konsolide[satir.ogrNo]) {
        konsolide[satir.ogrNo] = {
          ogrNo:    satir.ogrNo,
          sinif:    satir.sinif,
          sube:     satir.sube,
          adSoyad:  satir.adSoyad,
          cinsiyet: satir.cinsiyet,
          engeller: [],
        };
      }
      const entry = konsolide[satir.ogrNo];
      if (!entry.engeller.includes(satir.engelDurumu)) {
        entry.engeller.push(satir.engelDurumu);
      }
    }

    parsedData = Object.values(konsolide);

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
  const toplamKayit = parsedData.reduce((s, o) => s + o.engeller.length, 0);

  document.getElementById("ozet-bar").innerHTML = `
    <span class="ozet-item"><strong>${parsedData.length}</strong> Öğrenci</span>
    <span class="ozet-item"><strong>${toplamKayit}</strong> Engel Kaydı</span>
  `;

  const tbody = document.getElementById("onizleme-tbody");
  if (parsedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="tablo-bos">Veri bulunamadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = parsedData.map((o, i) => `
    <tr>
      <td style="color:var(--neutral-400)">${i + 1}</td>
      <td><strong>${o.ogrNo}</strong></td>
      <td>${o.adSoyad}</td>
      <td><span class="badge badge-neutral">${o.sinif}-${o.sube}</span></td>
      <td>${o.engeller.map(e => `<span class="engel-badge">${e}</span>`).join("")}</td>
    </tr>
  `).join("");
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
  const yukleBtn    = document.getElementById("yukle-btn");
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
    const { eslesen, eslesmedi } = await zamanAsimi(ozelEgitimGuncelle(parsedData));
    progressBar.style.width = "100%";

    if (eslesmedi > 0) {
      toast.uyari(
        `${eslesen} öğrenci güncellendi. ` +
        `${eslesmedi} öğrenci sistemde bulunamadı (önce öğrenci listesini yükleyin).`
      );
    } else {
      toast.basari(`${eslesen} öğrencinin özel eğitim bilgileri başarıyla güncellendi.`);
    }

    setTimeout(() => {
      window.location.href = "../dashboard/index.html";
    }, 2000);

  } catch (e) {
    toast.hata("Güncelleme başarısız: " + e.message);
    progressWrap.classList.add("hidden");
    progressText.classList.add("hidden");
    yukleBtn.disabled    = false;
    yukleBtn.textContent = "☁️ İdare Notlarını Güncelle";
  }
}
