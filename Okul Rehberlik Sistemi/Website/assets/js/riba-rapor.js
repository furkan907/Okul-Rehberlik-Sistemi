// ============================================================
// pages/riba-rapor/riba-rapor.js
// RİBA anket sonuçları raporlama ekranı (admin-only).
// ============================================================

import { adminKoruması }          from "./auth-guard.js";
import { cikisYap }               from "./auth.service.js";
import { tumOgrencileriGetir,
         tumOkullariGetir,
         okulBilgileriniGetir,
         okulImzaBilgileriniKaydet,
         ogrenciNoGetir }    from "./students.service.js";
import { tumRibaYanitlariniGetir,
         ribaIstatistikHesapla }  from "./riba.service.js";
import { toast }                  from "./toast.js";
import { RIBA_SORULAR }           from "./riba-sorular.js";

// ---------- Uygulama durumu ----------
let secilenTur    = "ogrenci";
let tumYanitlar   = [];
let tumOgrenciler = [];
let siniflar      = [];
let mevcutKademeler = [];
let ogrenciIdMap = new Map();
let ogrenciNoMap = new Map();
let ogrenciAnahtarMap = new Map();
let aktifOkulBilgileri = {
  okul_adi: "",
  rehber_ogretmeni_adi: "",
  okul_muduru_adi: "",
};

function sinifKademeBelirle(sinif) {
  const sinifNo = parseInt(sinif, 10);
  if (!Number.isNaN(sinifNo)) {
    return (sinifNo >= 9 && sinifNo <= 12) ? "lise" : "ortaokul";
  }
  if ((sinif || "").toLocaleLowerCase("tr").includes("özel eğitim")) {
    return "ortaokul";
  }
  return null;
}

function sinifSirala(a, b) {
  const [sinifA, subeA = ""] = a.split("-");
  const [sinifB, subeB = ""] = b.split("-");
  const noA = parseInt(sinifA, 10);
  const noB = parseInt(sinifB, 10);

  if (!Number.isNaN(noA) && !Number.isNaN(noB) && noA !== noB) {
    return noA - noB;
  }
  if (!Number.isNaN(noA) && Number.isNaN(noB)) return -1;
  if (Number.isNaN(noA) && !Number.isNaN(noB)) return 1;

  const sinifKarsilastir = sinifA.localeCompare(sinifB, "tr", { numeric: true, sensitivity: "base" });
  if (sinifKarsilastir !== 0) return sinifKarsilastir;
  return subeA.localeCompare(subeB, "tr", { numeric: true, sensitivity: "base" });
}

function filtrelenmisSiniflariGetir() {
  const seciliKademe = document.getElementById("filtre-kademe")?.value || "";
  if (!seciliKademe) return siniflar;

  return siniflar.filter(sinifSube => {
    const [sinif] = sinifSube.split("-");
    return sinifKademeBelirle(sinif) === seciliKademe;
  });
}

function sinifSecenekleriniDoldur() {
  const sinifSelect = document.getElementById("filtre-sinif");
  if (!sinifSelect) return;

  const oncekiDeger = sinifSelect.value;
  const gosterilecekSiniflar = filtrelenmisSiniflariGetir();
  sinifSelect.innerHTML = '<option value="">Tüm Sınıflar</option>' +
    gosterilecekSiniflar.map(s => `<option value="${s}">${s}</option>`).join("");

  if (gosterilecekSiniflar.includes(oncekiDeger)) {
    sinifSelect.value = oncekiDeger;
  }
}

function filtreGorunumunuGuncelle() {
  const sinifSelect = document.getElementById("filtre-sinif");
  if (!sinifSelect) return;

  const sinifGoster = secilenTur !== "ogretmen";
  sinifSelect.style.display = sinifGoster ? "" : "none";
  sinifSelect.disabled = !sinifGoster;

  if (!sinifGoster) {
    sinifSelect.value = "";
  }
}

function ogrenciHaritalariniHazirla() {
  ogrenciIdMap = new Map();
  ogrenciNoMap = new Map();
  ogrenciAnahtarMap = new Map();

  tumOgrenciler.forEach(ogrenci => {
    if (ogrenci?.id) ogrenciIdMap.set(ogrenci.id, ogrenci);
    const ogrenciNo = ogrenciNoGetir(ogrenci);
    if (ogrenciNo) ogrenciNoMap.set(ogrenciNo, ogrenci);
    const ogrenciAnahtari = [ogrenci?.kademe || sinifKademeBelirle(ogrenci?.sinif) || "", ogrenci?.sinif || "", ogrenci?.sube || "", ogrenciNo]
      .map(value => String(value || "").trim())
      .join("__");
    if (ogrenciNo) ogrenciAnahtarMap.set(ogrenciAnahtari, ogrenci);
  });
}

function yanittanOgrenciAnahtariGetir(yanit) {
  if (!yanit) return "";
  if (yanit.kademe && yanit.sinif && yanit.sube && yanit.ogrenci_no) {
    return [yanit.kademe, yanit.sinif, yanit.sube, yanit.ogrenci_no]
      .map(value => String(value || "").trim())
      .join("__");
  }
  return String(yanit.ogrenci_anahtari || "").trim();
}

function yanitEslesenOgrenciGetir(yanit) {
  if (!yanit) return null;
  const ogrenciAnahtari = yanittanOgrenciAnahtariGetir(yanit);
  if (ogrenciAnahtari && ogrenciAnahtarMap.has(ogrenciAnahtari)) {
    return ogrenciAnahtarMap.get(ogrenciAnahtari);
  }
  if (yanit.ogrenci_id && ogrenciIdMap.has(yanit.ogrenci_id)) {
    return ogrenciIdMap.get(yanit.ogrenci_id);
  }

  const ogrenciNo = String(yanit.ogrenci_no || "").trim();
  if (ogrenciNo && ogrenciNoMap.has(ogrenciNo)) {
    return ogrenciNoMap.get(ogrenciNo);
  }

  return null;
}

