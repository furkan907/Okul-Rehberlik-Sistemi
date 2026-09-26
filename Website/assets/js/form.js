// ============================================================
// pages/form/form.js
// Veli aile durum formu — kimlik doğrulaması gerektirmez.
// URL: /pages/form/index.html?sinif=5-A
// Adımlar: 1) Öğrenci seç  2) Kimlik  3) Fiziksel  4) Sağlık  5) Veli  6) Başarı
// ============================================================

import { formBekleyenOgrencileriGetir,
         formuKaydet,
         ogrenciNoGetir,
         okulAdiniGetir }           from "./students.service.js";
import { toast }                   from "./toast.js";

// ---------- URL Parametresi ----------
const params = new URLSearchParams(location.search);
const SINIF  = (params.get("sinif") || "").trim();

// Aktif okul bağlamını URL'den al (dashboard'dan oluşturulan linkler ?okul=... içerir)
window.__okulCtx = window.__okulCtx || {};
window.__okulCtx.okul_id = params.get("okul") || window.__okulCtx.okul_id || "okul-001";

// ---------- DOM ----------
const hataEkran = document.getElementById("hata-ekran");
const hataMesaj = document.getElementById("hata-mesaj");
const formPage  = document.getElementById("form-page");
const baslikKatilimci = document.getElementById("baslik-katilimci");

const adim1 = document.getElementById("adim-1");
const adim2 = document.getElementById("adim-2");
const adim3 = document.getElementById("adim-3");
const adim4 = document.getElementById("adim-4");
const adim5 = document.getElementById("adim-5");
const adim6 = document.getElementById("adim-6");
const adim7 = document.getElementById("adim-7");
const dots  = [
  document.getElementById("dot-0"),
  document.getElementById("dot-1"),
  document.getElementById("dot-2"),
  document.getElementById("dot-3"),
  document.getElementById("dot-4"),
  document.getElementById("dot-5"),
  document.getElementById("dot-6"),
];

// Adım 1
const aramaInput = document.getElementById("arama-input");
const listesiEl  = document.getElementById("ogrenci-listesi");
const devam1Btn  = document.getElementById("btn-adim1-devam");

// Adım 2 — Kimlik
const uyrukSelect    = document.getElementById("f-uyruk");
const tcKimlikAlan   = document.getElementById("tc-kimlik-alan");
const tcInput        = document.getElementById("f-tc-kimlik");
const dogumTarihi    = document.getElementById("f-dogum-tarihi");
const dogumYeri      = document.getElementById("f-dogum-yeri");
const adresInput     = document.getElementById("f-adres");
const kardesInput    = document.getElementById("f-kardes");
const geri2Btn       = document.getElementById("btn-adim2-geri");
const devam2Btn      = document.getElementById("btn-adim2-devam");

// Adım 3 — Fiziksel
const boyInput      = document.getElementById("f-boy");
const kiloInput     = document.getElementById("f-kilo");
const bedenSelect   = document.getElementById("f-beden");
const ayakkabiInput = document.getElementById("f-ayakkabi");
const geri3Btn      = document.getElementById("btn-adim3-geri");
const devam3Btn     = document.getElementById("btn-adim3-devam");

// Adım 4 — Sağlık
const kanGrubuSelect       = document.getElementById("f-kan-grubu");
const kronikDetayAlan      = document.getElementById("kronik-detay-alan");
const kronikDetayInput     = document.getElementById("f-kronik-detay");
const kronikDetayDigerAlan = document.getElementById("kronik-detay-diger-alan");
const kronikDetayDigerInput = document.getElementById("f-kronik-detay-diger");
const ilacDetayAlan        = document.getElementById("ilac-detay-alan");
const ilacDetayInput       = document.getElementById("f-ilac-detay");
const ilacDetayDigerAlan   = document.getElementById("ilac-detay-diger-alan");
const ilacDetayDigerInput  = document.getElementById("f-ilac-detay-diger");
const gecmisHastalikAlan   = document.getElementById("gecmis-hastalik-detay-alan");
const gecmisHastalikInput  = document.getElementById("f-gecmis-hastalik-detay");
const gecmisHastalikDigerAlan = document.getElementById("gecmis-hastalik-detay-diger-alan");
const gecmisHastalikDigerInput = document.getElementById("f-gecmis-hastalik-detay-diger");
const ameliyatDetayAlan    = document.getElementById("ameliyat-detay-alan");
const ameliyatDetayInput   = document.getElementById("f-ameliyat-detay");
const ameliyatDetayDigerAlan = document.getElementById("ameliyat-detay-diger-alan");
const ameliyatDetayDigerInput = document.getElementById("f-ameliyat-detay-diger");
const kazaDetayAlan        = document.getElementById("kaza-detay-alan");
const kazaDetayInput       = document.getElementById("f-kaza-detay");
const kazaDetayDigerAlan   = document.getElementById("kaza-detay-diger-alan");
const kazaDetayDigerInput  = document.getElementById("f-kaza-detay-diger");
const protezDetayAlan      = document.getElementById("protez-detay-alan");
const protezDetayInput     = document.getElementById("f-protez-detay");
const protezDetayDigerAlan = document.getElementById("protez-detay-diger-alan");
const protezDetayDigerInput = document.getElementById("f-protez-detay-diger");
const alerjiDetayAlan      = document.getElementById("alerji-detay-alan");
const alerjiDetayInput     = document.getElementById("f-alerji-detay");
const psikolojikDetayAlan  = document.getElementById("psikolojik-detay-alan");
const psikolojikDetayInput = document.getElementById("f-psikolojik-detay");
const geri4Btn             = document.getElementById("btn-adim4-geri");
const devam4Btn            = document.getElementById("btn-adim4-devam");

// Adım 5 — Veli
const aileYapisisiSelect   = document.getElementById("f-aile-yapisi");
const geri5Btn             = document.getElementById("btn-adim5-geri");
const gonder5Btn           = document.getElementById("btn-adim5-gonder");
const gonder6Btn           = document.getElementById("btn-adim6-gonder");

