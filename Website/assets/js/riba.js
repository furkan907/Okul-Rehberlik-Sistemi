// ============================================================
// pages/riba/riba.js
// RİBA Rehberlik İhtiyaç Belirleme Anketi formu.
// URL parametreleri: ?tur=ogrenci|veli|ogretmen&sinif=5-A veya ?tur=ogretmen&kademe=ortaokul
// ============================================================

import { ribaBekleyenOgrencileriGetir,
         ribaTamamlandiIsaretle,
         okulAdiniGetir,
         ogrenciNoGetir }               from "./students.service.js";
import { ribaYanitiKaydet,
         ribaOgrenciAnahtariOlustur,
  }                               from "./riba.service.js";
import { toast }                        from "./toast.js";
import { RIBA_SORULAR }                 from "./riba-sorular.js";

// ---------- URL Parametreleri ----------
const params   = new URLSearchParams(window.location.search);
const TUR      = params.get("tur")   || "";       // "ogrenci" | "veli" | "ogretmen"
const SINIF_SUBE = params.get("sinif") || "";     // "5-A"
const KADEME_PARAM = params.get("kademe") || "";

// Aktif okul bağlamını URL'den al
window.__okulCtx = window.__okulCtx || {};
window.__okulCtx.okul_id = params.get("okul") || window.__okulCtx.okul_id || "okul-001";

const sinifParts = SINIF_SUBE.split("-");
const SINIF  = sinifParts[0] || "";
const SUBE   = sinifParts[1] || "";

// Kademe tespiti: 5-8 → ortaokul, 9-12 → lise
const sinifNo = parseInt(SINIF, 10);
const KADEME  = KADEME_PARAM || ((sinifNo >= 9 && sinifNo <= 12) ? "lise" : "ortaokul");

// ---------- Durum ----------
let seciliOgrenci     = null;
let zorlaDevam        = false;   // Öğretmen duplicate uyarısını atlama
let cevaplar          = {};      // { q1: "A", q2: "B", ... }
let aktifSoruIndex    = 0;
let secimGecisiKilidi = false;

const SECIM_GOSTERIM_MS = 320;

const mobilAnketMedya = window.matchMedia("(max-width: 719px)");

// ---------- Başlangıç ----------
const turEtiketleri = {
  ogrenci:  "ÖĞRENCİ FORMU",
  veli:     "VELİ FORMU",
  ogretmen: "ÖĞRETMEN FORMU",
};

const turBelgeEtiketleri = {
  ogrenci:  "Öğrenci Formu",
  veli:     "Veli Formu",
  ogretmen: "Öğretmen Formu",
};

const kadeEtiketleri = {
  ortaokul: "Ortaokul",
  lise:     "Lise",
};

// ---------- Doğrulama ----------
function dogrula() {
  const gecerliTurler = ["ogrenci", "veli", "ogretmen"];
  const sinifBilgisiGerekli = TUR !== "ogretmen";
  if (!gecerliTurler.includes(TUR) || (sinifBilgisiGerekli && (!SINIF || !SUBE)) || !KADEME) {
    document.getElementById("hata-mesaj").textContent =
      "Geçersiz veya eksik link parametreleri. Lütfen okul yönetiminden doğru bağlantıyı isteyin.";
    document.getElementById("hata-ekran").classList.remove("hidden");
    return false;
  }
  const sorular = (RIBA_SORULAR[TUR] || {})[KADEME];
  if (!sorular || sorular.length === 0) {
    document.getElementById("hata-mesaj").textContent =
      "Bu kademe ve tür için anket soruları henüz tanımlanmamış.";
    document.getElementById("hata-ekran").classList.remove("hidden");
    return false;
  }
  return true;
}

// ---------- Başlık güncelle ----------
function basligiAyarla() {
  document.querySelector(".form-card")?.setAttribute("data-tur", TUR);
  const baslikMetni = TUR === "ogretmen"
    ? `${turEtiketleri[TUR] || "ÖĞRETMEN FORMU"} ${(kadeEtiketleri[KADEME] || "").toLocaleUpperCase("tr-TR")}`.trim()
    : (turEtiketleri[TUR] || "ANKET FORMU");
  document.getElementById("baslik-anket").textContent = baslikMetni;
  const belgeBaglami = TUR === "ogretmen"
    ? (window.__okulCtx?.okul_adi || window.__okulCtx?.okul_id || "Öğretmen")
    : `${SINIF}/${SUBE}`;
  document.title = `RİBA ${turBelgeEtiketleri[TUR] || "Anket"} — ${belgeBaglami}`;
  baslikSinifGuncelle();
  baslikKatilimciGuncelle();
}