const OKUL_ORTAOKUL_HEDEFLERI = [
  { no: 1, label: "Problem Çözme Becerileri" },
  { no: 2, label: "Öz Düzenlemeli Öğrenme" },
  { no: 3, label: "Karar Verme Becerisi" },
  { no: 4, label: "Motivasyon/Devamsızlığı Önleme" },
  { no: 5, label: "Sosyal Beceriler" },
  { no: 6, label: "Üst Öğrenime Geçiş Sınavları" },
  { no: 7, label: "Okul ve Çevresindeki Sosyokültürel İmkanlar" },
  { no: 8, label: "Atılganlık" },
  { no: 9, label: "Yardım Arama" },
  { no: 10, label: "Öz Disiplin Geliştirme" },
  { no: 11, label: "Duygu Düzenleme" },
  { no: 12, label: "Bilinçli Teknoloji Kullanımı" },
  { no: 13, label: "Zaman Yönetimi/Öz Düzenlemeli Öğrenme" },
  { no: 14, label: "Gelişim Dönemi Özellikleri" },
  { no: 15, label: "Hak ve Sorumluluklarını Bilme" },
  { no: 16, label: "Meslek ile İlgi, Değer, Yetenek ve Kişisel Özellik (1)", aliases: ["Meslek ile İlgi, Değer, Yetenek ve Kişisel Özellik İlişkisi (1)"] },
  { no: 17, label: "Üst Öğrenim Kurumlarının Tanıtılması" },
  { no: 18, label: "Psikolojik Sağlamlık" },
  { no: 19, label: "Dikkat Geliştirme Çalışmaları" },
  { no: 20, label: "Bağımlılıkla Mücadele" },
  { no: 21, label: "İletişim Becerileri (1)" },
  { no: 22, label: "Mesleki Benlik" },
  { no: 23, label: "Çatışma Çözme Becerileri" },
  { no: 24, label: "Bireysel Farklılıklara Saygı" },
  { no: 25, label: "Aile İçi İletişim" },
  { no: 26, label: "Öfke Yönetimi" },
  { no: 27, label: "Sınır Koyma" },
  { no: 28, label: "Okula ve Çevreye Uyum/Okul Kuralları", aliases: ["Okula ve Çevreye Uyum/Okul kuralları"] },
  { no: 29, label: "İletişim Becerileri (2)" },
  { no: 30, label: "Rehberlik ve Psikolojik Danışma Servisinin Tanıtılması" },
  { no: 31, label: "Özgüven Geliştirme" },
  { no: 32, label: "Okul ve Çevresindeki Sosyokültürel İmkanlar" },
  { no: 33, label: "Meslek ile İlgi, Değer, Yetenek ve Kişisel Özellik (2)", aliases: ["Meslek ile İlgi, Değer, Yetenek ve Kişisel Özellik İlişkisi (2)"] },
  { no: 34, label: "Sınav Kaygısı" },
  { no: 35, label: "İhmal ve İstismardan Korunma" },
  { no: 36, label: "Yaşam Becerileri" },
  { no: 37, label: "Sağlıklı Yaşam" },
  { no: 38, label: "Akran Zorbalığı" },
  { no: 39, label: "Duygu Farkındalığı/Duygu Düzenleme" },
];

const OKUL_LISE_HEDEFLERI = [
  { no: 1, label: "Atılganlık" },
  { no: 2, label: "Verimli Ders Çalışma Teknikleri/Öz Düzenlemeli Öğrenme" },
  { no: 3, label: "Stresle Baş Etme Becerileri" },
  { no: 4, label: "Karar Verme Becerisi" },
  { no: 5, label: "Psikolojik Sağlamlık" },
  { no: 6, label: "Sınır Koyma" },
  { no: 7, label: "Meslek ile İlgi, Değer, Yetenek ve Kişisel Özellik İlişkisi (1)", aliases: ["Meslek ile İlgi, Değer, Yetenek ve Kişisel Özellik (1)"] },
  { no: 8, label: "Okula ve Çevreye Uyum/Okul kuralları", aliases: ["Okula ve Çevreye Uyum/Okul Kuralları"] },
  { no: 9, label: "Gelişim Dönemi Özellikleri (1)" },
  { no: 10, label: "İletişim Becerileri (1)" },
  { no: 11, label: "Otokontrol" },
  { no: 12, label: "Gelişim Dönemi Özellikleri (2)" },
  { no: 13, label: "İhmal ve İstismardan Korunma" },
  { no: 14, label: "Üst Öğrenim Kurumlarının Tanıtılması" },
  { no: 15, label: "Üst Öğrenime Geçiş Sınavları" },
  { no: 16, label: "Bilinçli Teknoloji Kullanımı (1)" },
  { no: 17, label: "İletişim Becerileri (2)" },
  { no: 18, label: "Mesleki Hedef Belirleme" },
  { no: 19, label: "Aile İçi İletişim" },
  { no: 20, label: "Meslek Tanıtımı" },
  { no: 21, label: "Meslek Seçerken Dikkat Edilmesi Gereken Hususlar" },
  { no: 22, label: "Yardım Arama" },
  { no: 23, label: "Öfke Yönetimi" },
  { no: 24, label: "Rehberlik ve Psikolojik Danışma Servisinin Tanıtılması" },
  { no: 25, label: "Duygu Düzenleme" },
  { no: 26, label: "Bağımlılıkla Mücadele" },
  { no: 27, label: "Çatışma Çözme Becerileri/Atılganlık" },
  { no: 28, label: "Okul ve Çevresindeki Sosyokültürel İmkanlar (1)" },
  { no: 29, label: "Sağlıklı Yaşam" },
  { no: 30, label: "Meslek ile İlgi, Değer, Yetenek ve Kişisel Özellik İlişkisi (2)", aliases: ["Meslek ile İlgi, Değer, Yetenek ve Kişisel Özellik (2)"] },
  { no: 31, label: "Meslek ile İlgi, Değer, Yetenek ve Kişisel Özellik İlişkisi (3)" },
  { no: 32, label: "Bireysel Farklılıklara Saygı" },
  { no: 33, label: "Bilinçli Teknoloji Kullanımı (2)" },
  { no: 34, label: "Özgüven Geliştirme" },
  { no: 35, label: "Zaman Yönetimi/ Öz Düzenlemeli Öğrenme", aliases: ["Zaman Yönetimi/Öz Düzenlemeli Öğrenme"] },
  { no: 36, label: "Okul ve Çevresindeki Sosyokültürel İmkanlar (2)" },
  { no: 37, label: "Sınav Kaygısı" },
  { no: 38, label: "Akran Zorbalığı" },
  { no: 39, label: "Motivasyon/Devamsızlığı önleme", aliases: ["Motivasyon/Devamsızlığı Önleme"] },
  { no: 40, label: "Okulda Seçilecek Alan/Dal" },
];

