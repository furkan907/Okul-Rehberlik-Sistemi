// ============================================================
// pages/dashboard/dashboard.js
// Yönetici paneli — öğrenci listesi, istatistikler,
// veli form linki üretici, öğrenci ekleme, risk modalı.
// ============================================================

import { adminKoruması }         from "./auth-guard.js";
import { cikisYap,
         bekleyenKullanicilariGetir,
         kullaniciOnayla,
         kullaniciReddet,
         bekleyenOgretmenleriGetir,
         tumKullanicilariGetir,
         kullaniciSil }           from "./auth.service.js";
import { tumOgrencileriGetir,
         tumOkullariGetir,
         tekOgrenciEkle,
         idareNotlariKaydet,
         ribaTamamlanmaBayraklariniEsitle,
         ogrenciNoGetir,
         riskAnketDoldurulduMu,
         okulVeriSayilariniGetir,
         tumOkulVerileriniSil,
         tekOgrenciSil }    from "./students.service.js";
import { tumRibaYanitlariniGetir,
         ribaLegacyYanitMi,
         ribaEksikLegacyYanitMi } from "./riba.service.js";
import { toast }                 from "./toast.js";

const SURPRIZ_HEDEF_EMAIL = "beyzabicak37@gmail.com";
const SURPRIZ_GORSEL_YOLU = "../../prank/pic.jpg";

// Uygulama kök yolu (trailing slash ile biter).
// Bu dosya /assets/js/dashboard.js altında; bir seviye yukarısı
// /assets/ klasörüdür (css, js, pages vb. hepsi assets altında).
// Böylece proje ister alan adı kökünde, ister alt klasörde
// (örn. http://127.0.0.1:5500/Website/) servis edilsin linkler doğru üretilir.
const APP_BASE = new URL("../", import.meta.url).href;

// ---------- Risk Kriteri Etiketleri (Form kaynaklı) ----------
const FORM_RISKLER = {
  aile_suregen:     "Ailesinde Süreğen Hastalık",
  aile_ruhsal:      "Ailesinde Ruhsal Hastalık",
  aile_bagimlilik:  "Ailesinde Bağımlı Bireyler",
  cezai_hukum:      "Ailesinde Cezai Hüküm",
  mevsimlik_isci:   "Ailesi Mevsimlik İşçi",
  suregen_hastalik: "Süreğen Hastalığı Olan",
  ruhsal_hastalik:  "Ruhsal Hastalığı Olan",
  maddi_sikinti:    "Maddi Sıkıntı Yaşayan",
};

// ---------- Risk Kriteri Etiketleri (İdare kaynaklı) ----------
const IDARE_RISKLER = {
  sehit_cocugu:       "Şehit Çocuğu",
  aile_ici_siddet:    "Aile İçi Şiddete Maruz Kalan",
  ozel_yetenekli:     "Özel Yetenekli Tanısı Olan",
  ozel_egitim:        "Yetersizlik / Özel Eğitim Raporu",
  danismanlik_tedbir: "Danışmanlık Tedbir Kararı Olan",
  egitim_tedbir:      "Eğitim Tedbir Kararı Olan",
  devamsiz:           "Sürekli Devamsız Olan",
  bir_iste_calisan:   "Bir İşte Çalışan",
  akademik_dusuk:     "Akademik Başarısı Düşük",
  riskli_akran:       "Riskli Akran Grubuna Dahil",
  disiplin_cezasi:    "Disiplin Cezası Alan",
};

// ---------- Uygulama Durumu ----------
let tumOgrenciler = [];
let tumRibaYanitlari = [];
let ribaDurumSetleri = {
  ogrenci: new Set(),
  veli: new Set(),
};
let ogrenciIdMap = new Map();
let ogrenciNoMap = new Map();
let ogrenciAnahtarMap = new Map();

// ---------- Sınıf Sıralama Yardımcısı ----------
// "10-A" gibi değerleri sayısal olarak sıralar (5-A < 6-A < ... < 10-A)
function sinifSirala(a, b) {
  const [numA, subA = ""] = a.split("-");
  const [numB, subB = ""] = b.split("-");
  const diff = Number(numA) - Number(numB);
  return diff !== 0 ? diff : subA.localeCompare(subB, "tr");
}

function siniftanKademeBul(sinifSube) {
  const [sinif = ""] = String(sinifSube || "").split("-");
  const sinifNo = Number.parseInt(sinif, 10);
  if (!Number.isNaN(sinifNo)) {
    return sinifNo >= 9 ? "lise" : "ortaokul";
  }
  if (sinif.toLocaleLowerCase("tr").includes("özel eğitim")) {
    return "ortaokul";
  }
  return null;
}

function okulKademesiniTahminEt() {
  const kademeler = new Set(
    tumOgrenciler
      .map(o => siniftanKademeBul(`${o.sinif}-${o.sube}`))
      .filter(Boolean)
  );

  if (kademeler.has("ortaokul")) return "ortaokul";
  if (kademeler.has("lise")) return "lise";
  return null;
}