function baslikSinifGuncelle() {
  const chip = document.getElementById("baslik-sinif");
  if (!chip) return;

  if (TUR === "ogretmen") {
    chip.textContent = window.__okulCtx?.okul_adi || window.__okulCtx?.okul_id || `${SINIF}/${SUBE} Sınıfı`;
    return;
  }

  chip.textContent = `${SINIF}/${SUBE} Sınıfı`;
}

function baslikKatilimciGuncelle() {
  const chip = document.getElementById("baslik-katilimci");
  if (!chip) return;

  const soruEkraniAktif = document.getElementById("adim-sorular")?.classList.contains("aktif-adim");
  const katilimci = katilimciOzeti().baslik;

  if (!soruEkraniAktif || !katilimci || katilimci === "Katılımcı seçilmedi") {
    chip.style.display = "none";
    chip.textContent = "";
    return;
  }

  chip.textContent = katilimci;
  chip.style.display = "inline-flex";
}

function tekliSoruModuAktif() {
  return true;
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

// ---------- Ekran geçişi ----------
function ekranGoster(id) {
  ["adim-secim", "adim-ogretmen", "adim-sorular"].forEach(ekId => {
    const el = document.getElementById(ekId);
    if (el) el.classList.remove("aktif-adim");
    if (el) el.style.display = "none";
  });
  document.querySelector(".form-card")?.classList.toggle("riba-soru-modu", id === "adim-sorular");
  const hedef = document.getElementById(id);
  if (hedef) {
    hedef.classList.add("aktif-adim");
    hedef.style.display = "flex";
  }
  baslikSinifGuncelle();
  baslikKatilimciGuncelle();
}

function katilimciOzeti() {
  if (TUR === "ogretmen") {
    const ad = document.getElementById("ogretmen-ad")?.value.trim();
    const brans = document.getElementById("ogretmen-brans")?.value.trim();
    return {
      baslik: ad || "Öğretmen bilgisi girilecek",
      alt: brans || "Branş bilgisi eklenmemiş",
    };
  }

  if (seciliOgrenci) {
    return {
      baslik: `${seciliOgrenci.ad} ${seciliOgrenci.soyad}`,
      alt: `${seciliOgrenci.sinif}/${seciliOgrenci.sube} sınıfı öğrencisi`,
    };
  }

  return {
    baslik: "Katılımcı seçilmedi",
    alt: "Anket kişi bilgisi alınamadı",
  };
}

function soruKartiniOlustur(soru, idx) {
  const secim = cevaplar[soru.id];
  const soruListesi = (RIBA_SORULAR[TUR] || {})[KADEME] || [];
  const sonSoru = idx === soruListesi.length - 1;
  const soruBaslik = sonSoru
    ? 'İki seçenekten size daha uygun olanı işaretleyin ve "Yanıtları Gönder" butonuna tıklayın.'
    : "İki seçenekten size daha uygun olanı işaretleyin.";

  return `
    <div class="riba-soru-card" id="soru-${soru.id}">
      <div class="riba-soru-ust">
        <div class="riba-soru-no">Soru ${idx + 1}</div>
        <div class="riba-soru-baslik">${soruBaslik}</div>
      </div>
      <div class="riba-secenekler">
        <button class="riba-secenek${secim === "A" ? " secili" : ""}" data-soru="${soru.id}" data-secim="A" type="button">
          <span class="riba-secenek-harf">A</span>
          <span class="riba-secenek-metin">
            <span class="riba-secenek-icerik">${soru.a_metin}</span>
          </span>
        </button>
        <button class="riba-secenek${secim === "B" ? " secili" : ""}" data-soru="${soru.id}" data-secim="B" type="button">
          <span class="riba-secenek-harf">B</span>
          <span class="riba-secenek-metin">
            <span class="riba-secenek-icerik">${soru.b_metin}</span>
          </span>
        </button>
      </div>
    </div>
  `;
}

function soruIceriginiOlustur(sorular) {
  const aktifSoru = sorular[aktifSoruIndex];

  return `
    <section class="riba-tekli-akis">
      ${soruKartiniOlustur(aktifSoru, aktifSoruIndex)}
    </section>
  `;
}

function gonderYonlendirmesiniGuncelle() {
  const btnGonder = document.getElementById("btn-gonder");
  if (!btnGonder) return;

  const sorular = (RIBA_SORULAR[TUR] || {})[KADEME] || [];
  const aktifSoru = sorular[aktifSoruIndex];
  const sonSoru = aktifSoruIndex === sorular.length - 1;
  const cevapHazir = Boolean(aktifSoru && cevaplar[aktifSoru.id]);
  const rehberGoster = sonSoru && cevapHazir;

  btnGonder.classList.toggle("dikkat-cek", rehberGoster);
  btnGonder.textContent = rehberGoster ? "Yanıtları Gönder ✓" : "Anketi Gönder ✓";

  if (rehberGoster && mobilAnketMedya.matches) {
    btnGonder.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
}

// ============================================================
// ÖĞRENCI SEÇİM EKRANI (ogrenci + veli)
// ============================================================
async function secimEkraniniKur() {
  const tur = TUR === "veli" ? "veli" : "ogrenci";

  document.getElementById("secim-aciklama").innerHTML =
    TUR === "veli"
      ? `${SINIF}/${SUBE} sınıfı öğrencileri listelenmektedir.<br>Listeden kendi çocuğunuzu seçiniz.<br>Sonrasında Ankete Başla butonuna tıklayınız.`
      : `${SINIF}/${SUBE} Sınıfı öğrencileri listelenmektedir.<br>Listeden kendinizi seçin.<br>Sonrasında Ankete Başla butonuna tıklayınız.`;

  ekranGoster("adim-secim");
  document.getElementById("riba-progress").style.display = "none";

  let ogrenciler = [];
  try {
    ogrenciler = await ribaBekleyenOgrencileriGetir(SINIF_SUBE, tur);
  } catch (e) {
    toast.hata("Öğrenci listesi yüklenemedi: " + e.message);
  }

  renderOgrenciListesi(ogrenciler);

  // Arama
  document.getElementById("arama-input").addEventListener("input", function () {
    const kelime = this.value.trim().toUpperCase();
    const filtrelenmis = kelime
      ? ogrenciler.filter(o => `${o.ad} ${o.soyad}`.includes(kelime))
      : ogrenciler;
    renderOgrenciListesi(filtrelenmis);
  });

  // Devam butonu
  document.getElementById("btn-secim-devam").addEventListener("click", () => {
    if (!seciliOgrenci) return;
    cevaplar = {};
    aktifSoruIndex = 0;
    soruEkraniniKur();
  });
}

function renderOgrenciListesi(ogrenciler) {
  const liste = document.getElementById("ogrenci-listesi");
  if (ogrenciler.length === 0) {
    liste.innerHTML = `<p style="text-align:center;padding:1.5rem;color:var(--neutral-400);font-size:.85rem">
      ${TUR === "veli"
        ? "Bu sınıftaki tüm veliler anketi tamamladı."
        : "Bu sınıftaki tüm öğrenciler anketi tamamladı."}
    </p>`;
    return;
  }

  liste.innerHTML = ogrenciler
    .sort((a, b) => a.soyad.localeCompare(b.soyad, "tr"))
    .map(o => `
      <button
        class="ogrenci-item${seciliOgrenci?.id === o.id ? " secili" : ""}"
        data-id="${o.id}"
        role="option"
        aria-selected="${seciliOgrenci?.id === o.id}"
        type="button"
      >
        <span class="ogrenci-ad">${o.ad} ${o.soyad}</span>
      </button>
    `).join("");

  liste.querySelectorAll(".ogrenci-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      seciliOgrenci = ogrenciler.find(o => o.id === id) || null;
      liste.querySelectorAll(".ogrenci-item").forEach(b => {
        b.classList.toggle("secili", b.dataset.id === id);
        b.setAttribute("aria-selected", b.dataset.id === id ? "true" : "false");
      });
      baslikSinifGuncelle();
      document.getElementById("btn-secim-devam").disabled = !seciliOgrenci;
    });
  });
}