// ---------- Giriş koruması ----------
adminKoruması(async (user, profil) => {
  document.getElementById("user-email").textContent = user.email;

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await cikisYap();
    window.location.href = "../login/index.html";
  });

  if (profil?.okul_adi) {
    okulBasliginiGuncelle(profil.okul_adi);
  }

  kurOkulImzaPaneli(profil);

  // Superadmin: okul seçici göster, seçili okula göre veri yükle
  if (profil.role === "superadmin") {
    await kurOkulSecici();
  }

  await okulBilgileriniYukle();

  await verileriYukle();
  kurSekmeler();
  kurFiltreler();
  kurExport();
  filtreGorunumunuGuncelle();
  raporuRenderla();
});

function okulBasliginiGuncelle(okulAdi) {
  const sub = document.querySelector(".dash-brand-sub");
  if (sub && okulAdi) sub.textContent = okulAdi;

  const badge = document.getElementById("okul-imza-okul-adi");
  if (badge) {
    badge.textContent = okulAdi || window.__okulCtx?.okul_id || "Okul bilgisi yok";
  }
}

function kurOkulImzaPaneli(profil) {
  const kaydetBtn = document.getElementById("okul-imza-kaydet-btn");
  if (!kaydetBtn || kaydetBtn.dataset.bound === "true") return;

  const duzenlenebilir = profil?.role === "admin" || profil?.role === "superadmin";
  const rehberInput = document.getElementById("rehber-ogretmeni-input");
  const mudurInput = document.getElementById("okul-muduru-input");

  [rehberInput, mudurInput].forEach(input => {
    if (!input) return;
    input.disabled = !duzenlenebilir;
  });

  kaydetBtn.disabled = !duzenlenebilir;
  if (!duzenlenebilir) {
    kaydetBtn.textContent = "Sadece yönetici düzenleyebilir";
    return;
  }

  kaydetBtn.dataset.bound = "true";
  kaydetBtn.addEventListener("click", async () => {
    const okulId = window.__okulCtx?.okul_id;
    const rehberOgretmeniAdi = rehberInput?.value.trim() || "";
    const okulMuduruAdi = mudurInput?.value.trim() || "";

    if (!okulId) {
      toast.hata("Aktif okul bulunamadı.");
      return;
    }

    const orijinalYazi = kaydetBtn.textContent;
    kaydetBtn.disabled = true;
    kaydetBtn.textContent = "Kaydediliyor...";

    try {
      await okulImzaBilgileriniKaydet(okulId, {
        rehber_ogretmeni_adi: rehberOgretmeniAdi,
        okul_muduru_adi: okulMuduruAdi,
      });

      aktifOkulBilgileri = {
        ...aktifOkulBilgileri,
        rehber_ogretmeni_adi: rehberOgretmeniAdi,
        okul_muduru_adi: okulMuduruAdi,
      };

      toast.basari("Excel imza bilgileri kaydedildi.");
    } catch (error) {
      console.error("Okul imza bilgileri kaydedilemedi:", error);
      toast.hata(error.message || "İmza bilgileri kaydedilemedi.");
    } finally {
      kaydetBtn.disabled = false;
      kaydetBtn.textContent = orijinalYazi;
    }
  });
}

async function okulBilgileriniYukle() {
  const okulId = window.__okulCtx?.okul_id;
  if (!okulId) return;

  try {
    const bilgiler = await okulBilgileriniGetir(okulId);
    aktifOkulBilgileri = {
      okul_adi: bilgiler?.okul_adi || window.__okulCtx?.okul_adi || "",
      rehber_ogretmeni_adi: bilgiler?.rehber_ogretmeni_adi || "",
      okul_muduru_adi: bilgiler?.okul_muduru_adi || "",
    };

    if (aktifOkulBilgileri.okul_adi) {
      window.__okulCtx.okul_adi = aktifOkulBilgileri.okul_adi;
      okulBasliginiGuncelle(aktifOkulBilgileri.okul_adi);
    } else {
      okulBasliginiGuncelle(window.__okulCtx?.okul_adi || "");
    }

    const rehberInput = document.getElementById("rehber-ogretmeni-input");
    const mudurInput = document.getElementById("okul-muduru-input");
    if (rehberInput) rehberInput.value = aktifOkulBilgileri.rehber_ogretmeni_adi;
    if (mudurInput) mudurInput.value = aktifOkulBilgileri.okul_muduru_adi;
  } catch (error) {
    console.error("Okul bilgileri yüklenemedi:", error);
    toast.hata("Okul imza bilgileri yüklenemedi.");
  }
}