function ogrenciHaritalariniHazirla() {
  ogrenciIdMap = new Map();
  ogrenciNoMap = new Map();
  ogrenciAnahtarMap = new Map();

  tumOgrenciler.forEach(ogrenci => {
    if (ogrenci?.id) ogrenciIdMap.set(ogrenci.id, ogrenci);
    const ogrenciNo = ogrenciNoGetir(ogrenci);
    if (ogrenciNo) ogrenciNoMap.set(ogrenciNo, ogrenci);
    const ogrenciAnahtari = [ogrenci?.kademe || siniftanKademeBul(`${ogrenci?.sinif}-${ogrenci?.sube}`) || "", ogrenci?.sinif || "", ogrenci?.sube || "", ogrenciNo]
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

function ribaYanitindanOgrenciGetir(yanit) {
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

function ribaDurumSetleriniHazirla() {
  const ogrenciSet = new Set();
  const veliSet = new Set();

  tumRibaYanitlari.forEach(yanit => {
    const ogrenci = ribaYanitindanOgrenciGetir(yanit);
    if (!ogrenci?.id) return;
    if (yanit.anket_turu === "ogrenci") ogrenciSet.add(ogrenci.id);
    if (yanit.anket_turu === "veli") veliSet.add(ogrenci.id);
  });

  ribaDurumSetleri = {
    ogrenci: ogrenciSet,
    veli: veliSet,
  };
}

function ogrenciRibaTamamlandiMi(ogrenci, tur) {
  if (!ogrenci?.id) return false;
  if (tur === "ogrenci") {
    return Boolean(ogrenci.riba_ogrenci_dolduruldu || ribaDurumSetleri.ogrenci.has(ogrenci.id));
  }
  return Boolean(ogrenci.riba_veli_dolduruldu || ribaDurumSetleri.veli.has(ogrenci.id));
}

async function eksikRibaBayraklariniEsitle() {
  const guncellemeler = [];

  tumOgrenciler.forEach(ogrenci => {
    if (ribaDurumSetleri.ogrenci.has(ogrenci.id) && !ogrenci.riba_ogrenci_dolduruldu) {
      guncellemeler.push({ ogrenciId: ogrenci.id, tur: "ogrenci" });
      ogrenci.riba_ogrenci_dolduruldu = true;
    }
    if (ribaDurumSetleri.veli.has(ogrenci.id) && !ogrenci.riba_veli_dolduruldu) {
      guncellemeler.push({ ogrenciId: ogrenci.id, tur: "veli" });
      ogrenci.riba_veli_dolduruldu = true;
    }
  });

  if (guncellemeler.length > 0) {
    try {
      await ribaTamamlanmaBayraklariniEsitle(guncellemeler);
    } catch (err) {
      console.warn("Eksik RİBA bayrakları eşitlenirken hata oluştu:", err);
    }
  }
}

// ---------- Giriş Koruması ----------
adminKoruması(async (user, profil) => {
  surprizModaliniKur(user);
  document.getElementById("user-email").textContent = user.email;

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await cikisYap();
    window.location.href = APP_BASE + "pages/login/index.html";
  });

  // Superadmin için okul seçici + kullanıcı yönetim paneli
  if (profil.role === "superadmin") {
    await kurOkulSecici();
    await kurBekleyenKullanicilar();
    await kurKullaniciYonetimiPaneli();
  } else if (profil.okul_adi) {
    // Okul adminı: okul adını header'da göster
    const sub = document.querySelector(".dash-brand-sub");
    if (sub) sub.textContent = profil.okul_adi;
  }

  // Öğretmen: sadece okuma — admin-only UI gizle
  if (profil.role === "ogretmen") {
    // Öğrenci Ekle butonu
    document.getElementById("btn-ogrenci-ekle")?.style.setProperty("display", "none");
    // Veli form link paneli
    document.getElementById("link-paneli")?.style.setProperty("display", "none");
    // RİBA link paneli
    document.getElementById("riba-link-paneli")?.style.setProperty("display", "none");
    // İdare notları kaydet butonu
    document.getElementById("modal-kaydet")?.style.setProperty("display", "none");
  }

  // Admin: kendi hesabını silme butonu
  if (profil.role === "admin") {
    kurHesabimiSil(user, profil);
  }

  await verileriYukle();

  // Admin: kendi okulunun bekleyen öğretmen taleplerini göster
  if (profil.role === "admin") {
    await kurBekleyenOgretmenler(profil);
  }

  kurSekmeler();
  kurFiltreler();
  if (typeof kurRibaFiltreler === 'function') kurRibaFiltreler();
  kurLinkPaneli();
  kurRibaLinkPaneli();
  kurModal();
  kurTumVerileriSilModal();
});

function surprizModaliniKur(user) {
  if (!user?.email || user.email.toLowerCase() !== SURPRIZ_HEDEF_EMAIL) return;

  const modal = document.getElementById("surpriz-modal");
  const kapatBtn = document.getElementById("surpriz-kapat");
  const gorsel = document.getElementById("surpriz-gorsel");

  if (!modal || !kapatBtn || !gorsel) return;

  const kapat = () => modal.classList.add("hidden");

  gorsel.src = SURPRIZ_GORSEL_YOLU;
  gorsel.onerror = () => {
    gorsel.style.display = "none";
  };
  gorsel.onload = () => {
    gorsel.style.display = "block";
  };

  kapatBtn.onclick = kapat;
  modal.onclick = (e) => {
    if (e.target === modal) kapat();
  };

  modal.classList.remove("hidden");
}

// ============================================================
// Okul Seçici (Superadmin)
// ============================================================
async function kurOkulSecici() {
  try {
    const okullar = await tumOkullariGetir();
    if (okullar.length === 0) return;

    // window.__okulCtx'te okul yoksa ilk okulu seç
    if (!window.__okulCtx.okul_id) {
      window.__okulCtx.okul_id = okullar[0].id;
    }

    const headerActions = document.querySelector(".dash-header-actions");
    const select = document.createElement("select");
    select.id = "okul-secici";
    select.className = "dash-select-minimal";

    okullar.forEach(okul => {
      const opt = document.createElement("option");
      opt.value = okul.id;
      opt.textContent = okul.okul_adi || okul.id;
      if (okul.id === window.__okulCtx.okul_id) opt.selected = true;
      select.appendChild(opt);
    });

    headerActions.insertBefore(select, document.getElementById("logout-btn"));

    // Okul değiştirildiğinde verileri yeniden yükle
    select.addEventListener("change", async () => {
      window.__okulCtx.okul_id = select.value;
      const secilen = okullar.find(o => o.id === select.value);
      const sub = document.querySelector(".dash-brand-sub");
      if (sub) sub.textContent = secilen?.okul_adi || select.value;

      await verileriYukle();
      sinifSelectleriniDoldur();
      kurRibaLinkPaneli();
    });

    // Header'da okul adını göster
    const sub = document.querySelector(".dash-brand-sub");
    if (sub) {
      const ilk = okullar.find(o => o.id === window.__okulCtx.okul_id);
      if (ilk) sub.textContent = ilk.okul_adi || ilk.id;
    }
  } catch (e) {
    console.warn("Okul seçici yüklenemedi:", e);
  }
}

// ============================================================
// Bekleyen Kullanıcılar (Superadmin — Onay Paneli)
// ============================================================
async function kurBekleyenKullanicilar() {
  try {
    const bekleyenler = await bekleyenKullanicilariGetir();
    if (bekleyenler.length === 0) return;

    const main  = document.querySelector(".dash-main");
    const panel = document.createElement("div");
    panel.id = "bekleyen-panel";
    panel.style.cssText = [
      "background:#fefce8",
      "border:1px solid #fde047",
      "border-radius:12px",
      "padding:1rem 1.25rem",
      "margin-bottom:1.25rem"
    ].join(";");

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;font-weight:700;
                  font-size:.92rem;color:#92400e;margin-bottom:.75rem">
        ⏳ Onay Bekleyen Hesaplar
        <span id="bekleyen-sayac" style="background:#fcd34d;border-radius:999px;
              padding:.1rem .55rem;font-size:.78rem">${bekleyenler.length}</span>
      </div>
      <div id="bekleyen-liste"></div>
    `;
    main.prepend(panel);

    const liste = panel.querySelector("#bekleyen-liste");

    function satirRenderla(u) {
      const row = document.createElement("div");
      row.dataset.uid = u.uid;
      row.style.cssText = [
        "display:flex",
        "align-items:center",
        "gap:.75rem",
        "padding:.6rem .85rem",
        "background:#fff",
        "border-radius:8px",
        "margin-bottom:.5rem",
        "font-size:.875rem",
        "flex-wrap:wrap"
      ].join(";");

      row.innerHTML = `
        <div style="flex:1;min-width:160px">
          <strong>${u.ad_soyad || "—"}</strong>
          <span style="color:#6b7280;margin-left:.4rem;font-size:.82rem">${u.email}</span>
        </div>
        <div style="color:#374151;min-width:120px">${u.okul_adi || u.okul_id || "—"}</div>
        <div style="display:flex;gap:.4rem">
          <button class="btn-onayla" style="padding:.3rem .85rem;font-size:.8rem;border:none;
                  border-radius:6px;background:#16a34a;color:#fff;cursor:pointer">
            ✓ Onayla
          </button>
          <button class="btn-reddet" style="padding:.3rem .85rem;font-size:.8rem;border:none;
                  border-radius:6px;background:#dc2626;color:#fff;cursor:pointer">
            ✕ Reddet
          </button>
        </div>
      `;

      row.querySelector(".btn-onayla").addEventListener("click", async (e) => {
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = "...";
        await kullaniciOnayla(u.uid);
        row.remove();
        guncelleSayac();
        toast.basari(`${u.ad_soyad || u.email} onaylandı.`);
      });

      row.querySelector(".btn-reddet").addEventListener("click", async (e) => {
        if (!confirm(`"${u.ad_soyad || u.email}" adlı kullanıcı reddedilsin mi?`)) return;
        e.currentTarget.disabled = true;
        await kullaniciReddet(u.uid);
        row.remove();
        guncelleSayac();
        toast.bilgi(`${u.ad_soyad || u.email} reddedildi.`);
      });

      liste.appendChild(row);
    }

    function guncelleSayac() {
      const kalan = liste.querySelectorAll("[data-uid]").length;
      document.getElementById("bekleyen-sayac").textContent = kalan;
      if (kalan === 0) panel.remove();
    }

    bekleyenler.forEach(satirRenderla);
  } catch (e) {
    console.warn("Bekleyen kullanıcılar yüklenemedi:", e);
  }
}

// ============================================================
// Bekleyen Öğretmenler (Admin — Onay Paneli)
// ============================================================
async function kurBekleyenOgretmenler(profil) {
  try {
    const bekleyenler = await bekleyenOgretmenleriGetir(profil.okul_id);
    if (bekleyenler.length === 0) return;

    const siniflar = [...new Set(tumOgrenciler.map(o => `${o.sinif}-${o.sube}`))].sort(sinifSirala);

    const main  = document.querySelector(".dash-main");
    const panel = document.createElement("div");
    panel.id = "bekleyen-ogretmen-panel";
    panel.style.cssText = [
      "background:#eff6ff",
      "border:1px solid #93c5fd",
      "border-radius:12px",
      "padding:1rem 1.25rem",
      "margin-bottom:1.25rem"
    ].join(";");

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;font-weight:700;
                  font-size:.92rem;color:#1e40af;margin-bottom:.75rem">
        🧑‍🏫 Öğretmen Onay Talepleri
        <span id="ogretmen-sayac" style="background:#93c5fd;border-radius:999px;
              padding:.1rem .55rem;font-size:.78rem">${bekleyenler.length}</span>
      </div>
      <div id="ogretmen-bekleyen-liste"></div>
    `;
    main.prepend(panel);

    const liste = panel.querySelector("#ogretmen-bekleyen-liste");

    bekleyenler.forEach(u => {
      const row = document.createElement("div");
      row.dataset.uid = u.uid;
      row.style.cssText = [
        "background:#fff",
        "border-radius:8px",
        "padding:.75rem 1rem",
        "margin-bottom:.5rem",
        "border:1px solid #e0e7ff"
      ].join(";");

      const sinifCheckboxlar = siniflar.map(s =>
        `<label style="display:inline-flex;align-items:center;gap:.25rem;font-size:.8rem;
                padding:.2rem .45rem;border:1px solid #e0e7ff;border-radius:5px;cursor:pointer">
           <input type="checkbox" class="sinif-cb" value="${s}"> ${s}
         </label>`
      ).join("");

      row.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:.75rem;flex-wrap:wrap">
          <div style="flex:1;min-width:140px">
            <strong style="font-size:.9rem">${u.ad_soyad || "—"}</strong><br>
            <span style="font-size:.8rem;color:#6b7280">${u.email}</span>
            ${u.telefon ? `<br><span style="font-size:.8rem;color:#6b7280">📞 ${u.telefon}</span>` : ""}
          </div>
          <div style="flex:2;min-width:200px">
            <p style="font-size:.75rem;font-weight:600;color:#6b7280;margin-bottom:.35rem;text-transform:uppercase">
              Sınıf Ataması <span style="font-weight:400;text-transform:none">(isteğe bağlı)</span>
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:.3rem">
              ${siniflar.length ? sinifCheckboxlar
                : '<span style="font-size:.8rem;color:#9ca3af">Önce öğrenci listesi yükleyin</span>'}
            </div>
          </div>
          <div style="display:flex;gap:.4rem;align-items:center;padding-top:.25rem">
            <button class="btn-ogr-onayla" style="padding:.3rem .85rem;font-size:.8rem;border:none;
                    border-radius:6px;background:#2563eb;color:#fff;cursor:pointer">✓ Onayla</button>
            <button class="btn-ogr-reddet" style="padding:.3rem .85rem;font-size:.8rem;border:none;
                    border-radius:6px;background:#dc2626;color:#fff;cursor:pointer">✕ Reddet</button>
          </div>
        </div>
      `;

      row.querySelector(".btn-ogr-onayla").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = "...";
        const seciliSiniflar = Array.from(row.querySelectorAll(".sinif-cb:checked")).map(cb => cb.value);
        await kullaniciOnayla(u.uid, seciliSiniflar);
        row.remove();
        guncelleSayac();
        toast.basari(`${u.ad_soyad || u.email} onaylandı.`);
      });

      row.querySelector(".btn-ogr-reddet").addEventListener("click", async (e) => {
        if (!confirm(`"${u.ad_soyad || u.email}" reddedilsin mi?`)) return;
        const btn = e.currentTarget;
        btn.disabled = true;
        await kullaniciReddet(u.uid);
        row.remove();
        guncelleSayac();
        toast.bilgi(`${u.ad_soyad || u.email} reddedildi.`);
      });

      liste.appendChild(row);
    });

    function guncelleSayac() {
      const kalan = liste.querySelectorAll("[data-uid]").length;
      document.getElementById("ogretmen-sayac").textContent = kalan;
      if (kalan === 0) panel.remove();
    }
  } catch (e) {
    console.warn("Bekleyen öğretmenler yüklenemedi:", e);
  }
}

// ============================================================
// Admin: Kendi Hesabını Sil (tayin/devir durumu)
// ============================================================
function kurHesabimiSil(user, profil) {
  const headerActions = document.querySelector(".dash-header-actions");
  if (!headerActions) return;

  const silBtn = document.createElement("button");
  silBtn.className = "btn btn-outline btn-danger-ghost";
  silBtn.textContent = "Hesabımı Sil";

  silBtn.addEventListener("click", async () => {
    const onay = confirm(
      `Dikkat! "${profil.ad_soyad || user.email}" hesabınız kalıcı olarak silinecek.\n\n` +
      `Bu işlem geri alınamaz. Devam etmek istiyor musunuz?`
    );
    if (!onay) return;
    try {
      silBtn.disabled = true;
      silBtn.textContent = "Siliniyor...";
      await kullaniciSil(user.uid);
      await cikisYap();
      window.location.href = APP_BASE + "pages/login/index.html";
    } catch (e) {
      toast.hata("Hesap silinemedi: " + e.message);
      silBtn.disabled = false;
      silBtn.textContent = "Hesabımı Sil";
    }
  });

  headerActions.insertBefore(silBtn, document.getElementById("logout-btn"));
}

// ============================================================
// Kullanıcı Yönetimi Paneli (Superadmin)
// ============================================================
async function kurKullaniciYonetimiPaneli() {
  const main = document.querySelector(".dash-main");

  const panel = document.createElement("div");
  panel.id = "kullanici-yonetim-panel";
  panel.style.cssText = [
    "background:#f8fafc",
    "border:1px solid var(--neutral-200)",
    "border-radius:12px",
    "padding:1rem 1.25rem",
    "margin-bottom:1.25rem"
  ].join(";");

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
      <div style="font-weight:700;font-size:.92rem;color:var(--neutral-700)">
        👥 Kullanıcı Yönetimi
      </div>
      <button id="kullanici-yenile-btn" style="font-size:.78rem;padding:.25rem .65rem;border:1px solid var(--neutral-300);border-radius:6px;background:#fff;cursor:pointer">↻ Yenile</button>
    </div>
    <div id="kullanici-liste-container">
      <p style="font-size:.85rem;color:var(--neutral-400)">Yükleniyor...</p>
    </div>
  `;

  // Bekleyen panelin altına, veri tablosunun üstüne ekle
  const bekleyenPanel = document.getElementById("bekleyen-panel");
  if (bekleyenPanel) {
    bekleyenPanel.insertAdjacentElement("afterend", panel);
  } else {
    main.prepend(panel);
  }

  async function kullanicilariYukle() {
    const container = document.getElementById("kullanici-liste-container");
    container.innerHTML = '<p style="font-size:.85rem;color:var(--neutral-400)">Yükleniyor...</p>';
    try {
      const kullanicilar = await tumKullanicilariGetir();

      // Superadminleri listede gösterme — zaten bu panel onlar için
      const liste = kullanicilar.filter(u => u.role !== "superadmin");

      if (liste.length === 0) {
        container.innerHTML = '<p style="font-size:.85rem;color:var(--neutral-400)">Kayıtlı kullanıcı bulunamadı.</p>';
        return;
      }

      // Okula göre grupla
      const gruplar = {};
      liste.forEach(u => {
        const okulKey = u.okul_adi || u.okul_id || "— Okul belirtilmemiş —";
        if (!gruplar[okulKey]) gruplar[okulKey] = [];
        gruplar[okulKey].push(u);
      });

      const ROL_ETIKET = {
        superadmin: { txt: "Süperadmin",  stil: "background:#dbeafe;color:#1e40af" },
        admin:      { txt: "Yönetici",    stil: "background:#dcfce7;color:#166534" },
        ogretmen:   { txt: "Öğretmen",    stil: "background:#f0fdf4;color:#15803d" },
        beklemede:  { txt: "Beklemede",   stil: "background:#fef9c3;color:#92400e" },
        reddedildi: { txt: "Reddedildi",  stil: "background:#fee2e2;color:#991b1b" },
        "erisim-yok": { txt: "Erişim Yok", stil: "background:#f1f5f9;color:#64748b" },
      };

      // Tek tablo — okul grupları ara başlık satırı olarak eklenir, sütunlar hizalı kalır
      let html = `
        <div style="border:1px solid var(--neutral-200);border-radius:8px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem;table-layout:fixed">
            <colgroup>
              <col style="width:18%">
              <col style="width:26%">
              <col style="width:16%">
              <col style="width:11%">
              <col style="width:13%">
              <col style="width:16%">
            </colgroup>
            <thead>
              <tr style="background:var(--neutral-50);text-align:left">
                <th style="padding:.35rem .75rem;font-weight:600;color:var(--neutral-500)">Ad Soyad</th>
                <th style="padding:.35rem .75rem;font-weight:600;color:var(--neutral-500)">E-posta</th>
                <th style="padding:.35rem .75rem;font-weight:600;color:var(--neutral-500)">Telefon</th>
                <th style="padding:.35rem .75rem;font-weight:600;color:var(--neutral-500)">Rol</th>
                <th style="padding:.35rem .75rem;font-weight:600;color:var(--neutral-500)">Kayıt</th>
                <th style="padding:.35rem .75rem"></th>
              </tr>
            </thead>
            <tbody>
      `;

      Object.entries(gruplar).sort(([a],[b]) => a.localeCompare(b, "tr")).forEach(([okul, list]) => {
        // Okul grubu ara başlık satırı
        html += `
          <tr>
            <td colspan="6" style="padding:.3rem .75rem;background:var(--neutral-50);border-top:1px solid var(--neutral-200);
              font-size:.71rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--neutral-400)">
              ${okul}
            </td>
          </tr>
        `;

        list.forEach(u => {
          const rol = ROL_ETIKET[u.role] || { txt: u.role || "—", stil: "" };
          const _d = u.kayit_tarihi?.toDate?.() ??
            (typeof u.kayit_tarihi === "string" ? new Date(u.kayit_tarihi) : null);
          const tarih = _d && !isNaN(_d.getTime())
            ? new Intl.DateTimeFormat("tr-TR", { day:"2-digit", month:"2-digit", year:"numeric" }).format(_d)
            : "—";
          html += `
            <tr data-uid="${u.uid}" style="border-top:1px solid var(--neutral-100)">
              <td style="padding:.4rem .75rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.ad_soyad || "—"}</td>
              <td style="padding:.4rem .75rem;color:var(--neutral-500);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${u.email || ""}">${u.email || "—"}</td>
              <td style="padding:.4rem .75rem;white-space:nowrap">${u.telefon || "—"}</td>
              <td style="padding:.4rem .75rem">
                <span style="padding:.1rem .45rem;border-radius:999px;font-size:.75rem;font-weight:600;${rol.stil}">${rol.txt}</span>
              </td>
              <td style="padding:.4rem .75rem;color:var(--neutral-400);font-size:.78rem;white-space:nowrap">${tarih}</td>
              <td style="padding:.4rem .75rem;text-align:right">
                <button class="ku-sil-btn" data-uid="${u.uid}" data-adsoyad="${u.ad_soyad || u.email}"
                  style="font-size:.75rem;padding:.15rem .55rem;border:1px solid #fca5a5;border-radius:5px;background:#fff;color:#dc2626;cursor:pointer">
                  Sil
                </button>
              </td>
            </tr>
          `;
        });
      });

      html += `</tbody></table></div>`;

      container.innerHTML = html;

      // Silme butonları
      container.querySelectorAll(".ku-sil-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const uid      = btn.dataset.uid;
          const adSoyad  = btn.dataset.adsoyad;
          if (!confirm(`"${adSoyad}" kullanıcısı kalıcı olarak silinsin mi?`)) return;
          btn.disabled = true;
          try {
            await kullaniciSil(uid);
            btn.closest("tr").remove();
            toast.basari(`${adSoyad} silindi.`);
          } catch (e) {
            toast.hata("Kullanıcı silinemedi: " + e.message);
            btn.disabled = false;
          }
        });
      });

    } catch (e) {
      container.innerHTML = `<p style="font-size:.85rem;color:#dc2626">Kullanıcılar yüklenemedi: ${e.message}</p>`;
    }
  }

  document.getElementById("kullanici-yenile-btn").addEventListener("click", kullanicilariYukle);
  await kullanicilariYukle();
}

// ============================================================
// Veri Yükleme
// ============================================================
async function verileriYukle() {
  try {
    [tumOgrenciler, tumRibaYanitlari] = await Promise.all([
      tumOgrencileriGetir(),
      tumRibaYanitlariniGetir(),
    ]);
    ogrenciHaritalariniHazirla();
    ribaDurumSetleriniHazirla();
    await eksikRibaBayraklariniEsitle();
    istatistiklerGuncelle();
    sinifSelectleriniDoldur();
    tabloRenderla();
    if (typeof tabloRibaRenderla === 'function') tabloRibaRenderla();
  } catch (e) {
    toast.hata("Veriler yüklenemedi: " + e.message);
  }
}

// ============================================================
// İstatistikler
// ============================================================
function istatistiklerGuncelle() {
  const toplam   = tumOgrenciler.length;
  const dolu     = tumOgrenciler.filter(riskAnketDoldurulduMu).length;
  const bekleyen = toplam - dolu;
  const riskli   = tumOgrenciler.filter(o =>
    riskAnketDoldurulduMu(o) && (o.risk_skoru || 0) > 0
  ).length;

  document.getElementById("stat-toplam").textContent   = toplam;
  document.getElementById("stat-dolu").textContent     = dolu;
  document.getElementById("stat-bekleyen").textContent = bekleyen;
  document.getElementById("stat-riskli").textContent   = riskli;
}

// ============================================================
// Ana Sekme Navigasyonu (Risk Haritası | RİBA)
// ============================================================
function kurSekmeler() {
  document.querySelectorAll(".dash-main-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const panelId = tab.dataset.panel;
      // Tüm sekmeleri pasif yap
      document.querySelectorAll(".dash-main-tab").forEach(t => {
        t.classList.remove("aktif");
      });
      // Seçilen sekmeyi aktif yap
      tab.classList.add("aktif");

      // Panelleri göster/gizle
      ["panel-risk", "panel-riba"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === panelId ? "" : "none";
      });
    });
  });
}