// ---------- Durum ----------
let ogrenciler       = [];
let seciliOgrenci    = null;
let kronikDurumu     = null;
let ilacDurumu       = null;
let gecmisHastalik   = null;
let ameliyatDurumu   = null;
let kazaDurumu       = null;
let protezDurumu     = null;
let alerjiDurumu     = null;
let aileYapisi       = null; // "birlikte"|"ayri"|"anne_vefat"|"baba_vefat"|"ikisi_vefat"
let yasamYeri        = null; // "anne"|"baba"|"akraba"|"kurum"
let kurumTipi        = null; // "sevgi_evi"|"shcek"|"yurt_pansiyon"
let ayriSebep        = null; // "bosanmis"|"is_sebebiyle"|"farkli_sebep" — sadece ayrı durumunda
let anneKronik       = null; // "evet"|"hayir"
let anneEngelli      = null; // "evet"|"hayir"
let babaKronik       = null; // "evet"|"hayir"
let babaEngelli      = null; // "evet"|"hayir"
let psikolojikDurumu = null;
let bakimKronik      = null;
let bakimEngelli     = null;
// Yeni: veli ruhsal + aile genel
let anneRuhsal       = null;
let babaRuhsal       = null;
let bakimRuhsal      = null;
let aileBagimlilik   = null;
let cezaiHukum       = null;
// Yeni: sosyo-ekonomik (Adım 6)
let evKira           = null;
let ozelOda          = null;
let tasimaciOgrenci  = null;
let aileByukler      = null;
let sosyalYardim     = null;
let burslu           = null;

const NEGATIF_EVET_SORULARI = new Set([
  "kronik",
  "psikolojik",
  "ilac",
  "gecmis_hastalik",
  "ameliyat",
  "kaza",
  "protez",
  "alerji",
  "anne_kronik",
  "anne_engelli",
  "anne_ruhsal",
  "baba_kronik",
  "baba_engelli",
  "baba_ruhsal",
  "bakim_kronik",
  "bakim_engelli",
  "bakim_ruhsal",
  "aile_bagimlilik",
  "cezai_hukum",
]);

function tcKimlikGecerliMi(deger) {
  return /^\d{11}$/.test(deger);
}

function telefonGecerliMi(deger) {
  return /^0\d{10}$/.test(deger);
}

function tcKimlikAlaniDogrula(input, { required = false, label = "T.C. Kimlik No", showMessage = false } = {}) {
  if (!input) return true;

  const deger = input.value.trim();

  if (!deger) {
    if (required) {
      input.setCustomValidity(`${label} zorunludur.`);
      if (showMessage) input.reportValidity();
      return false;
    }
    input.setCustomValidity("");
    return true;
  }

  if (!tcKimlikGecerliMi(deger)) {
    input.setCustomValidity(`${label} 11 haneli olmalıdır.`);
    if (showMessage) input.reportValidity();
    return false;
  }

  input.setCustomValidity("");
  return true;
}

function telefonAlaniDogrula(input, { required = false, label = "Telefon", showMessage = false } = {}) {
  if (!input) return true;

  const deger = input.value.trim();

  if (!deger) {
    if (required) {
      input.setCustomValidity(`${label} zorunludur.`);
      if (showMessage) input.reportValidity();
      return false;
    }
    input.setCustomValidity("");
    return true;
  }

  if (!telefonGecerliMi(deger)) {
    input.setCustomValidity(`${label} 0 ile başlayan 11 haneli olmalıdır.`);
    if (showMessage) input.reportValidity();
    return false;
  }

  input.setCustomValidity("");
  return true;
}

function gorunenTcAlanlariniDogrula() {
  const kontroller = [
    {
      input: tcInput,
      required: uyrukSelect.value === "TC",
      label: "Öğrenci T.C. Kimlik No",
    },
    {
      input: document.getElementById("f-anne-tc"),
      required: false,
      label: "Anne T.C. Kimlik No",
    },
    {
      input: document.getElementById("f-baba-tc"),
      required: false,
      label: "Baba T.C. Kimlik No",
    },
    {
      input: document.getElementById("f-bakim-tc"),
      required: false,
      label: "Bakım Veren T.C. Kimlik No",
    },
  ];

  for (const kontrol of kontroller) {
    const { input, required, label } = kontrol;
    if (!input) continue;
    if (!tcKimlikAlaniDogrula(input, { required, label, showMessage: true })) {
      input.focus();
      return false;
    }
  }

  return true;
}

function gorunenTelefonAlanlariniDogrula() {
  const kontroller = [
    { input: document.getElementById("f-anne-tel"), label: "Anne Telefon" },
    { input: document.getElementById("f-baba-tel"), label: "Baba Telefon" },
    { input: document.getElementById("f-bakim-tel"), label: "Bakım Veren Telefon" },
    { input: document.getElementById("f-anne-isteye-tel"), label: "Anne Telefon" },
    { input: document.getElementById("f-baba-isteye-tel"), label: "Baba Telefon" },
    { input: document.getElementById("f-kurum-tel"), label: "Kurum Telefon" },
  ];

  for (const kontrol of kontroller) {
    const { input, label } = kontrol;
    if (!input) continue;
    if (!telefonAlaniDogrula(input, { label, showMessage: true })) {
      input.focus();
      return false;
    }
  }

  return true;
}

function kronikDetayAlaniniGuncelle() {
  if (!kronikDetayAlan || !kronikDetayDigerAlan || !kronikDetayInput) return;

  const digerSecili = kronikDetayInput.value === "diger";
  kronikDetayDigerAlan.classList.toggle("hidden", !digerSecili);
  if (!digerSecili && kronikDetayDigerInput) {
    kronikDetayDigerInput.value = "";
  }
}

function ogrenciKronikDetayDegeri() {
  if (kronikDurumu !== "evet") return null;
  if (!kronikDetayInput) return null;
  if (kronikDetayInput.value === "diger") {
    return kronikDetayDigerInput?.value.trim() || null;
  }
  return kronikDetayInput.value || null;
}

function ilacDetayAlaniniGuncelle() {
  if (!ilacDetayAlan || !ilacDetayDigerAlan || !ilacDetayInput) return;

  const digerSecili = ilacDetayInput.value === "diger";
  ilacDetayDigerAlan.classList.toggle("hidden", !digerSecili);
  if (!digerSecili && ilacDetayDigerInput) {
    ilacDetayDigerInput.value = "";
  }
}

function ogrenciIlacDetayDegeri() {
  if (ilacDurumu !== "evet") return null;
  if (!ilacDetayInput) return null;
  if (ilacDetayInput.value === "diger") {
    return ilacDetayDigerInput?.value.trim() || null;
  }
  return ilacDetayInput.value || null;
}

function gecmisHastalikDetayAlaniniGuncelle() {
  if (!gecmisHastalikAlan || !gecmisHastalikDigerAlan || !gecmisHastalikInput) return;

  const digerSecili = gecmisHastalikInput.value === "diger";
  gecmisHastalikDigerAlan.classList.toggle("hidden", !digerSecili);
  if (!digerSecili && gecmisHastalikDigerInput) {
    gecmisHastalikDigerInput.value = "";
  }
}

function ogrenciGecmisHastalikDetayDegeri() {
  if (gecmisHastalik !== "evet") return null;
  if (!gecmisHastalikInput) return null;
  if (gecmisHastalikInput.value === "diger") {
    return gecmisHastalikDigerInput?.value.trim() || null;
  }
  return gecmisHastalikInput.value || null;
}

