// ============================================================
// pages/import/import.js
// e-Okul sınıf listesi PDF → parse → Firestore toplu yükleme
// PDF.js global script olarak yüklendi (window.pdfjsLib)
// ============================================================

import { adminKoruması }       from "./auth-guard.js";
import { topluOgrenciYukle,
         okulKaydet }          from "./students.service.js";
import { toast }               from "./toast.js";

// ---------- PDF.js yapılandırması ----------
const pdfjsLib = window.pdfjsLib;
if (!pdfjsLib) throw new Error("PDF.js yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


// ============================================================
// Uygulama Durumu
// ============================================================
let parsedData = {};   // { "5-A": [{tc, ad, soyad, sinif, sube},...] }
let aktifSinif = null;
let okulSlug   = '';   // PDF'den algılanan okul slug'u (örn: "bozkurt-ortaokulu")
let okulAdi    = '';   // PDF'den algılanan okul adı (örn: "Bozkurt Ortaokulu")

// ============================================================
// Okul slug normalizasyonu (Türkçe karakter + lowercase)
// ============================================================
function okulSlugOlustur(ad) {
  return ad
    .replace(/İ/g,'i').replace(/I/g,'i').replace(/Ğ/g,'g').replace(/ğ/g,'g')
    .replace(/Ü/g,'u').replace(/ü/g,'u').replace(/Ş/g,'s').replace(/ş/g,'s')
    .replace(/Ö/g,'o').replace(/ö/g,'o').replace(/Ç/g,'c').replace(/ç/g,'c')
    .replace(/ı/g,'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Sınıf numarasına göre kademe döndürür.
 * Aynı binada ortaokul+lise olan okullarda (İmam Hatip vb.) öğrencileri
 * kademeye göre ayırt edebilmek için kullanılır.
 */
function kademeHesapla(sinif) {
  if (sinif === 'Özel Eğitim') return 'ozel-egitim';
  const n = parseInt(sinif, 10);
  if (n >= 9)  return 'lise';
  if (n >= 5)  return 'ortaokul';
  return 'ilkokul';
}

// ============================================================
// Başlatma
// ============================================================
adminKoruması((user, profil) => {
  kurUpload(profil);
});

// ============================================================
// Upload Alanı
// ============================================================
function kurUpload(profil) {
  const zone      = document.getElementById("upload-zone");
  const input     = document.getElementById("file-input");
  const resetBtn  = document.getElementById("reset-btn");

  // Okul adını header'da göster
  if (profil?.okul_adi) {
    const sub = document.querySelector(".dash-brand-sub");
    if (sub) sub.textContent = profil.okul_adi;
  }

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
    parsedData = {};
    aktifSinif = null;
    okulSlug   = '';
    okulAdi    = '';
    input.value = "";
    document.getElementById("bolum-upload").classList.remove("hidden");
    document.getElementById("bolum-onizleme").classList.add("hidden");
    sifirlaUploadZone();
  });

  document.getElementById("yukle-btn").addEventListener("click", firestoreYukle);
}

function sifirlaUploadZone() {
  const zone = document.getElementById("upload-zone");
  zone.classList.remove("has-file", "drag-over");
  document.getElementById("upload-icon").textContent  = "📄";
  document.getElementById("upload-text").textContent  = "PDF dosyasını buraya sürükleyin";
  document.getElementById("upload-hint").textContent  = "veya seçmek için tıklayın • Yalnızca .pdf";
}

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
// PDF İşleme
// ============================================================
async function pdfIsle(file) {
  const zone = document.getElementById("upload-zone");
  zone.classList.add("has-file");
  document.getElementById("upload-icon").textContent  = "⏳";
  document.getElementById("upload-text").textContent  = "PDF okunuyor...";
  document.getElementById("upload-hint").textContent  = file.name;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    parsedData = {};
    okulSlug   = '';
    okulAdi    = '';

    // Sayfalar arası sınıf/şube bilgisini taşımak için
    let currentClass  = '';
    let currentBranch = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page        = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Boş olmayan öğeleri filtrele, Y eksenine göre sırala (yukarıdan aşağı)
      const items = textContent.items.filter(item => item.str && item.str.trim() !== '');
      items.sort((a, b) => b.transform[5] - a.transform[5]);

      // 5px toleransla satırlara grupla
      const lines    = [];
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

      for (const lineItems of lines) {
        // Soldan sağa (X koordinatı) sırala
        lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

        let lineStr  = '';
        let prevItem = null;

        for (const item of lineItems) {
          if (prevItem) {
            // Font boyutunu al: height tercih edilir, yoksa transform matrisinden hesapla
            const fontSize = prevItem.height || Math.abs(prevItem.transform[3]) || Math.abs(prevItem.transform[0]) || 10;

            // İ, Ğ, Ş gibi gliflerde PDF.js bazen width=0 raporlar.
            // Bu durumda karakter sayısı × tahmini karakter genişliğiyle düzelt;
            // yoksa "İ" + "SMET" arasındaki boşluk abartılı görünüp yanlış space eklenir.
            const minReliableWidth = fontSize * 0.10;
            const effectiveWidth = (prevItem.width > minReliableWidth)
              ? prevItem.width
              : prevItem.str.length * fontSize * 0.52;

            const prevXEnd = prevItem.transform[4] + effectiveWidth;
            const currentX = item.transform[4];
            const gap      = currentX - prevXEnd;

            // Boşluk eşiği: font boyutunun %20'si.
            // – Düşük eşik: "İNCİ ADA" gibi bitişik çift isimlerdeki küçük boşlukları yakalar.
            // – Genişlik düzeltmesiyle birlikte: "İ"+"SMET" gibi yanlış ayrılmaları önler.
            const spaceThreshold = fontSize * 0.20;

            if (gap > spaceThreshold && !lineStr.endsWith(' ') && !item.str.startsWith(' ')) {
              lineStr += ' ';
            }
          }
          lineStr  += item.str;
          prevItem  = item;
        }

        lineStr = lineStr.replace(/\s+/g, ' ').trim();

        // Okul adını PDF başlığından algıla (örn: "Bozkurt / Bozkurt Ortaokulu Müdürlüğü")
        if (!okulSlug) {
          const okulMatch = /[^\s/]+\s*\/\s*(.+?)\s+Müdürlüğü/i.exec(lineStr);
          if (okulMatch) {
            okulAdi  = okulMatch[1].trim();
            okulSlug = okulSlugOlustur(okulAdi);
          }
        }

        // Özel eğitim sınıfı başlığı tespiti — YALNıZCA gerçek özel eğitim türlerinde eşleşir.
        // "İmam Hatip" gibi okul türleri bu regex'e takılmaz.
        const OZEL_EGITIM_KEYWORDS = /hafif\s+zihinsel|orta\s+d[ü]zeyde?\s+zihinsel|a[gğ][ıi]r\s+d[ü]zeyde?\s+zihinsel|otistik|i[sş]itme\s+(engel|bozuklu)|görme\s+(engel|bozuklu)|bedensel\s+engel|dil\s+ve\s+konu[ş]ma/i;
        const ozelSinifMatch = /\d+\.?\s*S[\u0131i]n[\u0131i]f[-–]\s*(.+?)\s*\/\s*[A-ZÇĞİÖŞÜ]\s*[Şş]ubesi/i.exec(lineStr);
        if (ozelSinifMatch && OZEL_EGITIM_KEYWORDS.test(ozelSinifMatch[1])) {
          currentClass  = "Özel Eğitim";
          currentBranch = ozelEgitimTurNormalize(ozelSinifMatch[1].trim());
        } else {
          // Normal sınıf bilgisini bul — "Özel Eğitim" olmayan "X. Sınıf-... / A Şubesi" satırları da buraya girer
          const cMatch = /(\d+)\.?\s*S[\u0131i]n[\u0131i]f/i.exec(lineStr);
          if (cMatch) currentClass = cMatch[1];

          // Şube bilgisini bul (örn: "A Şubesi")
          const bMatch = /([A-ZÇĞİÖŞÜ])\s*[Şş]ubesi/i.exec(lineStr);
          if (bMatch) currentBranch = bMatch[1].toUpperCase();
        }

        // Öğrenci satırı: [SıraNo] [ÖğrenciNo] [Ad Soyad] [Erkek|Kız]
        const studentMatch = /(?:^|\s+)(\d+)\s+(\d{1,6})\s+(.+)\s+(Erkek|Kız)/i.exec(lineStr);

        if (studentMatch && currentClass && currentBranch) {
          const studentNo   = studentMatch[2];
          const adSoyadText = studentMatch[3].trim();

          // Ad ve Soyad ayrıştırması — son kelime Soyad
          const nameParts = adSoyadText.split(/\s+/);
          let soyad = '';
          let ad    = adSoyadText;

          if (nameParts.length > 1) {
            soyad = nameParts.pop() || '';
            ad    = nameParts.join(' ');
          }

          const key = `${currentClass}-${currentBranch}`;
          if (!parsedData[key]) parsedData[key] = [];

          parsedData[key].push({
            ogrenci_no: studentNo,
            ad:       ad.toUpperCase(),
            soyad:    soyad.toUpperCase(),
            sinif:    currentClass,
            sube:     currentBranch,
            cinsiyet: /erkek/i.test(studentMatch[4]) ? 'E' : 'K',
            kademe:   kademeHesapla(currentClass),
          });
        }
      }
    }

    // T.C./Okul No mükerrerliklerini temizle
    for (const key of Object.keys(parsedData)) {
      parsedData[key] = Array.from(new Map(parsedData[key].map(s => [s.ogrenci_no, s])).values());
    }

    if (Object.keys(parsedData).length === 0) {
      toast.hata("Bu PDF'den öğrenci verisi çıkarılamadı. e-Okul sınıf listesi PDF'i olduğundan emin olun.");
      sifirlaUploadZone();
      return;
    }

    // Algılanan okul bilgisini sakla (profil.okul_id varsa onu önce kullan)
    if (!okulSlug && profil?.okul_id) okulSlug = profil.okul_id;
    if (!okulSlug) okulSlug = 'okul-001';

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
  const siniflar = Object.keys(parsedData).sort();
  aktifSinif     = siniflar[0];

  // Özet bar
  const toplamOgr = Object.values(parsedData).reduce((s, a) => s + a.length, 0);
  document.getElementById("ozet-bar").innerHTML = `
    <span class="ozet-item"><strong>${siniflar.length}</strong> Sınıf</span>
    <span class="ozet-item"><strong>${toplamOgr}</strong> Öğrenci</span>
    ${siniflar.map(s =>
      `<span class="ozet-item"><strong>${s}</strong>: ${parsedData[s].length} öğrenci</span>`
    ).join("")}
  `;

  // Sınıf sekmeleri
  const tabsEl = document.getElementById("sinif-tabs");
  tabsEl.innerHTML = siniflar.map(s =>
    `<button class="sinif-tab ${s === aktifSinif ? "aktif" : ""}" data-sinif="${s}">${s}</button>`
  ).join("");

  tabsEl.querySelectorAll(".sinif-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      tabsEl.querySelectorAll(".sinif-tab").forEach(b => b.classList.remove("aktif"));
      btn.classList.add("aktif");
      aktifSinif = btn.dataset.sinif;
      tabloRenderla(aktifSinif);
    });
  });

  tabloRenderla(aktifSinif);
}