// ============================================================
// RİBA Link Paneli
// ============================================================
function kurRibaLinkPaneli() {
  const sinifSelect = document.getElementById("riba-sinif-select");
  const kademeSelect = document.getElementById("riba-kademe-select");
  const turSelect   = document.getElementById("riba-tur-select");
  const linkBox     = document.getElementById("riba-link-box");
  const linkInput   = document.getElementById("riba-link-input");
  const copyBtn     = document.getElementById("riba-copy-btn");
  const wpBtn       = document.getElementById("riba-wp-btn");
  const sinifField  = sinifSelect.closest(".field");
  const kademeField = kademeSelect.closest(".field");

  // Sınıf selectini doldur (aynı siniflar dizisini kullan)
  const siniflar = [...new Set(tumOgrenciler.map(o => `${o.sinif}-${o.sube}`))].sort(sinifSirala);
  sinifSelect.innerHTML = siniflar.length
    ? '<option value="">— Sınıf Seçin —</option>'
    : '<option value="">— Önce öğrenci ekleyin —</option>';
  siniflar.forEach(s => sinifSelect.insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`));

  const kademeler = [...new Set(
    tumOgrenciler
      .map(o => siniftanKademeBul(`${o.sinif}-${o.sube}`))
      .filter(Boolean)
  )];
  kademeSelect.innerHTML = kademeler.length
    ? '<option value="">— Kademe Seçin —</option>'
    : '<option value="">— Kademe Bulunamadı —</option>';
  if (kademeler.includes("ortaokul")) {
    kademeSelect.insertAdjacentHTML("beforeend", '<option value="ortaokul">Ortaokul (5-8)</option>');
  }
  if (kademeler.includes("lise")) {
    kademeSelect.insertAdjacentHTML("beforeend", '<option value="lise">Lise (9-12)</option>');
  }
  if (kademeler.length === 1) {
    kademeSelect.value = kademeler[0];
  }

  const linkGuncelle = () => {
    const sinif = sinifSelect.value;
    const tur   = turSelect.value;
    const ogretmenModu = tur === "ogretmen";
    const kademe = ogretmenModu ? kademeSelect.value : null;

    if (sinifField) {
      sinifField.style.display = ogretmenModu ? "none" : "";
    }
    if (kademeField) {
      kademeField.style.display = ogretmenModu ? "" : "none";
    }

    if (!tur || (!ogretmenModu && !sinif) || (ogretmenModu && !kademe)) {
      linkBox.classList.add("hidden");
      return;
    }

    const query = new URLSearchParams({
      tur,
      okul: window.__okulCtx?.okul_id || "",
    });
    if (ogretmenModu) {
      query.set("kademe", kademe);
    } else {
      query.set("sinif", sinif);
    }

    const url = `${APP_BASE}pages/riba/index.html?${query.toString()}`;
    linkInput.value = url;

    const turEtiketi = { ogrenci: "Öğrenci Anketi", veli: "Veli Anketi", ogretmen: "Öğretmen Anketi" };
    const hedefMetni = ogretmenModu
      ? `${kademe === "lise" ? "lise" : "ortaokul"} kademesi için`
      : `${sinif} sınıfı için`;
    wpBtn.href = `https://wa.me/?text=${encodeURIComponent(
      `Sayın ${tur === "veli" ? "Veli" : tur === "ogrenci" ? "Öğrenci" : "Öğretmen"}, ` +
      `${hedefMetni} RİBA ${turEtiketi[tur]} için lütfen tıklayın:\n${url}`
    )}`;
    linkBox.classList.remove("hidden");
  };

  sinifSelect.addEventListener("change", linkGuncelle);
  kademeSelect.addEventListener("change", linkGuncelle);
  turSelect.addEventListener("change",   linkGuncelle);
  linkGuncelle();

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(linkInput.value).then(() => {
      toast.basari("RİBA linki panoya kopyalandı!");
    }).catch(() => {
      linkInput.select();
      document.execCommand("copy");
      toast.basari("RİBA linki kopyalandı!");
    });
  });
}

// ============================================================
// Sınıf Selectlerini Doldur
// ============================================================
function sinifSelectleriniDoldur() {
  const siniflar = [...new Set(tumOgrenciler.map(o => `${o.sinif}-${o.sube}`))].sort(sinifSirala);

  const sinifSelect  = document.getElementById("sinif-select");
  const filtreSelect = document.getElementById("filtre-sinif");
  const ribaFiltreSelect = document.getElementById("filtre-riba-sinif");

  sinifSelect.innerHTML  = siniflar.length
    ? '<option value="">— Sınıf Seçin —</option>'
    : '<option value="">— Önce öğrenci ekleyin —</option>';

  filtreSelect.innerHTML = '<option value="">Tüm Sınıflar</option>';
  if (ribaFiltreSelect) ribaFiltreSelect.innerHTML = '<option value="">Tüm Sınıflar</option>';

  siniflar.forEach(s => {
    sinifSelect.insertAdjacentHTML("beforeend",  `<option value="${s}">${s}</option>`);
    filtreSelect.insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`);
    if (ribaFiltreSelect) ribaFiltreSelect.insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`);
  });
}

// ============================================================
// Tablo Render
// ============================================================
function tabloRenderla(sinifFiltre = "", durumFiltre = "") {
  const tbody = document.getElementById("tablo-body");

  let liste = [...tumOgrenciler];
  if (sinifFiltre) liste = liste.filter(o => `${o.sinif}-${o.sube}` === sinifFiltre);
  if (durumFiltre === "bekleyen") liste = liste.filter(o => !riskAnketDoldurulduMu(o));
  if (durumFiltre === "dolu")     liste = liste.filter(riskAnketDoldurulduMu);
  if (durumFiltre === "riskli")   liste = liste.filter(o =>
    riskAnketDoldurulduMu(o) && (o.risk_skoru || 0) > 0
  );

  // Sınıfa göre sayısal sırala, aynı sınıfta ada göre
  liste.sort((a, b) => {
    const sc = sinifSirala(`${a.sinif}-${a.sube}`, `${b.sinif}-${b.sube}`);
    if (sc !== 0) return sc;
    return `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr");
  });

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="tablo-bos">Gösterilecek öğrenci bulunamadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = liste.map(o => {
    const riskSayisi = riskAnketDoldurulduMu(o)
      ? (o.risk_skoru || 0)
      : null;

    const formBadge = riskAnketDoldurulduMu(o)
      ? `<span class="badge badge-success">Dolu</span>`
      : `<span class="badge badge-warning">Bekliyor</span>`;

    const riskBadge = riskSayisi === null
      ? `<span class="badge badge-neutral">—</span>`
      : riskSayisi > 0
        ? `<span class="badge badge-danger">${riskSayisi} risk</span>`
        : `<span class="badge badge-success">Yok</span>`;

    const detayBtn = riskAnketDoldurulduMu(o)
      ? `<button class="btn btn-sm btn-outline" onclick="window._riskDetay('${o.id}')">Detay</button>`
      : `<span style="color:var(--neutral-300);font-size:.8rem">—</span>`;

    return `
      <tr>
        <td>${ogrenciNoGetir(o)}</td>
        <td style="font-weight:600">${o.ad} ${o.soyad}</td>
        <td>${o.sinif}-${o.sube}</td>
        <td>${o.cinsiyet === 'E' ? 'Erkek' : o.cinsiyet === 'K' ? 'Kız' : '—'}</td>
        <td>${formBadge}</td>
        <td>${riskBadge}</td>
        <td>${detayBtn}</td>
      </tr>
    `;
  }).join("");
}