// ============================================================
// Okul Seçici (Superadmin)
// ============================================================
async function kurOkulSecici() {
  try {
    const okullar = await tumOkullariGetir();
    if (okullar.length === 0) return;

    // İlk okulu varsayılan olarak seç
    if (!window.__okulCtx.okul_id) {
      window.__okulCtx.okul_id = okullar[0].id;
    }

    const headerActions = document.querySelector(".dash-header-actions");
    const select = document.createElement("select");
    select.id = "okul-secici";
    select.style.cssText = "min-width:180px;max-width:260px;font-size:.85rem;padding:.35rem .75rem;border:1px solid var(--neutral-300);border-radius:8px;font-family:var(--font);cursor:pointer";

    okullar.forEach(okul => {
      const opt = document.createElement("option");
      opt.value = okul.id;
      opt.textContent = okul.okul_adi || okul.id;
      if (okul.id === window.__okulCtx.okul_id) opt.selected = true;
      select.appendChild(opt);
    });

    // "← Dashboard" linkinin önüne ekle
    const dashLink = headerActions.querySelector("a");
    headerActions.insertBefore(select, dashLink);

    // Okul adını header'da güncelle
    const ilk = okullar.find(o => o.id === window.__okulCtx.okul_id);
    if (ilk?.okul_adi) {
      window.__okulCtx.okul_adi = ilk.okul_adi;
      okulBasliginiGuncelle(ilk.okul_adi);
    }

    select.addEventListener("change", async () => {
      window.__okulCtx.okul_id = select.value;
      const secilen = okullar.find(o => o.id === select.value);
      window.__okulCtx.okul_adi = secilen?.okul_adi || "";
      okulBasliginiGuncelle(secilen?.okul_adi || select.value);
      await okulBilgileriniYukle();
      await verileriYukle();
      raporuRenderla();
    });
  } catch (e) {
    console.warn("Okul seçici yüklenemedi:", e);
  }
}

// ============================================================
// Veri Yükleme
// ============================================================
async function verileriYukle() {
  try {
    [tumYanitlar, tumOgrenciler] = await Promise.all([
      tumRibaYanitlariniGetir(),
      tumOgrencileriGetir(),
    ]);

    // Sınıf listesini oluştur
    siniflar = [...new Set(tumOgrenciler.map(o => `${o.sinif}-${o.sube}`))].sort(sinifSirala);

    const kademeSet = new Set();
    tumOgrenciler.forEach(o => {
      const nr = parseInt(o.sinif, 10);
      if (nr >= 5 && nr <= 8) kademeSet.add("ortaokul");
      if (nr >= 9 && nr <= 12) kademeSet.add("lise");
    });
    mevcutKademeler = Array.from(kademeSet);
    ogrenciHaritalariniHazirla();

    const kademeSelect = document.getElementById("filtre-kademe");
    let kademeHtml = "";
    if (mevcutKademeler.includes("ortaokul")) {
      kademeHtml += '<option value="ortaokul" selected>Ortaokul (5-8)</option>';
    }
    if (mevcutKademeler.includes("lise")) {
      kademeHtml += `<option value="lise"${mevcutKademeler.includes("ortaokul") ? "" : " selected"}>Lise (9-12)</option>`;
    }
    if (mevcutKademeler.length === 0) {
      kademeHtml = '<option value="">Kademe Bulunamadı</option>';
    }
    kademeSelect.innerHTML = kademeHtml;
    varsayilanKademeSec();
    sinifSecenekleriniDoldur();

  } catch (e) {
    toast.hata("Veriler yüklenemedi: " + e.message);
  }
}

// ============================================================
// Sekme Yönetimi
// ============================================================
function kurSekmeler() {
  document.getElementById("rapor-tabs").querySelectorAll(".rapor-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".rapor-tab").forEach(t => t.classList.remove("aktif"));
      tab.classList.add("aktif");
      secilenTur = tab.dataset.tur;
      // Sınıf ve kademe filtresini sıfırla
      document.getElementById("filtre-sinif").value   = "";
      varsayilanKademeSec();
      filtreGorunumunuGuncelle();
      raporuRenderla();
    });
  });
}

function varsayilanKademeSec() {
  const kademeSelect = document.getElementById("filtre-kademe");
  if (!kademeSelect) return;

  if (secilenTur === "okul" && mevcutKademeler.includes("ortaokul")) {
    kademeSelect.value = "ortaokul";
    return;
  }

  if (mevcutKademeler.includes("ortaokul")) {
    kademeSelect.value = "ortaokul";
    return;
  }

  if (mevcutKademeler.includes("lise")) {
    kademeSelect.value = "lise";
    return;
  }

  kademeSelect.value = "";
}

// ============================================================
// Filtreler
// ============================================================
function kurFiltreler() {
  document.getElementById("filtre-sinif").addEventListener("change", raporuRenderla);
  document.getElementById("filtre-kademe").addEventListener("change", () => {
    sinifSecenekleriniDoldur();
    raporuRenderla();
  });
}

function yanitZamaniGetir(yanit) {
  const tarih = yanit?.gonderim_tarihi?.toDate?.();
  return tarih instanceof Date ? tarih.getTime() : 0;
}

function yanitTekilAnahtariGetir(yanit) {
  if (yanit?.anket_turu === "ogrenci" || yanit?.anket_turu === "veli") {
    const ogrenciNo = String(yanit?.ogrenci_no || "").trim();
    if (ogrenciNo) return `${yanit.anket_turu}:no:${ogrenciNo}`;
    if (yanit?.ogrenci_id) return `${yanit.anket_turu}:id:${yanit.ogrenci_id}`;
  }
  return null;
}

function yanitlariTekillestir(yanitlar) {
  const tekilMap = new Map();
  const digerYanitlar = [];

  yanitlar.forEach((yanit, index) => {
    const anahtar = yanitTekilAnahtariGetir(yanit);
    if (!anahtar) {
      digerYanitlar.push(yanit);
      return;
    }

    const mevcut = tekilMap.get(anahtar);
    if (!mevcut) {
      tekilMap.set(anahtar, { yanit, index });
      return;
    }

    const mevcutZaman = yanitZamaniGetir(mevcut.yanit);
    const yeniZaman = yanitZamaniGetir(yanit);
    if (yeniZaman > mevcutZaman || (yeniZaman === mevcutZaman && index > mevcut.index)) {
      tekilMap.set(anahtar, { yanit, index });
    }
  });

  return [
    ...Array.from(tekilMap.values()).map(item => item.yanit),
    ...digerYanitlar,
  ];
}