// ============================================================
// ÖĞRETMEN BİLGİ FORMU
// ============================================================
async function ogretmenEkraniniKur() {
  ekranGoster("adim-ogretmen");
  document.getElementById("riba-progress").style.display = "none";

  const btnDevam = document.getElementById("btn-ogretmen-devam");

  btnDevam.addEventListener("click", () => ogretmenDevam(false));
}

async function ogretmenDevam(zorla) {
  const adEl    = document.getElementById("ogretmen-ad");
  const bransEl = document.getElementById("ogretmen-brans");
  const hataEl  = document.getElementById("ogretmen-hata");

  const adSoyad = adEl.value.trim();
  const brans = bransEl.value.trim();
  if (!adSoyad || !brans) {
    hataEl.style.display = "block";
    return;
  }
  hataEl.style.display = "none";

  cevaplar = {};
  aktifSoruIndex = 0;
  soruEkraniniKur();
}

// ============================================================
// SORU EKRANI
// ============================================================
function soruEkraniniKur() {
  const sorular = RIBA_SORULAR[TUR][KADEME];
  ekranGoster("adim-sorular");
  baslikKatilimciGuncelle();

  // Progress bar göster
  const progressEl = document.getElementById("riba-progress");
  progressEl.style.display = "flex";

  function progressGuncelle() {
    const doldurulan = sorular.filter(s => cevaplar[s.id]).length;
    document.getElementById("progress-text").textContent = `${doldurulan} / ${sorular.length}`;
    const yuzde = sorular.length > 0 ? Math.round((doldurulan / sorular.length) * 100) : 0;
    document.getElementById("progress-fill").style.width = yuzde + "%";
  }

  function aksiyonlariGuncelle() {
    const btnOncekiSoru = document.getElementById("btn-onceki-soru");
    const btnSonrakiSoru = document.getElementById("btn-sonraki-soru");
    const btnGonder = document.getElementById("btn-gonder");

    const aktifSoru = sorular[aktifSoruIndex];
    const sonSoru = aktifSoruIndex === sorular.length - 1;

    btnOncekiSoru.style.display = "inline-flex";
    btnOncekiSoru.disabled = aktifSoruIndex === 0;

    btnSonrakiSoru.style.display = sonSoru ? "none" : "inline-flex";
    btnSonrakiSoru.disabled = !cevaplar[aktifSoru.id];
    btnSonrakiSoru.textContent = "Sonraki →";

    btnGonder.style.display = sonSoru ? "inline-flex" : "none";
    btnGonder.disabled = !cevaplar[aktifSoru.id];
    gonderYonlendirmesiniGuncelle();
  }

  function renderSorular() {
    wrap.innerHTML = soruIceriginiOlustur(sorular);
    secimGecisiKilidi = false;

    wrap.querySelectorAll(".riba-secenek").forEach(btn => {
      btn.addEventListener("click", () => {
        if (secimGecisiKilidi) return;

        const soruId = btn.dataset.soru;
        const secim = btn.dataset.secim;
        cevaplar[soruId] = secim;
        document.getElementById("sorular-uyari").style.display = "none";
        secimGecisiKilidi = true;

        wrap.querySelectorAll(".riba-secenek").forEach(secenekBtn => {
          const secenekSecili = secenekBtn === btn;
          secenekBtn.classList.toggle("secili", secenekSecili);
          secenekBtn.disabled = true;
          secenekBtn.setAttribute("aria-pressed", secenekSecili ? "true" : "false");
        });

        window.setTimeout(() => {
          if (aktifSoruIndex < sorular.length - 1) {
            aktifSoruIndex += 1;
          }
          progressGuncelle();
          renderSorular();
          aksiyonlariGuncelle();
        }, SECIM_GOSTERIM_MS);
      });
    });
  }

  const wrap = document.getElementById("sorular-wrap");
  renderSorular();
  progressGuncelle();
  aksiyonlariGuncelle();

  document.getElementById("btn-onceki-soru").onclick = () => {
    if (aktifSoruIndex === 0) return;
    aktifSoruIndex -= 1;
    renderSorular();
    progressGuncelle();
    aksiyonlariGuncelle();
  };

  document.getElementById("btn-sonraki-soru").onclick = () => {
    const aktifSoru = sorular[aktifSoruIndex];
    if (!cevaplar[aktifSoru.id]) {
      document.getElementById("sorular-uyari").style.display = "block";
      return;
    }
    if (aktifSoruIndex < sorular.length - 1) {
      aktifSoruIndex += 1;
      renderSorular();
      progressGuncelle();
      aksiyonlariGuncelle();
    }
  };

  // Gönder butonu
  document.getElementById("btn-gonder").onclick = () => anketiGonder(sorular);
}