// ============================================================
// Filtreler
// ============================================================
function kurFiltreler() {
  const sinifFiltre     = document.getElementById("filtre-sinif");
  const durumFiltre     = document.getElementById("filtre-durum");
  const riskHaritasiBtn = document.getElementById("risk-haritasi-btn");

  const guncelle = () => {
    const sinif = sinifFiltre.value;
    tabloRenderla(sinif, durumFiltre.value);
    riskHaritasiBtn.disabled = !sinif;
  };
  sinifFiltre.addEventListener("change", guncelle);
  durumFiltre.addEventListener("change", () => tabloRenderla(sinifFiltre.value, durumFiltre.value));

  riskHaritasiBtn.addEventListener("click", () => {
    const sinif = sinifFiltre.value;
    if (sinif) riskHaritasiIndir(sinif);
  });
}

// ============================================================
// RIBA Tablo Render
// ============================================================
function tabloRibaRenderla(sinifFiltre = "", durumFiltre = "") {
  const tbody = document.getElementById("riba-tablo-body");

  let liste = [...tumOgrenciler];
  if (sinifFiltre) liste = liste.filter(o => `${o.sinif}-${o.sube}` === sinifFiltre);

  if (durumFiltre === "bekleyen-ogrenci") {
    liste = liste.filter(o => !ogrenciRibaTamamlandiMi(o, "ogrenci"));
  } else if (durumFiltre === "dolu-ogrenci") {
    liste = liste.filter(o => ogrenciRibaTamamlandiMi(o, "ogrenci"));
  } else if (durumFiltre === "bekleyen-veli") {
    liste = liste.filter(o => !ogrenciRibaTamamlandiMi(o, "veli"));
  } else if (durumFiltre === "dolu-veli") {
    liste = liste.filter(o => ogrenciRibaTamamlandiMi(o, "veli"));
  } else if (durumFiltre === "dolu-tum") {
    liste = liste.filter(o => ogrenciRibaTamamlandiMi(o, "ogrenci") && ogrenciRibaTamamlandiMi(o, "veli"));
  }

  // Sınıfa göre sayısal sırala, aynı sınıfta ada göre
  liste.sort((a, b) => {
    const sc = sinifSirala(`${a.sinif}-${a.sube}`, `${b.sinif}-${b.sube}`);
    if (sc !== 0) return sc;
    return `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr");
  });

  if (liste.length === 0) {
    if(tbody) tbody.innerHTML = `<tr><td colspan="5" class="tablo-bos">Gösterilecek öğrenci bulunamadı.</td></tr>`;
    return;
  }

  if(tbody) {
    tbody.innerHTML = liste.map(o => {
      const ogrenciBadge = ogrenciRibaTamamlandiMi(o, "ogrenci")
        ? `<span class="badge badge-success">Dolu</span>`
        : `<span class="badge badge-warning">Bekliyor</span>`;
        
      const veliBadge = ogrenciRibaTamamlandiMi(o, "veli")
        ? `<span class="badge badge-success">Dolu</span>`
        : `<span class="badge badge-warning">Bekliyor</span>`;

      return `
        <tr>
          <td>${ogrenciNoGetir(o)}</td>
          <td style="font-weight:600">${o.ad} ${o.soyad}</td>
          <td>${o.sinif}-${o.sube}</td>
          <td>${ogrenciBadge}</td>
          <td>${veliBadge}</td>
        </tr>
      `;
    }).join("");
  }
}

function kurRibaFiltreler() {
  const sinifFiltre = document.getElementById("filtre-riba-sinif");
  const durumFiltre = document.getElementById("filtre-riba-durum");
  if (!sinifFiltre || !durumFiltre) return;

  const guncelle = () => {
    tabloRibaRenderla(sinifFiltre.value, durumFiltre.value);
  };
  sinifFiltre.addEventListener("change", guncelle);
  durumFiltre.addEventListener("change", guncelle);
}

// ============================================================
// Veli Form Link Üretici
// ============================================================
function kurLinkPaneli() {
  const sinifSelect = document.getElementById("sinif-select");
  const linkBox     = document.getElementById("link-box");
  const linkInput   = document.getElementById("link-input");
  const copyBtn     = document.getElementById("copy-btn");
  const wpBtn       = document.getElementById("wp-btn");

  sinifSelect.addEventListener("change", () => {
    const sinif = sinifSelect.value;
    if (!sinif) { linkBox.classList.add("hidden"); return; }

    const url = `${APP_BASE}pages/form/index.html?sinif=${encodeURIComponent(sinif)}&okul=${encodeURIComponent(window.__okulCtx?.okul_id || '')}`;
    linkInput.value = url;
    wpBtn.href = `https://wa.me/?text=${encodeURIComponent(
      `Sayın Veli, ${sinif} sınıfı aile durum formunu doldurmak için lütfen tıklayın:\n${url}`
    )}`;
    linkBox.classList.remove("hidden");
  });

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(linkInput.value).then(() => {
      toast.basari("Link panoya kopyalandı!");
    }).catch(() => {
      linkInput.select();
      document.execCommand("copy");
      toast.basari("Link kopyalandı!");
    });
  });
}

// ============================================================
// Risk Detay Modalı
// ============================================================
function kurModal() {
  const modal    = document.getElementById("risk-modal");
  const kapatBtn = document.getElementById("modal-kapat");
  const footer   = document.getElementById("modal-footer");

  const kapat = () => { modal.classList.add("hidden"); footer.style.display = "none"; };
  kapatBtn.addEventListener("click", kapat);
  modal.addEventListener("click", (e) => { if (e.target === modal) kapat(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") kapat(); });

  document.getElementById("modal-kaydet").addEventListener("click", () => {
    const id = document.getElementById("modal-kaydet").dataset.ogrId;
    if (id) window._idareKaydet(id);
  });

  document.getElementById("modal-ogrenci-sil")?.addEventListener("click", async () => {
    const id = document.getElementById("modal-kaydet").dataset.ogrId;
    if (!id) return;
    const ogr = tumOgrenciler.find(o => o.id === id);
    const adSoyad = ogr ? `${ogr.ad} ${ogr.soyad}` : "Seçili öğrenci";
    if (!confirm(`"${adSoyad}" isimli öğrenciyi ve bu öğrenciye ait tüm risk kayıtlarını kalıcı olarak silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await tekOgrenciSil(id, window.__okulCtx?.okul_id);
      toast.basari(`${adSoyad} başarıyla silindi.`);
      kapat();
      await verileriYukle();
    } catch (e) {
      toast.hata("Öğrenci silinemedi: " + (e.message || e));
    }
  });
}