function ameliyatDetayAlaniniGuncelle() {
  if (!ameliyatDetayAlan || !ameliyatDetayDigerAlan || !ameliyatDetayInput) return;

  const digerSecili = ameliyatDetayInput.value === "diger";
  ameliyatDetayDigerAlan.classList.toggle("hidden", !digerSecili);
  if (!digerSecili && ameliyatDetayDigerInput) {
    ameliyatDetayDigerInput.value = "";
  }
}

function ogrenciAmeliyatDetayDegeri() {
  if (ameliyatDurumu !== "evet") return null;
  if (!ameliyatDetayInput) return null;
  if (ameliyatDetayInput.value === "diger") {
    return ameliyatDetayDigerInput?.value.trim() || null;
  }
  return ameliyatDetayInput.value || null;
}

function kazaDetayAlaniniGuncelle() {
  if (!kazaDetayAlan || !kazaDetayDigerAlan || !kazaDetayInput) return;

  const digerSecili = kazaDetayInput.value === "diger";
  kazaDetayDigerAlan.classList.toggle("hidden", !digerSecili);
  if (!digerSecili && kazaDetayDigerInput) {
    kazaDetayDigerInput.value = "";
  }
}

function ogrenciKazaDetayDegeri() {
  if (kazaDurumu !== "evet") return null;
  if (!kazaDetayInput) return null;
  if (kazaDetayInput.value === "diger") {
    return kazaDetayDigerInput?.value.trim() || null;
  }
  return kazaDetayInput.value || null;
}

function protezDetayAlaniniGuncelle() {
  if (!protezDetayAlan || !protezDetayDigerAlan || !protezDetayInput) return;

  const digerSecili = protezDetayInput.value === "diger";
  protezDetayDigerAlan.classList.toggle("hidden", !digerSecili);
  if (!digerSecili && protezDetayDigerInput) {
    protezDetayDigerInput.value = "";
  }
}

function ogrenciProtezDetayDegeri() {
  if (protezDurumu !== "evet") return null;
  if (!protezDetayInput) return null;
  if (protezDetayInput.value === "diger") {
    return protezDetayDigerInput?.value.trim() || null;
  }
  return protezDetayInput.value || null;
}

async function okulBaglaminiTamamla() {
  if (window.__okulCtx?.okul_adi || !window.__okulCtx?.okul_id) return;

  try {
    const okulAdi = await okulAdiniGetir(window.__okulCtx.okul_id);
    if (okulAdi) {
      window.__okulCtx.okul_adi = okulAdi;
    }
  } catch (error) {
    console.warn("Okul adı alınamadı:", error);
  }
}

// ============================================================
// Başlatma
// ============================================================
async function init() {
  if (!SINIF) {
    gosterHata("Sınıf bilgisi eksik. Lütfen okul yönetiminden doğru linki isteyin.");
    return;
  }

  await okulBaglaminiTamamla();

  document.getElementById("baslik-okul").textContent =
    window.__okulCtx?.okul_adi || window.__okulCtx?.okul_id || "OKUL";
  document.getElementById("baslik-sinif").textContent = SINIF + " Sınıfı";
  document.getElementById("sinif-adi-1").textContent  = SINIF;

  hataEkran.classList.add("hidden");
  formPage.classList.remove("hidden");

  await ogrencileriYukle();

  aramaInput.addEventListener("input", aramaYap);
  devam1Btn.addEventListener("click",  adim2yiGoster);
  geri2Btn.addEventListener("click",   () => adimGit(0));
  devam2Btn.addEventListener("click",  adim3eGec);
  geri3Btn.addEventListener("click",   () => adimGit(1));
  devam3Btn.addEventListener("click",  adim4eGec);
  geri4Btn.addEventListener("click",   () => adimGit(2));
  devam4Btn.addEventListener("click",  adim5eGec);
  geri5Btn.addEventListener("click",   () => adimGit(3));
  gonder5Btn.addEventListener("click", adim6eGec);

  document.getElementById("btn-adim6-geri").addEventListener("click",   () => adimGit(4));
  gonder6Btn.addEventListener("click", formuGonder);

  // Aile yapısı seçimine göre bölümleri güncelle
  aileYapisisiSelect.addEventListener("change", () => {
    aileYapisi     = aileYapisisiSelect.value || null;
    yasamYeri      = null;
    ayriSebep      = null;
    kurumTipi      = null;
    bakimKronik    = null;
    bakimEngelli   = null;
    anneRuhsal     = null;
    babaRuhsal     = null;
    bakimRuhsal    = null;
    aileBagimlilik = null;
    cezaiHukum     = null;
    document.querySelectorAll("[data-soru='ayri_sebep'],[data-soru='kurum_tipi'],[data-soru='bakim_kronik'],[data-soru='bakim_engelli'],[data-soru='anne_ruhsal'],[data-soru='baba_ruhsal'],[data-soru='bakim_ruhsal'],[data-soru='aile_bagimlilik'],[data-soru='cezai_hukum']").forEach(b =>
      b.classList.remove("secili-evet", "secili-hayir")
    );
    updateYasamYeriButonlari();
    updateVeliBolumleri();
  });

  // Çalışma durumu (anne) → iş ve diğer alanları
  document.getElementById("f-anne-calisma").addEventListener("change", function () {
    const v = this.value;
    document.getElementById("anne-is-alan").classList.toggle("hidden", v !== "calisiyor");
    document.getElementById("anne-calisma-diger-alan").classList.toggle("hidden", v !== "diger");
    if (v !== "calisiyor") document.getElementById("f-anne-is").value = "";
    if (v !== "diger")     document.getElementById("f-anne-calisma-diger").value = "";
  });

  // Çalışma durumu (baba) → iş ve diğer alanları
  document.getElementById("f-baba-calisma").addEventListener("change", function () {
    const v = this.value;
    document.getElementById("baba-is-alan").classList.toggle("hidden", v !== "calisiyor");
    document.getElementById("baba-calisma-diger-alan").classList.toggle("hidden", v !== "diger");
    if (v !== "calisiyor") document.getElementById("f-baba-is").value = "";
    if (v !== "diger")     document.getElementById("f-baba-calisma-diger").value = "";
  });

  // Çalışma durumu (bakım veren) → iş ve diğer alanları
  document.getElementById("f-bakim-calisma").addEventListener("change", function () {
    const v = this.value;
    document.getElementById("bakim-is-alan").classList.toggle("hidden", v !== "calisiyor");
    document.getElementById("bakim-calisma-diger-alan").classList.toggle("hidden", v !== "diger");
    if (v !== "calisiyor") document.getElementById("f-bakim-is").value = "";
    if (v !== "diger")     document.getElementById("f-bakim-calisma-diger").value = "";
  });

  // Veli TC kimlik — sadece rakam
  [tcInput, document.getElementById("f-anne-tc"), document.getElementById("f-baba-tc"), document.getElementById("f-bakim-tc")].forEach(input => {
    if (!input) return;
    input.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 11);
      tcKimlikAlaniDogrula(this, {
        required: this === tcInput && uyrukSelect.value === "TC",
        label: this === tcInput ? "Öğrenci T.C. Kimlik No" : "T.C. Kimlik No",
      });
    });
    input.addEventListener("blur", function () {
      tcKimlikAlaniDogrula(this, {
        required: this === tcInput && uyrukSelect.value === "TC",
        label: this === tcInput ? "Öğrenci T.C. Kimlik No" : "T.C. Kimlik No",
        showMessage: true,
      });
    });
  });

  [
    document.getElementById("f-anne-tel"),
    document.getElementById("f-baba-tel"),
    document.getElementById("f-bakim-tel"),
    document.getElementById("f-anne-isteye-tel"),
    document.getElementById("f-baba-isteye-tel"),
    document.getElementById("f-kurum-tel"),
  ].forEach(input => {
    if (!input) return;
    input.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 11);
      telefonAlaniDogrula(this, { label: "Telefon" });
    });
    input.addEventListener("blur", function () {
      const etiket = this.labels?.[0]?.textContent?.trim() || "Telefon";
      telefonAlaniDogrula(this, { label: etiket, showMessage: true });
    });
  });

  // Uyruk seçimine göre T.C. kimlik alanını göster/gizle
  uyrukSelect.addEventListener("change", () => {
    const isTc = uyrukSelect.value === "TC";
    tcKimlikAlan.classList.toggle("hidden", !isTc);
    if (!isTc) {
      tcInput.value = "";
      tcInput.setCustomValidity("");
    }
  });

  // Evet / Hayır akıllı sorular
  document.querySelectorAll(".soru-btn").forEach(btn => {
    btn.addEventListener("click", () => soruCevapla(btn));
  });

  kronikDetayInput?.addEventListener("change", kronikDetayAlaniniGuncelle);
  ilacDetayInput?.addEventListener("change", ilacDetayAlaniniGuncelle);
  gecmisHastalikInput?.addEventListener("change", gecmisHastalikDetayAlaniniGuncelle);
  ameliyatDetayInput?.addEventListener("change", ameliyatDetayAlaniniGuncelle);
  kazaDetayInput?.addEventListener("change", kazaDetayAlaniniGuncelle);
  protezDetayInput?.addEventListener("change", protezDetayAlaniniGuncelle);
}