// ============================================================
// Filtreli veri hesaplama
// ============================================================
function filtreliVeriHesapla() {
  const sinifFiltre  = secilenTur === "ogretmen" ? "" : document.getElementById("filtre-sinif").value;
  const seciliKademe = document.getElementById("filtre-kademe").value;
  const kadeFiltre   = secilenTur === "okul" ? (seciliKademe || "ortaokul") : seciliKademe;

  const sinifParts   = sinifFiltre ? sinifFiltre.split("-") : null;
  const filtreSinif  = sinifParts ? sinifParts[0] : null;
  const filtreSube   = sinifParts ? sinifParts[1] : null;

  // Yanıtları filtrele
  const hamYanitlar = tumYanitlar.filter(y => {
    if (secilenTur !== "okul" && y.anket_turu !== secilenTur) return false;
    if (secilenTur === "ogrenci" || secilenTur === "veli") {
      const ogrenci = yanitEslesenOgrenciGetir(y);
      if (!ogrenci) return false;
      if (filtreSinif && ogrenci.sinif !== filtreSinif) return false;
      if (filtreSube  && ogrenci.sube !== filtreSube)  return false;
      if (kadeFiltre) {
        const no = parseInt(ogrenci.sinif, 10);
        const kad = (no >= 9 && no <= 12) ? "lise" : "ortaokul";
        if (kad !== kadeFiltre) return false;
      }
      return true;
    }
    if (filtreSinif  && y.sinif !== filtreSinif) return false;
    if (filtreSube   && y.sube  !== filtreSube)  return false;
    if (kadeFiltre   && y.kademe !== kadeFiltre)  return false;
    return true;
  });
  const yanitlar = yanitlariTekillestir(hamYanitlar);

  // Öğrenci/Veli için tamamlanma sayıları
  let toplam    = 0;
  let dolduruldu = 0;
  let bekleyen  = 0;

  if (secilenTur === "okul") {
    return { yanitlar, sorular: [], toplam: 0, dolduruldu: 0, bekleyen: 0, kadeFiltre };
  }

  if (secilenTur !== "ogretmen") {
    const filtreliOgrenciler = tumOgrenciler.filter(o => {
      if (filtreSinif && o.sinif !== filtreSinif) return false;
      if (filtreSube  && o.sube  !== filtreSube)  return false;
      if (kadeFiltre) {
        const no = parseInt(o.sinif, 10);
        const kad = (no >= 9 && no <= 12) ? "lise" : "ortaokul";
        if (kad !== kadeFiltre) return false;
      }
      return true;
    });

    toplam     = filtreliOgrenciler.length;
    dolduruldu = yanitlar.length;
    bekleyen   = Math.max(0, toplam - dolduruldu);
  }

  // Sorular kümesi (filtreye göre kademe seç)
  // Eğer kademe filtresi yoksa her iki kademenin sorularını birleştir
  let sorular;
  if (kadeFiltre) {
    sorular = (RIBA_SORULAR[secilenTur] || {})[kadeFiltre] || [];
  } else {
    const ortaokul = (RIBA_SORULAR[secilenTur] || {}).ortaokul || [];
    const lise     = (RIBA_SORULAR[secilenTur] || {}).lise     || [];
    // Aynı id'li soruları birleştir (id eşleşirse tek soru)
    const soruMap  = new Map();
    [...ortaokul, ...lise].forEach(s => { if (!soruMap.has(s.id)) soruMap.set(s.id, s); });
    sorular = [...soruMap.values()];
  }

  return { yanitlar, sorular, toplam, dolduruldu, bekleyen, kadeFiltre };
}

// ============================================================
// Raporlama Render
// ============================================================
function raporuRenderla() {
  const { yanitlar, toplam, dolduruldu, bekleyen, kadeFiltre } = filtreliVeriHesapla();

  // İstatistik kartları
  renderIstatistikler(toplam, dolduruldu, bekleyen, yanitlar);

  // Öğretmen liste panelini göster/gizle
  document.getElementById("ogretmen-liste-wrap").style.display =
    secilenTur === "ogretmen" ? "block" : "none";

  const container = document.getElementById("kategori-tables-container");
  if (!container) return;
  container.innerHTML = "";

  if (secilenTur === "okul") {
    renderOkulKategoriTablosu(container, yanitlar, kadeFiltre || "ortaokul");
    return;
  }

  const turBasliklari = {
    ogrenci: "Öğrenci",
    veli: "Veli",
    ogretmen: "Öğretmen",
  };
  const turRenkleri = {
    ogrenci: ["#eaf6fc", "#ffffff"],
    veli: ["#fff9db", "#ffffff"],
    ogretmen: ["#fdecec", "#ffffff"],
  };

  const kademeler = kadeFiltre ? [kadeFiltre] : (mevcutKademeler.length ? mevcutKademeler : ["ortaokul", "lise"]);

  kademeler.forEach(kademe => {
    const ozelSorular = (RIBA_SORULAR[secilenTur] || {})[kademe] || [];
    if (ozelSorular.length === 0) return;

    const kademeYanitlari = yanitlar.filter(y => y.kademe === kademe);
    const toplamYanit = kademeYanitlari.length;
    
    const istatistikler = ribaIstatistikHesapla(kademeYanitlari, ozelSorular);
    const satirRenkleri = turRenkleri[secilenTur] || turRenkleri.ogrenci;

    const satirlar = istatistikler.map((s, index) => {
      const aSayi = s.a_sayi || 0;
      const bSayi = s.b_sayi || 0;
      const aPct = toplamYanit > 0 ? parseFloat(((aSayi / toplamYanit) * 100).toFixed(2)) : 0;
      const bPct = toplamYanit > 0 ? parseFloat(((bSayi / toplamYanit) * 100).toFixed(2)) : 0;

      const bgColor = satirRenkleri[index % 2];

      return `
        <tbody class="kategori-grup" style="--grup-bg:${bgColor}">
          <tr>
            <td rowspan="2" style="font-weight:700;text-align:center;vertical-align:middle;color:var(--neutral-400)">${index + 1}</td>
            <td>${s.a_kategori}</td>
            <td style="text-align:center">${aSayi}</td>
            <td style="text-align:center">%${aPct}</td>
          </tr>
          <tr>
            <td>${s.b_kategori}</td>
            <td style="text-align:center">${bSayi}</td>
            <td style="text-align:center">%${bPct}</td>
          </tr>
        </tbody>
      `;
    }).join("");

    const kademeBaslik = kademe === "ortaokul" ? "Ortaokul" : "Lise";
    const turBaslik = turBasliklari[secilenTur] || "Öğrenci";
    
    const div = document.createElement("div");
    div.innerHTML = `
      <h3 style="margin-bottom:.75rem;font-size:.95rem">Kategori Dağılımı (${kademeBaslik} ${turBaslik})</h3>
      <div class="rapor-tablo-wrap" style="margin-bottom:1.5rem">
        <table class="rapor-tablo kategori-tablo">
          <thead>
            <tr>
              <th style="width:50px;text-align:center">S</th>
              <th>HEDEFLER</th>
              <th style="width:140px;text-align:center">SEÇİLME SAYISI</th>
              <th style="width:100px;text-align:center">ORAN</th>
            </tr>
          </thead>
          ${satirlar}
        </table>
      </div>
    `;
    container.appendChild(div);

    // Satır arkaplanlarını doğrudan uygula (CSS çakışmasını önlemek için)
    // tbody'ye de backgroundColor set ediyoruz; hover'da "inherit" tbody'den alır → renk değişmez
    div.querySelectorAll("tbody.kategori-grup").forEach(tbody => {
      const bgColor = tbody.style.getPropertyValue("--grup-bg") || "#fff";
      tbody.style.backgroundColor = bgColor;
      tbody.querySelectorAll("tr").forEach(tr => {
        tr.style.backgroundColor = bgColor;
      });
    });
  });

  if (secilenTur === "ogretmen") {
    renderOgretmenListesi(yanitlar);
  }
}