/**
 * Yeni Eğitim Yılı için tüm okul verilerini (öğrenciler, riba yanıtları, risk haritaları)
 * sıfırlama modalını ve onay akışını yönetir.
 */
function kurTumVerileriSilModal() {
  const btn = document.getElementById("btn-tum-verileri-sil");
  const modal = document.getElementById("tum-sil-modal");
  const kapatBtn = document.getElementById("tum-sil-kapat");
  const iptalBtn = document.getElementById("tum-sil-iptal-btn");
  const onayBtn = document.getElementById("tum-sil-onay-btn");
  const onayInput = document.getElementById("tum-sil-onay-input");
  const progressWrap = document.getElementById("tum-sil-progress-wrap");
  const progressBar = document.getElementById("tum-sil-progress-bar");
  const progressText = document.getElementById("tum-sil-progress-text");

  const sayiOgrenci = document.getElementById("sil-sayi-ogrenci");
  const sayiRiba = document.getElementById("sil-sayi-riba");
  const sayiRisk = document.getElementById("sil-sayi-risk");

  if (!btn || !modal) return;

  const modalKapat = () => {
    modal.classList.add("hidden");
    if (onayInput) onayInput.value = "";
    if (onayBtn) {
      onayBtn.disabled = true;
      onayBtn.textContent = "🗑️ Tüm Verileri Kalıcı Olarak Sil";
    }
    if (iptalBtn) iptalBtn.disabled = false;
    if (onayInput) onayInput.disabled = false;
    if (progressWrap) progressWrap.classList.add("hidden");
    if (progressBar) progressBar.style.width = "0%";
  };

  kapatBtn?.addEventListener("click", modalKapat);
  iptalBtn?.addEventListener("click", modalKapat);
  modal.addEventListener("click", (e) => { if (e.target === modal) modalKapat(); });

  btn.addEventListener("click", async () => {
    modal.classList.remove("hidden");
    if (onayInput) {
      onayInput.value = "";
      onayInput.disabled = false;
    }
    if (onayBtn) onayBtn.disabled = true;
    if (iptalBtn) iptalBtn.disabled = false;
    if (progressWrap) progressWrap.classList.add("hidden");

    if (sayiOgrenci) sayiOgrenci.textContent = "Hesaplanıyor...";
    if (sayiRiba) sayiRiba.textContent = "Hesaplanıyor...";
    if (sayiRisk) sayiRisk.textContent = "Hesaplanıyor...";

    try {
      const sayilar = await okulVeriSayilariniGetir(window.__okulCtx?.okul_id);
      if (sayiOgrenci) sayiOgrenci.textContent = `${sayilar.ogrenciSayisi} Öğrenci Kaydı`;
      if (sayiRiba) sayiRiba.textContent = `${sayilar.ribaSayisi} Anket Yanıtı`;
      if (sayiRisk) sayiRisk.textContent = `${sayilar.riskSayisi} Risk Haritası Kaydı`;
    } catch (_) {
      if (sayiOgrenci) sayiOgrenci.textContent = `${tumOgrenciler.length} Öğrenci`;
      if (sayiRiba) sayiRiba.textContent = `${tumRibaYanitlari.length} Anket Yanıtı`;
      if (sayiRisk) sayiRisk.textContent = "Mevcut tüm kayıtlar";
    }

    onayInput?.focus();
  });

  onayInput?.addEventListener("input", () => {
    const val = (onayInput.value || "").trim().toLocaleUpperCase("tr");
    if (onayBtn) onayBtn.disabled = (val !== "SİL");
  });

  onayBtn?.addEventListener("click", async () => {
    const val = (onayInput.value || "").trim().toLocaleUpperCase("tr");
    if (val !== "SİL") return;

    try {
      onayBtn.disabled = true;
      onayBtn.textContent = "Siliniyor...";
      if (iptalBtn) iptalBtn.disabled = true;
      if (onayInput) onayInput.disabled = true;
      if (progressWrap) progressWrap.classList.remove("hidden");

      await tumOkulVerileriniSil(window.__okulCtx?.okul_id, (msg, pct) => {
        if (progressText) progressText.textContent = msg;
        if (progressBar) progressBar.style.width = `${pct}%`;
      });

      toast.basari("Tüm öğrenci, risk haritası ve RİBA kayıtları başarıyla silindi! Yeni eğitim yılı için hazır.");
      modalKapat();
      await verileriYukle();
    } catch (err) {
      console.error(err);
      toast.hata("Veriler silinirken hata oluştu: " + (err.message || err));
      if (progressText) progressText.textContent = "❌ Hata: " + (err.message || err);
      if (onayBtn) {
        onayBtn.disabled = false;
        onayBtn.textContent = "🗑️ Tekrar Dene";
      }
      if (iptalBtn) iptalBtn.disabled = false;
      if (onayInput) onayInput.disabled = false;
    }
  });
}