// ============================================================
// Öğrenci Yükleme
// ============================================================
async function ogrencileriYukle() {
  listesiEl.innerHTML = `
    <p style="text-align:center;padding:1.5rem;color:var(--neutral-400);font-size:.85rem">
      Yükleniyor...
    </p>
  `;
  try {
    ogrenciler = await formBekleyenOgrencileriGetir(SINIF);
    if (ogrenciler.length === 0) {
      gosterHata(`${SINIF} sınıfı için doldurulacak form kalmamış. Tüm veliler formu tamamlamış. Teşekkürler! 🎉`);
      return;
    }
    ogrencileriRenderla(ogrenciler);
  } catch (e) {
    listesiEl.innerHTML = `
      <p style="text-align:center;padding:1.5rem;color:var(--danger);font-size:.85rem">
        Öğrenciler yüklenemedi. Lütfen sayfayı yenileyin.
      </p>
    `;
    toast.hata("Yükleme hatası: " + e.message);
  }
}

// ============================================================
// Öğrenci Listesi Render
// ============================================================
function ogrencileriRenderla(liste) {
  if (liste.length === 0) {
    listesiEl.innerHTML = `
      <p style="text-align:center;padding:1.5rem;color:var(--neutral-400);font-size:.85rem">
        Arama kriterlerine uyan öğrenci bulunamadı.
      </p>
    `;
    return;
  }

  listesiEl.innerHTML = liste.map(o => {
    const secili   = seciliOgrenci?.id === o.id ? "secili" : "";
    return `
      <button
        class="ogrenci-item ${secili}"
        role="option"
        aria-selected="${secili ? "true" : "false"}"
        data-id="${o.id}"
        type="button"
      >
        <span class="ogrenci-ad">${o.ad} ${o.soyad}</span>
      </button>
    `;
  }).join("");

  listesiEl.querySelectorAll(".ogrenci-item").forEach(el => {
    el.addEventListener("click", () => ogrenciSec(el.dataset.id));
  });
}

// ============================================================
// Öğrenci Seçimi
// ============================================================
function ogrenciSec(id) {
  seciliOgrenci = ogrenciler.find(o => o.id === id) || null;
  listesiEl.querySelectorAll(".ogrenci-item").forEach(el => {
    const aktif = el.dataset.id === id;
    el.classList.toggle("secili", aktif);
    el.setAttribute("aria-selected", aktif ? "true" : "false");
  });
  devam1Btn.disabled = !seciliOgrenci;
}

// ============================================================
// Arama
// ============================================================
function aramaYap() {
  const q = aramaInput.value.trim().toLocaleLowerCase("tr");
  const filtreli = ogrenciler.filter(o =>
    `${o.ad} ${o.soyad}`.toLocaleLowerCase("tr").includes(q) ||
    ogrenciNoGetir(o).includes(q)
  );
  ogrencileriRenderla(filtreli);
}

function baslikKatilimciGuncelle(adimIndex = 0) {
  if (!baslikKatilimci) return;

  if (adimIndex === 0 || !seciliOgrenci) {
    baslikKatilimci.style.display = "none";
    baslikKatilimci.textContent = "";
    return;
  }

  baslikKatilimci.textContent = `${seciliOgrenci.ad} ${seciliOgrenci.soyad}`;
  baslikKatilimci.style.display = "inline-flex";
}