function renderIstatistikler(toplam, dolduruldu, bekleyen, yanitSayisi) {
  const grid = document.getElementById("istat-grid");

  if (secilenTur === "okul") {
    const ogrenciYanit = yanitSayisi.filter(y => y.anket_turu === "ogrenci").length;
    const veliYanit = yanitSayisi.filter(y => y.anket_turu === "veli").length;
    const ogretmenYanit = yanitSayisi.filter(y => y.anket_turu === "ogretmen").length;

    grid.innerHTML = `
      <div class="istat-kart">
        <div class="istat-sayi" style="color:var(--neutral-700)">${yanitSayisi.length}</div>
        <div class="istat-etiket">Toplam Yanıt</div>
      </div>
      <div class="istat-kart">
        <div class="istat-sayi" style="color:var(--primary)">${ogrenciYanit}</div>
        <div class="istat-etiket">Öğrenci Yanıtı</div>
      </div>
      <div class="istat-kart">
        <div class="istat-sayi" style="color:#b58900">${veliYanit}</div>
        <div class="istat-etiket">Veli Yanıtı</div>
      </div>
      <div class="istat-kart">
        <div class="istat-sayi" style="color:#c45b5b">${ogretmenYanit}</div>
        <div class="istat-etiket">Öğretmen Yanıtı</div>
      </div>
    `;
    return;
  }

  if (secilenTur === "ogretmen") {
    grid.innerHTML = `
      <div class="istat-kart">
        <div class="istat-sayi" style="color:var(--primary)">${yanitSayisi.length}</div>
        <div class="istat-etiket">Toplam Yanıt</div>
      </div>
    `;
    return;
  }

  const oran = toplam > 0 ? parseFloat(((dolduruldu / toplam) * 100).toFixed(2)) : 0;
  const toplamEtiketi = secilenTur === "veli" ? "Toplam Veli" : "Toplam Öğrenci";
  grid.innerHTML = `
    <div class="istat-kart">
      <div class="istat-sayi" style="color:var(--neutral-700)">${toplam}</div>
      <div class="istat-etiket">${toplamEtiketi}</div>
    </div>
    <div class="istat-kart">
      <div class="istat-sayi" style="color:var(--success)">${dolduruldu}</div>
      <div class="istat-etiket">Anket Dolduruldu</div>
    </div>
    <div class="istat-kart">
      <div class="istat-sayi" style="color:var(--warning)">${bekleyen}</div>
      <div class="istat-etiket">Bekliyor</div>
    </div>
    <div class="istat-kart">
      <div class="istat-sayi" style="color:var(--primary)">${oran}%</div>
      <div class="istat-etiket">Tamamlanma Oranı</div>
    </div>
  `;
}

function renderOkulKategoriTablosu(container, yanitlar, kademe) {
  const ayar = okulTabloAyarlariGetir()[kademe];
  if (!ayar) {
    container.innerHTML = '<div class="tablo-bos">Bu kademe için okul sekmesi yapılandırılmadı.</div>';
    return;
  }
  const hedefOzetleri = okulHedefOzetleriniHesapla(yanitlar, kademe);

  const satirlar = hedefOzetleri.map((hedef, index) => {
    const bgColor = ayar.renkler[index % 2];

    return `
      <tbody class="kategori-grup" style="--grup-bg:${bgColor}">
        <tr>
          <td style="font-weight:700;text-align:center;vertical-align:middle;color:var(--neutral-400)">${hedef.no}</td>
          <td>${hedef.label}</td>
          <td style="text-align:center">${hedef.secilmeSayisi}</td>
          <td style="text-align:center">%${hedef.oran}</td>
        </tr>
      </tbody>
    `;
  }).join("");

  const div = document.createElement("div");
  div.innerHTML = `
    <h3 style="margin-bottom:.75rem;font-size:.95rem">Kategori Dağılımı (${ayar.baslik})</h3>
    <div class="rapor-tablo-wrap" style="margin-bottom:1.5rem">
      <table class="rapor-tablo kategori-tablo">
        <thead>
          <tr>
            <th style="width:50px;text-align:center">H</th>
            <th>HEDEFLER</th>
            <th style="width:140px;text-align:center">SEÇİLME SAYISI</th>
            <th style="width:100px;text-align:center">ORAN</th>
          </tr>
        </thead>
        ${satirlar}
      </table>
    </div>
  `;
  container.appendChild(div);

  div.querySelectorAll("tbody.kategori-grup").forEach(tbody => {
    const bgColor = tbody.style.getPropertyValue("--grup-bg") || "#fff";
    tbody.style.backgroundColor = bgColor;
    tbody.querySelectorAll("tr").forEach(tr => {
      tr.style.backgroundColor = bgColor;
    });
  });
}