// Global — tablo innerHTML içindeki onclick'ten çağrılır
window._riskDetay = function (id) {
  const ogr = tumOgrenciler.find(o => o.id === id);
  if (!ogr) return;

  document.getElementById("modal-title").textContent =
    `${ogr.ad} ${ogr.soyad} — Risk Detayı`;

  const formR        = ogr.risk_detaylari || {};
  const idareR       = ogr.idare_notlari  || {};
  const engelDurumu  = ogr.engel_durumu   || [];
  // not_ortalamasi: undefined = notlar hiç yüklenmedi
  //                  null     = PDF yüklendi ama bu öğrencide sayısal değer yok (not yok)
  //                  number   = gerçek ortalama
  const notOrtalamasi = ogr.not_ortalamasi; // undefined ile null ayrımı korunur

  const formHTML = Object.entries(FORM_RISKLER).map(([key, label]) => {
    const aktif = !!formR[key];
    return `
      <div class="risk-item ${aktif ? "aktif" : "pasif"}">
        <span class="risk-item-icon">${aktif ? "⚠" : "✓"}</span>
        <span>${label}</span>
      </div>
    `;
  }).join("");

  // e-Okul özel eğitim listesinden gelen engel türleri bilgi kutusu
  const engelBilgiHTML = engelDurumu.length > 0
    ? `<div style="margin-bottom:.75rem;padding:.75rem 1rem;background:#fef9c3;border:1px solid #fde047;border-radius:8px">
        <p style="font-size:.72rem;font-weight:700;color:#713f12;margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.05em">📋 e-Okul Özel Eğitim Listesinden</p>
        <div style="display:flex;flex-wrap:wrap;gap:.3rem">
          ${engelDurumu.map(e =>
            `<span style="background:#fde047;color:#713f12;padding:.15rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600">${e}</span>`
          ).join("")}
        </div>
      </div>`
    : "";

  // e-Okul not ortalaması bilgi kutusu
  // notOrtalamasi === undefined → PDF hiç yüklenmedi, kutu gösterme
  // notOrtalamasi === null      → PDF yüklendi ama sayısal değer yok (notu yok)
  // notOrtalamasi === number    → gerçek ortalama
  const notYuklendi = notOrtalamasi !== undefined;
  const notDusuk    = notOrtalamasi === null || (typeof notOrtalamasi === "number" && notOrtalamasi < 70);
  const notBilgiHTML = notYuklendi
    ? `<div style="margin-bottom:.75rem;padding:.75rem 1rem;background:${notDusuk ? "#fee2e2" : "#f0fdf4"};border:1px solid ${notDusuk ? "#fca5a5" : "#86efac"};border-radius:8px">
        <p style="font-size:.72rem;font-weight:700;color:${notDusuk ? "#991b1b" : "#166534"};margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.05em">📊 e-Okul Not Ortalaması Listesinden</p>
        ${notOrtalamasi !== null
          ? `<span style="background:${notDusuk ? "#fca5a5" : "#86efac"};color:${notDusuk ? "#7f1d1d" : "#14532d"};padding:.15rem .65rem;border-radius:999px;font-size:.85rem;font-weight:700">${notOrtalamasi.toFixed(2).replace(".", ",")}</span>
             ${notDusuk ? '<span style="font-size:.78rem;color:#991b1b;font-weight:600;margin-left:.4rem">▼ 70 altında</span>' : ""}`
          : '<span style="background:#fca5a5;color:#7f1d1d;padding:.15rem .65rem;border-radius:999px;font-size:.85rem;font-weight:700">— Notu yok</span><span style="font-size:.78rem;color:#991b1b;font-weight:600;margin-left:.4rem">▼ Akademik düşük</span>'
        }
      </div>`
    : "";

  const idareHTML = Object.entries(IDARE_RISKLER).map(([key, label]) => {
    const checked = !!idareR[key];
    // Özel eğitim veya özel yetenekli otomatik işaretliyse açıklama ekle
    const otomatikOzelEgitim = checked && (
      (key === "ozel_egitim"    && engelDurumu.some(e => !/özel yetenek/i.test(e))) ||
      (key === "ozel_yetenekli" && engelDurumu.some(e => /özel yetenek/i.test(e)))
    );
    // Akademik başarısı düşük e-Okul'dan otomatik işaretlendiyse açıklama ekle
    // notYuklendi + (null ortalama VEYA < 70) → e-Okul'dan geldiği kesin
    const otomatikAkademik  = checked && key === "akademik_dusuk" && notYuklendi && notDusuk;
    // Disiplin cezası e-Okul not PDF'inden otomatik işaretlendiyse açıklama ekle
    const otomatikDisiplin  = checked && key === "disiplin_cezasi" && notYuklendi;
    const otomatik = otomatikOzelEgitim || otomatikAkademik || otomatikDisiplin;
    return `
      <label style="display:flex;align-items:center;gap:.5rem;padding:.5rem 0;cursor:pointer;border-bottom:1px solid #f1f5f9">
        <input type="checkbox" class="idare-toggle-cb" data-key="${key}" ${checked ? "checked" : ""} />
        <span style="font-size:.9rem">${label}${otomatik ? ' <span style="font-size:.72rem;color:#92400e;font-weight:600">(e-Okul)</span>' : ""}</span>
      </label>
    `;
  }).join("");

  document.getElementById("modal-body").innerHTML = `
    <div style="margin-bottom:1rem">
      <p style="font-size:.78rem;text-transform:uppercase;color:var(--neutral-400);margin-bottom:.5rem;letter-spacing:.05em">Form'dan Gelen Riskler (Otomatik)</p>
      ${formHTML}
    </div>
    <div>
      <p style="font-size:.78rem;text-transform:uppercase;color:var(--neutral-400);margin-bottom:.4rem;letter-spacing:.05em">İdare Notları</p>
      ${engelBilgiHTML}
      ${notBilgiHTML}
      ${idareHTML}
    </div>
  `;

  const footer = document.getElementById("modal-footer");
  footer.style.display = "block";
  document.getElementById("modal-kaydet").dataset.ogrId = id;

  document.getElementById("risk-modal").classList.remove("hidden");
};