function tabloRenderla(sinif) {
  const liste = parsedData[sinif] || [];
  const tbody = document.getElementById("onizleme-tbody");

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="tablo-bos">Bu sınıfta öğrenci bulunamadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = liste.map((o, i) => `
    <tr>
      <td style="color:var(--neutral-400)">${i + 1}</td>
      <td><strong>${o.ogrenci_no}</strong></td>
      <td>${o.ad}</td>
      <td>${o.soyad}</td>
      <td>${o.cinsiyet === 'E' ? 'Erkek' : 'Kız'}</td>
      <td><span class="badge badge-neutral">${o.sinif}-${o.sube}</span></td>
    </tr>
  `).join("");
}

// Firestore işlemini belirli süre içinde tamamlamazsa hata fırlatır
function zamanAsimi(promise, ms = 30000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Firestore yanıt vermedi (${ms / 1000}s). İnternet bağlantısını ve Firestore güvenlik kurallarını kontrol edin.`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// ============================================================
// Firestore'a Yükle
// ============================================================
async function firestoreYukle() {
  const siniflar   = Object.keys(parsedData).sort();
  const yukleBtn   = document.getElementById("yukle-btn");
  const progressWrap = document.getElementById("progress-wrap");
  const progressBar  = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");

  yukleBtn.disabled    = true;
  yukleBtn.textContent = "Yükleniyor...";
  progressWrap.classList.remove("hidden");
  progressText.classList.remove("hidden");

  let tamamlanan  = 0;
  let toplamEklenen = 0;
  let toplamAtlanan = 0;
  const toplam   = siniflar.length;
  // School admin için profil.okul_id sabit; superadmin için PDF'den algılanan slug kullanılır
  const hedefProfil = window.__okulCtx || {};
  const hedefOkulId = (hedefProfil.role === 'superadmin' && okulSlug)
    ? okulSlug
    : (hedefProfil.okul_id || okulSlug || 'okul-001');
  const hedefOkulAdi = okulAdi || hedefOkulId;

  try {
    for (const sinif of siniflar) {
      const liste = parsedData[sinif];
      progressText.textContent = `${sinif} yükleniyor... (${tamamlanan + 1}/${toplam})`;

      const sonuc = await zamanAsimi(topluOgrenciYukle(liste, hedefOkulId));
      toplamEklenen += sonuc?.eklenen ?? liste.length;
      toplamAtlanan += sonuc?.atlanan ?? 0;

      tamamlanan++;
      progressBar.style.width = `${Math.round((tamamlanan / toplam) * 100)}%`;
    }

    const atlananMetin = toplamAtlanan > 0 ? `, ${toplamAtlanan} öğrenci zaten kayıtlıydı (atlandı)` : '';
    progressText.textContent = `✅ ${toplam} sınıf: Toplam ${toplamEklenen} öğrenci eklendi${atlananMetin}.`;
    progressBar.style.background = "var(--success)";
    const okulBilgisi = hedefOkulAdi ? ` (${hedefOkulAdi})` : '';
    toast.basari(`Öğrenci listesi Firestore'a yüklendi${okulBilgisi}!`);

    // Okulu /okullar koleksiyonuna kaydet (özel eğitim vb. için de önemli)
    try { await okulKaydet(hedefOkulId, hedefOkulAdi); } catch(_) {}

    yukleBtn.textContent = "✅ Yüklendi";
    yukleBtn.style.background = "var(--success)";

    // 2 saniye sonra panele dön
    setTimeout(() => {
      window.location.href = "../dashboard/index.html";
    }, 2500);

  } catch (e) {
    console.error("[Firestore Yükleme Hatası]", e);
    const mesaj = e?.message || e?.code || JSON.stringify(e) || "Bilinmeyen hata";
    toast.hata("Yükleme hatası: " + mesaj);
    yukleBtn.disabled    = false;
    yukleBtn.textContent = "☁️ Firestore'a Yükle";
    progressText.textContent = `❌ Hata: ${mesaj}`;
  }
}