// ============================================================
// Adım Yönetimi  (0-indexed: 0=adım1 … 3=başarı)
// ============================================================
function adimGit(idx) {
  [adim1, adim2, adim3, adim4, adim5, adim6, adim7].forEach((el, i) => {
    el.classList.toggle("aktif-adim", i === idx);
  });
  dots.forEach((dot, i) => {
    dot.classList.remove("aktif", "tamamdi");
    if (i < idx)   dot.classList.add("tamamdi");
    if (i === idx) dot.classList.add("aktif");
  });
  baslikKatilimciGuncelle(idx);
  document.querySelector(".form-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============================================================
// Adım 1 → 2
// ============================================================
function adim2yiGoster() {
  if (!seciliOgrenci) return;

  tcInput.value = ""; dogumTarihi.value = ""; dogumYeri.value = "";
  adresInput.value = ""; kardesInput.value = "0";
  uyrukSelect.value = ""; tcKimlikAlan.classList.add("hidden");

  adimGit(1);
}

// ============================================================
// Adım 2 → Adım 3
// ============================================================
function adim3eGec() {
  if (!tcKimlikAlaniDogrula(tcInput, {
    required: uyrukSelect.value === "TC",
    label: "Öğrenci T.C. Kimlik No",
    showMessage: true,
  })) {
    tcInput.focus();
    return;
  }

  boyInput.value = ""; kiloInput.value = "";
  bedenSelect.value = ""; ayakkabiInput.value = "";

  adimGit(2);
}

// ============================================================
// Adım 3 → Adım 4 (Sağlık)
// ============================================================
function adim4eGec() {
  kanGrubuSelect.value = "";
  kronikDurumu = null; ilacDurumu = null; psikolojikDurumu = null;
  gecmisHastalik = null; ameliyatDurumu = null;
  kazaDurumu = null; protezDurumu = null; alerjiDurumu = null;

  [
    kronikDetayAlan, ilacDetayAlan, gecmisHastalikAlan,
    ameliyatDetayAlan, kazaDetayAlan, protezDetayAlan, alerjiDetayAlan,
    psikolojikDetayAlan
  ].forEach(el => el.classList.add("hidden"));
  [
    kronikDetayInput, ilacDetayInput, gecmisHastalikInput,
    ameliyatDetayInput, kazaDetayInput, protezDetayInput, alerjiDetayInput,
    psikolojikDetayInput
  ].forEach(el => el.value = "");
  if (kronikDetayDigerAlan) kronikDetayDigerAlan.classList.add("hidden");
  if (kronikDetayDigerInput) kronikDetayDigerInput.value = "";
  if (ilacDetayDigerAlan) ilacDetayDigerAlan.classList.add("hidden");
  if (ilacDetayDigerInput) ilacDetayDigerInput.value = "";
  if (gecmisHastalikDigerAlan) gecmisHastalikDigerAlan.classList.add("hidden");
  if (gecmisHastalikDigerInput) gecmisHastalikDigerInput.value = "";
  if (ameliyatDetayDigerAlan) ameliyatDetayDigerAlan.classList.add("hidden");
  if (ameliyatDetayDigerInput) ameliyatDetayDigerInput.value = "";
  if (kazaDetayDigerAlan) kazaDetayDigerAlan.classList.add("hidden");
  if (kazaDetayDigerInput) kazaDetayDigerInput.value = "";
  if (protezDetayDigerAlan) protezDetayDigerAlan.classList.add("hidden");
  if (protezDetayDigerInput) protezDetayDigerInput.value = "";

  document.querySelectorAll(".soru-btn").forEach(b =>
    b.classList.remove("secili-evet", "secili-hayir", "secili-secim")
  );
  adimGit(3);
}

// ============================================================
// Adım 4 → Adım 5 (Veli Bilgileri)
// ============================================================
function adim5eGec() {
  aileYapisi   = null;
  yasamYeri    = null;
  ayriSebep    = null;
  kurumTipi    = null;
  anneKronik   = null;
  anneEngelli  = null;
  babaKronik   = null;
  babaEngelli  = null;
  bakimKronik  = null;
  bakimEngelli = null;
  anneRuhsal   = null;
  babaRuhsal   = null;
  bakimRuhsal  = null;
  aileBagimlilik = null;
  cezaiHukum   = null;
  aileYapisisiSelect.value = "";
  document.getElementById("yasam-yeri-secenekler").innerHTML = "";
  ["ayri-sebep-alan","yasam-yeri-alan","kurum-tipi-alan",
   "anne-birincil-bolum","anne-isteye-bolum",
   "baba-birincil-bolum","baba-isteye-bolum",
   "bakim-veren-bolum","kurum-bolum",
   "anne-is-alan","anne-calisma-diger-alan","anne-kronik-detay-alan","anne-engelli-detay-alan","anne-ruhsal-detay-alan",
   "baba-is-alan","baba-calisma-diger-alan","baba-kronik-detay-alan","baba-engelli-detay-alan","baba-ruhsal-detay-alan",
   "bakim-is-alan","bakim-calisma-diger-alan","bakim-kronik-detay-alan","bakim-engelli-detay-alan","bakim-ruhsal-detay-alan"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );
  ["f-anne-ad","f-anne-tc","f-anne-dogum","f-anne-tel",
   "f-anne-is","f-anne-calisma-diger","f-anne-kronik-detay","f-anne-engelli-detay","f-anne-ruhsal-detay",
   "f-baba-ad","f-baba-tc","f-baba-dogum","f-baba-tel",
   "f-baba-is","f-baba-calisma-diger","f-baba-kronik-detay","f-baba-engelli-detay","f-baba-ruhsal-detay",
   "f-anne-isteye-ad","f-anne-isteye-tel",
   "f-baba-isteye-ad","f-baba-isteye-tel",
   "f-bakim-ad","f-bakim-tc","f-bakim-dogum","f-bakim-tel",
   "f-bakim-is","f-bakim-calisma-diger","f-bakim-kronik-detay","f-bakim-engelli-detay","f-bakim-ruhsal-detay",
   "f-kurum-ad","f-kurum-yetkili","f-kurum-tel"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  ["f-anne-egitim","f-anne-calisma",
   "f-baba-egitim","f-baba-calisma",
   "f-bakim-yakinlik","f-bakim-egitim","f-bakim-calisma"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  document.querySelectorAll(
    "[data-soru='ayri_sebep'],[data-soru='kurum_tipi'],[data-soru='anne_kronik'],[data-soru='anne_engelli'],[data-soru='anne_ruhsal'],[data-soru='baba_kronik'],[data-soru='baba_engelli'],[data-soru='baba_ruhsal'],[data-soru='bakim_kronik'],[data-soru='bakim_engelli'],[data-soru='bakim_ruhsal'],[data-soru='aile_bagimlilik'],[data-soru='cezai_hukum']"
  ).forEach(b => b.classList.remove("secili-evet","secili-hayir","secili-secim"));
  adimGit(4);
}

// ============================================================
// Adım 5 → Adım 6 (Sosyo-Ekonomik)
// ============================================================
function adim6eGec() {
  evKira = null; ozelOda = null; tasimaciOgrenci = null;
  aileByukler = null; sosyalYardim = null; burslu = null;
  ["f-hane-kisi","f-aile-buyukler-kac"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  ["f-isinma","f-okul-gelis","f-hane-geliri"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  document.getElementById("aile-buyukler-kac-alan").classList.add("hidden");
  document.querySelectorAll(
    "[data-soru='ev_kira'],[data-soru='ozel_oda'],[data-soru='tasimaci_ogrenci'],[data-soru='aile_buyukler'],[data-soru='sosyal_yardim'],[data-soru='burslu']"
  ).forEach(b => b.classList.remove("secili-evet","secili-hayir","secili-secim"));
  adimGit(5);
}

// ============================================================
// Yaşam yeri butonlarını aile yapısına göre render et
// ============================================================
function updateYasamYeriButonlari() {
  const BUTONLAR = {
    birlikte:    [["anne_baba","Anne ve baba ile"],["kurum","Kurum / Yurt"]],
    ayri:        [["anne","Anne yanında"],["baba","Baba yanında"],["akraba","Akraba yanında"],["kurum","Kurum / Yurt"]],
    baba_vefat:  [["anne","Anne yanında"],["akraba","Akraba yanında"],["kurum","Kurum / Yurt"]],
    anne_vefat:  [["baba","Baba yanında"],["akraba","Akraba yanında"],["kurum","Kurum / Yurt"]],
    ikisi_vefat: [["akraba","Akraba yanında"],["kurum","Kurum / Yurt"]],
  };
  const secenekler = BUTONLAR[aileYapisi] || [];
  const container  = document.getElementById("yasam-yeri-secenekler");
  container.innerHTML = secenekler.map(([val, etiket]) =>
    `<button type="button" class="soru-btn" data-soru="yasam_yeri" data-val="${val}">${etiket}</button>`
  ).join("");
  container.querySelectorAll(".soru-btn").forEach(btn =>
    btn.addEventListener("click", () => soruCevapla(btn))
  );
}

// ============================================================
// Veli bölümlerini aile yapısı + yaşam yeri kombinasyonuna göre göster/gizle
// ============================================================
function updateVeliBolumleri() {
  const anneBirincil = (aileYapisi === "birlikte" && yasamYeri === "anne_baba") ||
                       (aileYapisi === "baba_vefat" && yasamYeri === "anne") ||
                       (aileYapisi === "ayri"       && yasamYeri === "anne");
  const babaBirincil = (aileYapisi === "birlikte" && yasamYeri === "anne_baba") ||
                       (aileYapisi === "anne_vefat" && yasamYeri === "baba") ||
                       (aileYapisi === "ayri"       && yasamYeri === "baba");
  const bakimVeren   = yasamYeri === "akraba";
  const kurumBolum   = yasamYeri === "kurum";
  // İsteğe bağlı: sağ olan ama birlikte yaşanmayan ebeveyn
  const anneIsteye   = (aileYapisi === "ayri"       && yasamYeri === "baba") ||
                       (aileYapisi === "baba_vefat" && ["akraba","kurum"].includes(yasamYeri));
  const babaIsteye   = (aileYapisi === "ayri"       && yasamYeri === "anne") ||
                       (aileYapisi === "anne_vefat" && ["akraba","kurum"].includes(yasamYeri));
  const bolumler = {
    "ayri-sebep-alan":     aileYapisi === "ayri",
    "yasam-yeri-alan":     aileYapisi !== null,
    "kurum-tipi-alan":     yasamYeri === "kurum",
    "anne-birincil-bolum": anneBirincil,
    "baba-birincil-bolum": babaBirincil,
    "bakim-veren-bolum":   bakimVeren,
    "kurum-bolum":         kurumBolum,
    "anne-isteye-bolum":   anneIsteye,
    "baba-isteye-bolum":   babaIsteye,
  };
  Object.entries(bolumler).forEach(([id, show]) =>
    document.getElementById(id).classList.toggle("hidden", !show)
  );
}

// ============================================================
// Evet / Hayır akıllı soru butonu
// ============================================================
function soruCevapla(btn) {
  const soru = btn.dataset.soru;
  const val  = btn.dataset.val;

  btn.closest(".soru-secenekler").querySelectorAll(".soru-btn").forEach(b => {
    b.classList.remove("secili-evet", "secili-hayir", "secili-secim");
  });

  // Yaşam yeri butonu — özel işlem
  if (soru === "yasam_yeri") {
    btn.classList.add("secili-secim");
    yasamYeri = val;
    kurumTipi = null;
    document.querySelectorAll("[data-soru='kurum_tipi']").forEach(b =>
      b.classList.remove("secili-evet", "secili-hayir", "secili-secim")
    );
    updateVeliBolumleri();
    return;
  }

  // Kurum tipi butonu — özel işlem
  if (soru === "kurum_tipi") {
    btn.classList.add("secili-evet");
    kurumTipi = val;
    return;
  }

  // Ayrılık sebebi butonu — özel işlem
  if (soru === "ayri_sebep") {
    btn.classList.add("secili-evet");
    ayriSebep = val;
    return;
  }

  if (soru === "ev_kira" && val === "lojman") {
    btn.classList.add("secili-secim");
    evKira = val;
    return;
  }

  const negatifEvet = NEGATIF_EVET_SORULARI.has(soru);
  if (val === "evet") {
    btn.classList.add(negatifEvet ? "secili-hayir" : "secili-evet");
  } else {
    btn.classList.add(negatifEvet ? "secili-evet" : "secili-hayir");
  }

  const haritasi = {
    kronik:          { durum: (v) => kronikDurumu  = v, alan: kronikDetayAlan,     input: kronikDetayInput },
    ilac:            { durum: (v) => ilacDurumu    = v, alan: ilacDetayAlan,       input: ilacDetayInput },
    gecmis_hastalik: { durum: (v) => gecmisHastalik = v, alan: gecmisHastalikAlan, input: gecmisHastalikInput },
    ameliyat:        { durum: (v) => ameliyatDurumu = v, alan: ameliyatDetayAlan,  input: ameliyatDetayInput },
    kaza:            { durum: (v) => kazaDurumu    = v, alan: kazaDetayAlan,       input: kazaDetayInput },
    protez:          { durum: (v) => protezDurumu  = v, alan: protezDetayAlan,     input: protezDetayInput },
    alerji:          { durum: (v) => alerjiDurumu  = v, alan: alerjiDetayAlan,     input: alerjiDetayInput },
    anne_kronik:     { durum: (v) => anneKronik    = v, alan: document.getElementById("anne-kronik-detay-alan"),  input: document.getElementById("f-anne-kronik-detay") },
    anne_engelli:    { durum: (v) => anneEngelli   = v, alan: document.getElementById("anne-engelli-detay-alan"), input: document.getElementById("f-anne-engelli-detay") },
    baba_kronik:     { durum: (v) => babaKronik    = v, alan: document.getElementById("baba-kronik-detay-alan"),  input: document.getElementById("f-baba-kronik-detay") },
    baba_engelli:    { durum: (v) => babaEngelli   = v, alan: document.getElementById("baba-engelli-detay-alan"), input: document.getElementById("f-baba-engelli-detay") },
    psikolojik:      { durum: (v) => psikolojikDurumu = v, alan: psikolojikDetayAlan,  input: psikolojikDetayInput },
    bakim_kronik:    { durum: (v) => bakimKronik   = v, alan: document.getElementById("bakim-kronik-detay-alan"),  input: document.getElementById("f-bakim-kronik-detay") },
    bakim_engelli:    { durum: (v) => bakimEngelli   = v, alan: document.getElementById("bakim-engelli-detay-alan"), input: document.getElementById("f-bakim-engelli-detay") },
    anne_ruhsal:      { durum: (v) => anneRuhsal     = v, alan: document.getElementById("anne-ruhsal-detay-alan"),  input: document.getElementById("f-anne-ruhsal-detay") },
    baba_ruhsal:      { durum: (v) => babaRuhsal     = v, alan: document.getElementById("baba-ruhsal-detay-alan"),  input: document.getElementById("f-baba-ruhsal-detay") },
    bakim_ruhsal:     { durum: (v) => bakimRuhsal    = v, alan: document.getElementById("bakim-ruhsal-detay-alan"), input: document.getElementById("f-bakim-ruhsal-detay") },
    aile_buyukler:    { durum: (v) => aileByukler    = v, alan: document.getElementById("aile-buyukler-kac-alan"),  input: document.getElementById("f-aile-buyukler-kac") },
    aile_bagimlilik:  { durum: (v) => aileBagimlilik = v, alan: null, input: null },
    cezai_hukum:      { durum: (v) => cezaiHukum     = v, alan: null, input: null },
    ev_kira:          { durum: (v) => evKira          = v, alan: null, input: null },
    ozel_oda:         { durum: (v) => ozelOda         = v, alan: null, input: null },
    tasimaci_ogrenci: { durum: (v) => tasimaciOgrenci = v, alan: null, input: null },
    sosyal_yardim:    { durum: (v) => sosyalYardim    = v, alan: null, input: null },
    burslu:           { durum: (v) => burslu          = v, alan: null, input: null },
  };

  const h = haritasi[soru];
  if (!h) return;
  h.durum(val);
  if (h.alan) h.alan.classList.toggle("hidden", val !== "evet");
  if (h.input) {
    if (val === "evet") h.input.focus();
    else {
      h.input.value = "";
      if (soru === "kronik") kronikDetayAlaniniGuncelle();
      if (soru === "ilac") ilacDetayAlaniniGuncelle();
      if (soru === "gecmis_hastalik") gecmisHastalikDetayAlaniniGuncelle();
      if (soru === "ameliyat") ameliyatDetayAlaniniGuncelle();
      if (soru === "kaza") kazaDetayAlaniniGuncelle();
      if (soru === "protez") protezDetayAlaniniGuncelle();
    }
  }
}

// ============================================================
// Form Gönder (Adım 5 → Başarı)
// ============================================================
async function formuGonder() {
  if (!seciliOgrenci) return;

  if (!gorunenTcAlanlariniDogrula()) return;
  if (!gorunenTelefonAlanlariniDogrula()) return;

  const formVerisi = {
    tc_kimlik:          tcInput.value.trim(),
    dogum_tarihi:       dogumTarihi.value,
    dogum_yeri:         dogumYeri.value.trim(),
    adres:              adresInput.value.trim(),
    kardes_sayisi:      parseInt(kardesInput.value, 10) || 0,
    uyruk:              uyrukSelect.value  || null,
    boy:                boyInput.value      ? parseInt(boyInput.value, 10)      : null,
    kilo:               kiloInput.value     ? parseInt(kiloInput.value, 10)     : null,
    beden:              bedenSelect.value   || null,
    ayakkabi_no:        ayakkabiInput.value ? parseInt(ayakkabiInput.value, 10) : null,
    kan_grubu:           kanGrubuSelect.value || null,
    kronik_rahatsizlik:  kronikDurumu,
    kronik_detay:        ogrenciKronikDetayDegeri(),
    sureli_ilac:         ilacDurumu,
    ilac_detay:          ogrenciIlacDetayDegeri(),
    gecmis_hastalik:     gecmisHastalik,
    gecmis_hastalik_detay: ogrenciGecmisHastalikDetayDegeri(),
    ameliyat:            ameliyatDurumu,
    ameliyat_detay:      ogrenciAmeliyatDetayDegeri(),
    kaza:                kazaDurumu,
    kaza_detay:          ogrenciKazaDetayDegeri(),
    protez_cihaz:        protezDurumu,
    protez_detay:        ogrenciProtezDetayDegeri(),
    alerji:              alerjiDurumu,
    alerji_detay:        alerjiDurumu   === "evet" ? alerjiDetayInput.value.trim()     || null : null,
    psikolojik_rahatsizlik: psikolojikDurumu,
    psikolojik_detay:    psikolojikDurumu === "evet" ? psikolojikDetayInput.value.trim() || null : null,
  };

  // Veli bilgileri
  const veliBilgileri = {
    aile_yapisi:  aileYapisi,
    yasam_yeri:   yasamYeri,
    ayri_sebep:   aileYapisi === "ayri"  ? ayriSebep : null,
    kurum_tipi:   yasamYeri  === "kurum" ? kurumTipi : null,
  };
  const anneKaydet = (aileYapisi === "birlikte" && yasamYeri === "anne_baba") ||
                     (aileYapisi === "baba_vefat" && yasamYeri === "anne") ||
                     (aileYapisi === "ayri"       && yasamYeri === "anne");
  const babaKaydet = (aileYapisi === "birlikte" && yasamYeri === "anne_baba") ||
                     (aileYapisi === "anne_vefat" && yasamYeri === "baba") ||
                     (aileYapisi === "ayri"       && yasamYeri === "baba");
  const anneIsteye = (aileYapisi === "ayri"       && yasamYeri === "baba") ||
                     (aileYapisi === "baba_vefat" && ["akraba","kurum"].includes(yasamYeri));
  const babaIsteye = (aileYapisi === "ayri"       && yasamYeri === "anne") ||
                     (aileYapisi === "anne_vefat" && ["akraba","kurum"].includes(yasamYeri));

  if (anneKaydet) {
    const anneCalisma = document.getElementById("f-anne-calisma").value || null;
    veliBilgileri.anne = {
      ad_soyad:        document.getElementById("f-anne-ad").value.trim()           || null,
      tc_kimlik:       document.getElementById("f-anne-tc").value.trim()           || null,
      dogum_tarihi:    document.getElementById("f-anne-dogum").value               || null,
      telefon:         document.getElementById("f-anne-tel").value.trim()          || null,
      egitim:          document.getElementById("f-anne-egitim").value              || null,
      calisma:         anneCalisma,
      is:              anneCalisma === "calisiyor" ? document.getElementById("f-anne-is").value.trim()           || null : null,
      calisma_diger:   anneCalisma === "diger"     ? document.getElementById("f-anne-calisma-diger").value.trim() || null : null,
      kronik_hastalik: anneKronik,
      kronik_detay:    anneKronik  === "evet" ? document.getElementById("f-anne-kronik-detay").value.trim()  || null : null,
      engelli:         anneEngelli,
      engelli_detay:   anneEngelli === "evet" ? document.getElementById("f-anne-engelli-detay").value.trim() || null : null,
      ruhsal_hastalik: anneRuhsal,
      ruhsal_detay:    anneRuhsal  === "evet" ? document.getElementById("f-anne-ruhsal-detay").value.trim()  || null : null,
    };
  }
  if (babaKaydet) {
    const babaCalisma = document.getElementById("f-baba-calisma").value || null;
    veliBilgileri.baba = {
      ad_soyad:        document.getElementById("f-baba-ad").value.trim()           || null,
      tc_kimlik:       document.getElementById("f-baba-tc").value.trim()           || null,
      dogum_tarihi:    document.getElementById("f-baba-dogum").value               || null,
      telefon:         document.getElementById("f-baba-tel").value.trim()          || null,
      egitim:          document.getElementById("f-baba-egitim").value              || null,
      calisma:         babaCalisma,
      is:              babaCalisma === "calisiyor" ? document.getElementById("f-baba-is").value.trim()           || null : null,
      calisma_diger:   babaCalisma === "diger"     ? document.getElementById("f-baba-calisma-diger").value.trim() || null : null,
      kronik_hastalik: babaKronik,
      kronik_detay:    babaKronik  === "evet" ? document.getElementById("f-baba-kronik-detay").value.trim()  || null : null,
      engelli:         babaEngelli,
      engelli_detay:   babaEngelli === "evet" ? document.getElementById("f-baba-engelli-detay").value.trim() || null : null,
      ruhsal_hastalik: babaRuhsal,
      ruhsal_detay:    babaRuhsal  === "evet" ? document.getElementById("f-baba-ruhsal-detay").value.trim()  || null : null,
    };
  }
  if (anneIsteye) {
    veliBilgileri.anne_isteye = {
      ad_soyad: document.getElementById("f-anne-isteye-ad").value.trim()  || null,
      telefon:  document.getElementById("f-anne-isteye-tel").value.trim() || null,
    };
  }
  if (babaIsteye) {
    veliBilgileri.baba_isteye = {
      ad_soyad: document.getElementById("f-baba-isteye-ad").value.trim()  || null,
      telefon:  document.getElementById("f-baba-isteye-tel").value.trim() || null,
    };
  }
  if (yasamYeri === "akraba") {
    const bakimCalisma = document.getElementById("f-bakim-calisma").value || null;
    veliBilgileri.bakim_veren = {
      ad_soyad:        document.getElementById("f-bakim-ad").value.trim()              || null,
      tc_kimlik:       document.getElementById("f-bakim-tc").value.trim()              || null,
      dogum_tarihi:    document.getElementById("f-bakim-dogum").value                  || null,
      telefon:         document.getElementById("f-bakim-tel").value.trim()             || null,
      yakinlik:        document.getElementById("f-bakim-yakinlik").value               || null,
      egitim:          document.getElementById("f-bakim-egitim").value                 || null,
      calisma:         bakimCalisma,
      is:              bakimCalisma === "calisiyor" ? document.getElementById("f-bakim-is").value.trim()           || null : null,
      calisma_diger:   bakimCalisma === "diger"     ? document.getElementById("f-bakim-calisma-diger").value.trim() || null : null,
      kronik_hastalik: bakimKronik,
      kronik_detay:    bakimKronik  === "evet" ? document.getElementById("f-bakim-kronik-detay").value.trim()  || null : null,
      engelli:         bakimEngelli,
      engelli_detay:   bakimEngelli === "evet" ? document.getElementById("f-bakim-engelli-detay").value.trim() || null : null,
      ruhsal_hastalik: bakimRuhsal,
      ruhsal_detay:    bakimRuhsal  === "evet" ? document.getElementById("f-bakim-ruhsal-detay").value.trim()  || null : null,
    };
  }
  if (yasamYeri === "kurum") {
    veliBilgileri.kurum = {
      tur:     kurumTipi,
      ad:      document.getElementById("f-kurum-ad").value.trim()      || null,
      yetkili: document.getElementById("f-kurum-yetkili").value.trim() || null,
      telefon: document.getElementById("f-kurum-tel").value.trim()     || null,
    };
  }
  formVerisi.veli_bilgileri = veliBilgileri;

  formVerisi.aile_genel = {
    bagimlilik:  aileBagimlilik,
    cezai_hukum: cezaiHukum,
  };
  formVerisi.sosyo_ekonomik = {
    ev_kira:          evKira,
    ozel_oda:         ozelOda,
    isinma:           document.getElementById("f-isinma").value || null,
    tasimaci_ogrenci: tasimaciOgrenci,
    okul_gelis:       document.getElementById("f-okul-gelis").value || null,
    aile_buyukleri:   aileByukler,
    aile_buyukler_kac: aileByukler === "evet" ? (parseInt(document.getElementById("f-aile-buyukler-kac").value, 10) || null) : null,
    hane_kisi:        parseInt(document.getElementById("f-hane-kisi").value, 10) || null,
    hane_geliri:      document.getElementById("f-hane-geliri").value || null,
    sosyal_yardim:    sosyalYardim,
    burslu:           burslu,
  };

  gonder6Btn.disabled    = true;
  gonder6Btn.textContent = "Kaydediliyor...";

  try {
    await formuKaydet(seciliOgrenci.id, formVerisi);

    document.getElementById("basari-ad").textContent =
      `${seciliOgrenci.ad} ${seciliOgrenci.soyad}`;

    adimGit(6);
    dots.forEach(d => { d.classList.remove("aktif"); d.classList.add("tamamdi"); });

  } catch (e) {
    if (e?.code === "already-exists" || e?.code === "permission-denied") {
      toast.hata("Bu öğrenci için risk anketi zaten gönderilmiş görünüyor. Lütfen listeyi yenileyin.");
    } else {
      toast.hata("Form gönderilemedi: " + e.message);
    }
    gonder6Btn.disabled    = false;
    gonder6Btn.textContent = "Formu Gönder";
  }
}

// ============================================================
// Hata Ekranı
// ============================================================
function gosterHata(mesaj) {
  formPage.classList.add("hidden");
  hataMesaj.textContent = mesaj;
  hataEkran.classList.remove("hidden");
}

// ============================================================
// Başlat
// ============================================================
init();