// Global — İdare notlarını kaydet
window._idareKaydet = async function (id) {
  const checkboxes = document.querySelectorAll("#modal-body .idare-toggle-cb");
  const notlar = {};
  checkboxes.forEach(cb => { notlar[cb.dataset.key] = cb.checked; });

  const kaydetBtn = document.getElementById("modal-kaydet");
  try {
    kaydetBtn.disabled    = true;
    kaydetBtn.textContent = "Kaydediliyor...";
    await idareNotlariKaydet(id, notlar);

    const ogr = tumOgrenciler.find(o => o.id === id);
    if (ogr) {
      ogr.idare_notlari = notlar;
      const formRiskSayisi  = Object.values(ogr.risk_detaylari || {}).filter(Boolean).length;
      const idareRiskSayisi = Object.values(notlar).filter(Boolean).length;
      ogr.risk_skoru = formRiskSayisi + idareRiskSayisi;
    }

    istatistiklerGuncelle();
    tabloRenderla(
      document.getElementById("filtre-sinif").value,
      document.getElementById("filtre-durum").value
    );
    toast.basari("İdare notları kaydedildi.");
  } catch (e) {
    toast.hata("Kaydedilemedi: " + e.message);
  } finally {
    kaydetBtn.disabled    = false;
    kaydetBtn.textContent = "İdare Notlarını Kaydet";
  }
};