async function anketiGonder(sorular) {
  // Tüm sorular cevaplanmış mı?
  const eksik = sorular.filter(s => !cevaplar[s.id]);
  if (eksik.length > 0) {
    document.getElementById("sorular-uyari").style.display = "block";
    aktifSoruIndex = sorular.findIndex(s => s.id === eksik[0].id);
    soruEkraniniKur();
    return;
  }

  const btnGonder = document.getElementById("btn-gonder");
  btnGonder.disabled = true;
  btnGonder.textContent = "Kaydediliyor...";

  try {
    // Her soru için seçilen kategoriyi hesapla
    const secilenKategoriler = sorular.map(soru => {
      const secim = cevaplar[soru.id];
      return secim === "A" ? soru.a_kategori : soru.b_kategori;
    });

    // Öğretmen bilgilerini al
    const ogretmenAd    = TUR === "ogretmen" ? document.getElementById("ogretmen-ad")?.value.trim() : null;
    const ogretmenBrans = TUR === "ogretmen" ? document.getElementById("ogretmen-brans")?.value.trim() : null;

    await ribaYanitiKaydet({
      anket_turu:          TUR,
      kademe:              KADEME,
      sinif:               TUR === "ogretmen" ? null : SINIF,
      sube:                TUR === "ogretmen" ? null : SUBE,
      ogrenci_id:          seciliOgrenci?.id || null,
      ogrenci_no:          seciliOgrenci ? ogrenciNoGetir(seciliOgrenci) : null,
      ogrenci_anahtari:    seciliOgrenci
        ? ribaOgrenciAnahtariOlustur({
            kademe: KADEME,
            sinif: SINIF,
            sube: SUBE,
            ogrenci_no: ogrenciNoGetir(seciliOgrenci),
          })
        : null,
      cevaplar,
      secilen_kategoriler: secilenKategoriler,
      ogretmen_ad_soyad:   ogretmenAd   || null,
      ogretmen_brans:      ogretmenBrans || null,
    });

    // Öğrenci/Veli için tamamlanma bayrağını güncelle
    if (seciliOgrenci?.id && (TUR === "ogrenci" || TUR === "veli")) {
      await ribaTamamlandiIsaretle(seciliOgrenci.id, TUR);
    }

    // Başarı ekranı
    const tamamlandiEl = document.getElementById("adim-tamamlandi");
    document.getElementById("riba-progress").style.display = "none";
    ["adim-secim", "adim-ogretmen", "adim-sorular"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove("aktif-adim"); el.style.display = "none"; }
    });
    tamamlandiEl.classList.add("aktif");

    let mesaj = "Katılımınız için teşekkür ederiz. Yanıtlarınız başarıyla kaydedildi.";
    if (TUR === "veli" && seciliOgrenci) {
      mesaj = `${seciliOgrenci.ad} ${seciliOgrenci.soyad} için veli anketi başarıyla kaydedildi. Teşekkür ederiz.`;
    } else if (TUR === "ogrenci" && seciliOgrenci) {
      mesaj = `${seciliOgrenci.ad} ${seciliOgrenci.soyad} için öğrenci anketi başarıyla kaydedildi. Teşekkür ederiz.`;
    }
    document.getElementById("tamamlandi-mesaj").textContent = mesaj;

  } catch (e) {
    if ((TUR === "ogrenci" || TUR === "veli") && (e?.code === "permission-denied" || e?.code === "already-exists")) {
      toast.hata("Bu öğrenci için bu anket zaten gönderilmiş görünüyor. Lütfen listeyi yenileyin.");
    } else {
      toast.hata("Anket kaydedilemedi: " + e.message);
    }
    btnGonder.disabled = false;
    btnGonder.textContent = "Anketi Gönder ✓";
  }
}

// ============================================================
// BAŞLAT
// ============================================================
(async function baslat() {
  if (!dogrula()) return;

  if (TUR === "ogretmen") {
    await okulBaglaminiTamamla();
  }

  basligiAyarla();
  document.getElementById("form-page").classList.remove("hidden");

  // CSS: adım içeriklerini başlangıçta gizle
  ["adim-secim", "adim-ogretmen", "adim-sorular"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  mobilAnketMedya.addEventListener("change", () => {
    if (document.getElementById("adim-sorular")?.classList.contains("aktif-adim")) {
      soruEkraniniKur();
    }
  });

  if (TUR === "ogretmen") {
    ogretmenEkraniniKur();
  } else {
    await secimEkraniniKur();
  }
})();