function yanitSayisiUzdesi(sayi, toplam) {
  if (toplam <= 0) return 0;
  return parseFloat(((sayi / toplam) * 100).toFixed(2));
}

function okulTabloAyarlariGetir() {
  return {
    ortaokul: {
      baslik: "Ortaokul Tümü",
      hedefler: OKUL_ORTAOKUL_HEDEFLERI,
      renkler: ["#f8dede", "#ffffff"],
    },
    lise: {
      baslik: "Lise Tümü",
      hedefler: OKUL_LISE_HEDEFLERI,
      renkler: ["#f6d6d6", "#ffffff"],
    },
  };
}

function kategoriAdiNormalizeEt(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ilişkisi/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function okulHedefOzetleriniHesapla(yanitlar, kademe) {
  const ayar = okulTabloAyarlariGetir()[kademe];
  if (!ayar) return [];

  return ayar.hedefler.map(hedef => {
    const eslesmeler = new Set(
      [hedef.label, ...(hedef.aliases || [])].map(kategoriAdiNormalizeEt)
    );

    const secilmeSayisi = yanitlar.filter(yanit => {
      const secilenler = new Set(
        (yanit.secilen_kategoriler || []).map(kategoriAdiNormalizeEt)
      );
      return [...eslesmeler].some(etiket => secilenler.has(etiket));
    }).length;

    return {
      no: hedef.no,
      label: hedef.label,
      secilmeSayisi,
      oran: yanitSayisiUzdesi(secilmeSayisi, yanitlar.length),
    };
  });
}

function renderOgretmenListesi(yanitlar) {
  const tbody = document.getElementById("ogretmen-tbody");
  if (yanitlar.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="tablo-bos">Henüz yanıt bulunmuyor.</td></tr>`;
    return;
  }

  tbody.innerHTML = yanitlar
    .sort((a, b) => {
      const aT = a.gonderim_tarihi?.toDate?.() || new Date(0);
      const bT = b.gonderim_tarihi?.toDate?.() || new Date(0);
      return bT - aT;
    })
    .map(y => {
      const tarih = y.gonderim_tarihi?.toDate?.()
        ? new Date(y.gonderim_tarihi.toDate()).toLocaleDateString("tr-TR")
        : "—";
      return `
        <tr class="ogretmen-satir">
          <td>${y.ogretmen_ad_soyad || "—"}</td>
          <td>${y.ogretmen_brans || "—"}</td>
          <td>${y.sinif && y.sube ? `${y.sinif}/${y.sube}` : "Okul Geneli"}</td>
          <td>${y.kademe === "lise" ? "Lise" : "Ortaokul"}</td>
          <td>${tarih}</td>
        </tr>
      `;
    }).join("");
}

// ============================================================
// Excel Export
// ============================================================
function kurExport() {
  const tplBtn = document.getElementById("export-template-btn");
  if (tplBtn) tplBtn.addEventListener("click", excelSablonIndir);
}

async function excelSablonIndir() {
  const btn = document.getElementById("export-template-btn");
  const orjText = btn.innerHTML;
  btn.innerHTML = "⌛ Hazırlanıyor...";
  btn.disabled = true;

  try {
    const kadeFiltre = document.getElementById("filtre-kademe").value || "ortaokul";
    const templatePath = new URL(`../../tools/Templates/riba_${kadeFiltre}_template.xlsx`, import.meta.url).href;

    const response = await fetch(templatePath);
    if (!response.ok) throw new Error(`Şablon bulunamadı: ${templatePath}`);

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const okulAdi = (
      aktifOkulBilgileri.okul_adi ||
      document.querySelector(".dash-brand-sub")?.textContent ||
      "Okul Adı Yok"
    )
      .trim()
      .toLocaleUpperCase("tr-TR");
    const rehberOgretmeniAdi = (aktifOkulBilgileri.rehber_ogretmeni_adi || "").trim();
    const okulMuduruAdi = (aktifOkulBilgileri.okul_muduru_adi || "").trim();
    const sinifFiltre = secilenTur === "ogretmen" ? "" : document.getElementById("filtre-sinif").value;
    const sinifParts = sinifFiltre ? sinifFiltre.split("-") : null;
    const filtreSinif = sinifParts ? sinifParts[0] : null;
    const filtreSube = sinifParts ? sinifParts[1] : null;

    const turler = ["ogrenci", "veli", "ogretmen"];
    // JSZip'te worksheet dosyaları xl/worksheets/sheet1.xml, sheet2.xml, sheet3.xml olarak bulunur
    for (let sheetIdx = 0; sheetIdx < 3; sheetIdx++) {
      const tur = turler[sheetIdx];
      const sheetFile = `xl/worksheets/sheet${sheetIdx + 1}.xml`;
      let sheetXml;
      try {
        sheetXml = await zip.file(sheetFile).async("string");
      } catch (e) {
        continue; // sekme yoksa atla
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(sheetXml, "application/xml");
      const NS = doc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
      const allRows = Array.from(doc.getElementsByTagName("row"));

      const colIndex = (l) => { let x = 0; for (const ch of l) x = x * 26 + ch.charCodeAt(0) - 64; return x - 1; };

      // Hücre değerini güncelleme veya oluşturma fonksiyonu (JSZip DOM manipülasyonu)
      const setCellVal = (rNum, colLetter, val, isNum = true) => {
        const r = allRows.find(row => parseInt(row.getAttribute("r"), 10) === rNum);
        if (!r) return;
        const ref = `${colLetter}${rNum}`;
        let c = Array.from(r.getElementsByTagName("c")).find(cell => cell.getAttribute("r") === ref);
        
        if (!c) {
          c = doc.createElementNS(NS, "c");
          c.setAttribute("r", ref);
          const ci = colIndex(colLetter);
          const next = Array.from(r.getElementsByTagName("c"))
            .find(cell => colIndex((cell.getAttribute("r") || "A").replace(/\d+$/, "")) > ci);
          r.insertBefore(c, next || null);
        }

        while (c.firstChild) c.removeChild(c.firstChild);
        
        if (isNum) {
          c.removeAttribute("t");
          const v = doc.createElementNS(NS, "v");
          v.textContent = String(val);
          c.appendChild(v);
        } else {
          c.setAttribute("t", "inlineStr");
          const is = doc.createElementNS(NS, "is");
          const t = doc.createElementNS(NS, "t");
          t.textContent = String(val);
          is.appendChild(t);
          c.appendChild(is);
        }
      };

      // Sekme alt bilgi alanları: A44 okul adı, B44 rehber öğretmeni, C44 okul müdürü
      setCellVal(44, "A", okulAdi, false);
      setCellVal(44, "B", rehberOgretmeniAdi, false);
      setCellVal(44, "C", okulMuduruAdi, false);

      // Verileri hesapla (filtreleri al, turu override et)
      const yanitlar = yanitlariTekillestir(tumYanitlar.filter(y => {
        if (y.anket_turu !== tur) return false;
        if (filtreSinif && y.sinif !== filtreSinif) return false;
        if (filtreSube && y.sube !== filtreSube) return false;
        if (kadeFiltre && y.kademe !== kadeFiltre) return false;
        return true;
      }));

      let sorular = (RIBA_SORULAR[tur] || {})[kadeFiltre] || [];
      if (!kadeFiltre) {
        throw new Error("Şablon indirmek için lütfen bir kademe filtreleyin (Ortaokul veya Lise).");
      }
      const istatistikler = ribaIstatistikHesapla(yanitlar, sorular);
      const toplamYanit = yanitlar.length;

      // 3. satırdan başlayarak sonuçları yaz
      // C sütunu SAYI, D sütunu ORAN
      istatistikler.forEach((s, idx) => {
        const rowA = 3 + (idx * 2);
        const rowB = 4 + (idx * 2);

        const aPct = toplamYanit > 0 ? parseFloat(((s.a_sayi / toplamYanit) * 100).toFixed(2)) : 0;
        const bPct = toplamYanit > 0 ? parseFloat(((s.b_sayi / toplamYanit) * 100).toFixed(2)) : 0;

        setCellVal(rowA, "C", s.a_sayi, true);
        setCellVal(rowA, "D", aPct / 100, true); 

        setCellVal(rowB, "C", s.b_sayi, true);
        setCellVal(rowB, "D", bPct / 100, true);
      });

      let newXml = new XMLSerializer().serializeToString(doc);
      newXml = newXml.replace(/ xmlns=""/g, "");
      zip.file(sheetFile, newXml);
    }

    const sonucSheetFile = "xl/worksheets/sheet4.xml";
    const sonucSheetXml = await zip.file(sonucSheetFile).async("string");
    const parser = new DOMParser();
    const sonucDoc = parser.parseFromString(sonucSheetXml, "application/xml");
    const NS = sonucDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    const sonucRows = Array.from(sonucDoc.getElementsByTagName("row"));
    const okulOzetleri = okulHedefOzetleriniHesapla(
      yanitlariTekillestir(tumYanitlar.filter(y => {
        if (y.kademe !== kadeFiltre) return false;
        if (filtreSinif && y.sinif !== filtreSinif) return false;
        if (filtreSube && y.sube !== filtreSube) return false;
        return true;
      })),
      kadeFiltre
    );

    const colIndex = (l) => { let x = 0; for (const ch of l) x = x * 26 + ch.charCodeAt(0) - 64; return x - 1; };
    const setSonucCellVal = (rNum, colLetter, val, isNum = true) => {
      const r = sonucRows.find(row => parseInt(row.getAttribute("r"), 10) === rNum);
      if (!r) return;
      const ref = `${colLetter}${rNum}`;
      let c = Array.from(r.getElementsByTagName("c")).find(cell => cell.getAttribute("r") === ref);

      if (!c) {
        c = sonucDoc.createElementNS(NS, "c");
        c.setAttribute("r", ref);
        const ci = colIndex(colLetter);
        const next = Array.from(r.getElementsByTagName("c"))
          .find(cell => colIndex((cell.getAttribute("r") || "A").replace(/\d+$/, "")) > ci);
        r.insertBefore(c, next || null);
      }

      while (c.firstChild) c.removeChild(c.firstChild);

      if (isNum) {
        c.removeAttribute("t");
        const v = sonucDoc.createElementNS(NS, "v");
        v.textContent = String(val);
        c.appendChild(v);
      } else {
        c.setAttribute("t", "inlineStr");
        const is = sonucDoc.createElementNS(NS, "is");
        const t = sonucDoc.createElementNS(NS, "t");
        t.textContent = String(val);
        is.appendChild(t);
        c.appendChild(is);
      }
    };

    setSonucCellVal(1, "B", okulAdi, false);
    setSonucCellVal(44, "B", rehberOgretmeniAdi, false);
    setSonucCellVal(44, "C", okulMuduruAdi, false);
    okulOzetleri.forEach((hedef, idx) => {
      const rowNo = 3 + idx;
      setSonucCellVal(rowNo, "C", hedef.oran / 100, true);
    });

    let yeniSonucXml = new XMLSerializer().serializeToString(sonucDoc);
    yeniSonucXml = yeniSonucXml.replace(/ xmlns=""/g, "");
    zip.file(sonucSheetFile, yeniSonucXml);

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const sinif = secilenTur === "ogretmen"
      ? "OkulGeneli"
      : (document.getElementById("filtre-sinif").value || "TumSiniflar");
    const tarih = new Date().toLocaleDateString("tr-TR").replace(/\./g, "-");
    
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `RIBA_${kadeFiltre}_${sinif}_${tarih}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);

    toast.basari("Şablon başarıyla dolduruldu ve indirildi.");
  } catch (err) {
    console.error("Şablon indirme hatası:", err);
    toast.hata(err.message || "Şablon indirilemedi.");
  } finally {
    btn.innerHTML = orjText;
    btn.disabled = false;
  }
}