// ============================================================
// Risk Haritası — Öğrenci verisinden sütun boolean'larını türet
// Şablon sütun sırası (G=6 … AP=41):
//  G(6)  Anne en fazla ilkokul mezunu
//  H(7)  Baba en fazla ilkokul mezunu
//  I(8)  Tek çocuk
//  J(9)  5 ve üstü kardeş
//  K(10) Anne-baba ayrı yaşıyor (boşanmamış)
//  L(11) Anne-baba boşanmış
//  M(12) Yalnız anne ile yaşıyor
//  N(13) Yalnız baba ile yaşıyor
//  O(14) Annesi vefat
//  P(15) Babası vefat
//  Q(16) Anne ve babası vefat
//  R(17) Şehit çocuğu                  ← idare işaretler
//  S(18) Büyükanne/büyükbaba yanında
//  T(19) Diğer akraba yanında
//  U(20) Koruyucu aile gözetiminde
//  V(21) Sevgi Evlerinde kalan
//  W(22) SHÇEK'te kalan
//  X(23) Ailesinde süreğen hastalık
//  Y(24) Ailesinde ruhsal hastalık
//  Z(25) Ailesinde bağımlı bireyler
// AA(26) Ailede cezai hüküm
// AB(27) Ailesi mevsimlik işçi
// AC(28) Aile içi şiddete maruz kalan  ← idare
// AD(29) Özel yetenekli                ← idare
// AE(30) Özel eğitim raporu            ← idare
// AF(31) Süreğen hastalığı olan (öğrenci)
// AG(32) Ruhsal hastalığı olan (öğrenci)
// AH(33) Danışmanlık tedbir kararı     ← idare
// AI(34) Eğitim tedbir kararı          ← idare
// AJ(35) Maddi sıkıntı yaşayan
// AK(36) Sürekli devamsız              ← idare
// AL(37) Bir işte çalışan              ← idare
// AM(38) Akademik başarısı düşük       ← idare
// AN(39) Riskli akran grubuna dahil    ← idare
// AO(40) Yabancı uyruklu
// AP(41) Diğer                         ← boş
// ============================================================
function veriTuret(o) {
  const fv = o.form_verisi    || {};
  const fR = o.risk_detaylari || {};
  const iR = o.idare_notlari  || {};
  const veli    = fv.veli_bilgileri || {};
  const anne    = veli.anne         || {};
  const baba    = veli.baba         || {};
  const bakim   = veli.bakim_veren  || {};
  const kurum   = veli.kurum        || {};

  const ILKOKUL_ALTI = ["İlkokul", "Okur-yazar değil"];
  const BUYUKANNE_BUYUKBABA = [
    "buyukanne_anne", "buyukanne_baba",
    "buyukbaba_anne", "buyukbaba_baba",
  ];

  const aileYapisi = veli.aile_yapisi || null;
  const yasamYeri  = veli.yasam_yeri  || null;
  const ayriSebep  = veli.ayri_sebep  || null;
  const yakinlik   = bakim.yakinlik   || null;

  const kardes = typeof fv.kardes_sayisi === "number" ? fv.kardes_sayisi : null;

  return [
    /* G  6  */ ILKOKUL_ALTI.includes(anne.egitim),
    /* H  7  */ ILKOKUL_ALTI.includes(baba.egitim),
    /* I  8  */ kardes === 0,
    /* J  9  */ kardes !== null && kardes >= 5,
    /* K 10  */ aileYapisi === "ayri" && ayriSebep !== "bosanmis",
    /* L 11  */ aileYapisi === "ayri" && ayriSebep === "bosanmis",
    /* M 12  */ yasamYeri === "anne",
    /* N 13  */ yasamYeri === "baba",
    /* O 14  */ aileYapisi === "anne_vefat" || aileYapisi === "ikisi_vefat",
    /* P 15  */ aileYapisi === "baba_vefat" || aileYapisi === "ikisi_vefat",
    /* Q 16  */ aileYapisi === "ikisi_vefat",
    /* R 17  */ !!iR.sehit_cocugu,
    /* S 18  */ yasamYeri === "akraba" && BUYUKANNE_BUYUKBABA.includes(yakinlik),
    /* T 19  */ yasamYeri === "akraba" && !BUYUKANNE_BUYUKBABA.includes(yakinlik) && yakinlik !== "koruyucu_aile",
    /* U 20  */ yasamYeri === "akraba" && yakinlik === "koruyucu_aile",
    /* V 21  */ yasamYeri === "kurum"  && kurum.tur === "sevgi_evi",
    /* W 22  */ yasamYeri === "kurum"  && kurum.tur === "shcek",
    /* X 23  */ !!fR.aile_suregen,
    /* Y 24  */ !!fR.aile_ruhsal,
    /* Z 25  */ !!fR.aile_bagimlilik,
    /* AA 26 */ !!fR.cezai_hukum,
    /* AB 27 */ !!fR.mevsimlik_isci,
    /* AC 28 */ !!iR.aile_ici_siddet,
    /* AD 29 */ !!iR.ozel_yetenekli,
    /* AE 30 */ !!iR.ozel_egitim,
    /* AF 31 */ !!fR.suregen_hastalik,
    /* AG 32 */ !!fR.ruhsal_hastalik,
    /* AH 33 */ !!iR.danismanlik_tedbir,
    /* AI 34 */ !!iR.egitim_tedbir,
    /* AJ 35 */ !!fR.maddi_sikinti,
    /* AK 36 */ !!iR.devamsiz,
    /* AL 37 */ !!iR.bir_iste_calisan,
    /* AM 38 */ !!iR.akademik_dusuk,
    /* AN 39 */ !!iR.riskli_akran,
    /* AO 40 */ fv.uyruk !== null && fv.uyruk !== undefined && fv.uyruk !== "TC",
    /* AP 41 */ false,
  ];
}

// ============================================================
// Risk Haritası Excel İndir — JSZip tabanlı (şablonu boz madan)
// ============================================================
async function riskHaritasiIndir(sinif) {
  const liste = tumOgrenciler
    .filter(o => `${o.sinif}-${o.sube}` === sinif)
    .sort((a, b) => Number(ogrenciNoGetir(a)) - Number(ogrenciNoGetir(b)));

  if (!liste.length) {
    toast.uyari("Seçili sınıfta öğrenci bulunamadı.");
    return;
  }

  // 0-tabanlı sütun indeksi → harf (0=A, 25=Z, 26=AA…)
  const colLetter = (i) => {
    let s = "", n = i + 1;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  // Harf → 0-tabanlı indeks
  const colIndex = (l) => { let x = 0; for (const ch of l) x = x * 26 + ch.charCodeAt(0) - 64; return x - 1; };

  try {
    const templatePath = new URL("../../tools/Templates/risk_template.xlsx", import.meta.url).href;
    const response = await fetch(templatePath);
    if (!response.ok) throw new Error(`Şablon yüklenemedi (HTTP ${response.status})`);

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Sheet XML
    const sheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
    const parser   = new DOMParser();
    const doc      = parser.parseFromString(sheetXml, "application/xml");
    const NS       = doc.documentElement.namespaceURI ||
                     "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

    const sheetData = doc.getElementsByTagName("sheetData")[0];
    const allRows   = Array.from(doc.getElementsByTagName("row"));

    // Veri başlangıç satırı: şablonda sabit 6. Excel satırı
    const dataStart = 6;

    // Her veri satırının hücre stillerini şablondan oku (sütun bazında)
    // Birden fazla satırı kontrol et — ilk dolu stili al
    const styleByCol = {};
    for (const excelRow of [6, 7, 8]) {
      const tmplRow = allRows.find(r => parseInt(r.getAttribute("r"), 10) === excelRow);
      if (!tmplRow) continue;
      Array.from(tmplRow.getElementsByTagName("c")).forEach(c => {
        const col = (c.getAttribute("r") || "").replace(/\d+$/, "");
        if (!styleByCol[col] && c.getAttribute("s")) styleByCol[col] = c.getAttribute("s");
      });
    }

    // Satırı bul — şablonda zaten var, sadece hücrelerini güncelle
    const getRow = (excelNum) => {
      return allRows.find(r => parseInt(r.getAttribute("r"), 10) === excelNum) || null;
    };

    // Hücre yaz: şablondaki hücre varsa değerini güncelle (stile dokunma),
    // yoksa yeni hücre ekle ve şablon stilini uygula
    const setCell = (row, col, value, isNum = false) => {
      const rn  = row.getAttribute("r");
      const ref = `${col}${rn}`;
      const ci  = colIndex(col);
      let cell  = Array.from(row.getElementsByTagName("c"))
                    .find(c => c.getAttribute("r") === ref);
      const isNew = !cell;
      if (isNew) {
        cell = doc.createElementNS(NS, "c");
        cell.setAttribute("r", ref);
        const next = Array.from(row.getElementsByTagName("c"))
          .find(c => colIndex((c.getAttribute("r") || "A").replace(/\d+$/, "")) > ci);
        row.insertBefore(cell, next || null);
        // Yeni hücre için şablondan stili uygula
        const s = styleByCol[col];
        if (s) cell.setAttribute("s", s);
      }
      // Mevcut hücrenin içeriğini temizle ve yeni değeri yaz
      while (cell.firstChild) cell.removeChild(cell.firstChild);
      if (isNum) {
        cell.removeAttribute("t");
        const v = doc.createElementNS(NS, "v"); v.textContent = String(value); cell.appendChild(v);
      } else {
        cell.setAttribute("t", "inlineStr");
        const is = doc.createElementNS(NS, "is");
        const t  = doc.createElementNS(NS, "t"); t.textContent = String(value);
        is.appendChild(t); cell.appendChild(is);
      }
    };

    // Öğrencileri yaz
    liste.forEach((o, idx) => {
      const row = getRow(dataStart + idx);
      if (!row) return; // şablonda bu satır yoksa atla
      const kollar = veriTuret(o);
      setCell(row, "C", idx + 1, true);
      setCell(row, "D", `${o.sinif}-${o.sube}`);
      setCell(row, "E", ogrenciNoGetir(o));
      setCell(row, "F", `${o.ad} ${o.soyad}`);
      kollar.forEach((aktif, i) => { if (aktif) setCell(row, colLetter(6 + i), "+"); });
    });

    // Serialize et, xmlns="" artifactlarını temizle
    let newXml = new XMLSerializer().serializeToString(doc);
    newXml = newXml.replace(/ xmlns=""/g, "");
    zip.file("xl/worksheets/sheet1.xml", newXml);

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const tarih = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `Risk_Haritasi_${sinif}_${tarih}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.basari("Risk haritası indirildi.");

  } catch (err) {
    console.error(err);
    toast.hata("İndirme hatası: " + err.message);
  }
}
