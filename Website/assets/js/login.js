// ============================================================
// pages/login/login.js
// Admin giriş ve kayıt sayfası mantığı.
// ============================================================

import {
  adminGirisYap,
  authDurumDinle,
  kullaniciKayitOl,
  okulAdminVarMi,
  sifreSifirlamaMailiGonder
} from "./auth.service.js";

// ---------- DOM Referansları (Giriş) ----------
const form        = document.getElementById("login-form");
const emailInput  = document.getElementById("email");
const passInput   = document.getElementById("password");
const loginBtn    = document.getElementById("login-btn");
const errorBox    = document.getElementById("login-error");
const errorText   = document.getElementById("error-text");
const emailError  = document.getElementById("email-error");
const passError   = document.getElementById("password-error");

// ---------- DOM Referansları (Kayıt) ----------
const regForm         = document.getElementById("register-form");
const regBtn          = document.getElementById("register-btn");
const regError        = document.getElementById("register-error");
const regErrorText    = document.getElementById("register-error-text");
const regSuccess      = document.getElementById("register-success");
const regPassInput    = document.getElementById("reg-password");
const regKurumKoduEl  = document.getElementById("reg-kurum-kodu");
const regOkulAdiEl    = document.getElementById("reg-okul-adi");
const regRolContainer = document.getElementById("reg-rol-container");
const regKontrolMesaj = document.getElementById("reg-okul-kontrol-mesaj");

// ---------- Sekme Geçişi ----------
const tabGiris   = document.getElementById("tab-giris");
const tabKayit   = document.getElementById("tab-kayit");
const panelGiris = document.getElementById("panel-giris");
const panelKayit = document.getElementById("panel-kayit");

// ---------- DOM Referansları (Şifremi Unuttum) ----------
const forgotLink       = document.getElementById("link-sifremi-unuttum");
const forgotOverlay    = document.getElementById("forgot-overlay");
const forgotClose      = document.getElementById("forgot-close");
const forgotBackLogin  = document.getElementById("forgot-back-to-login");
const forgotDone       = document.getElementById("forgot-done");
const forgotForm       = document.getElementById("forgot-form");
const forgotEmailInput = document.getElementById("forgot-email");
const forgotEmailError = document.getElementById("forgot-email-error");
const forgotBtn        = document.getElementById("forgot-btn");
const forgotError      = document.getElementById("forgot-error");
const forgotErrorText  = document.getElementById("forgot-error-text");
const forgotFormView   = document.getElementById("forgot-form-view");
const forgotSuccess    = document.getElementById("forgot-success-view");
const forgotSentEmail  = document.getElementById("forgot-sent-email");

function tabGoster(sekme) {
  const girisAktif = sekme === "giris";
  panelGiris.style.display = girisAktif ? "" : "none";
  panelKayit.style.display = girisAktif ? "none" : "";
  tabGiris.classList.toggle("aktif", girisAktif);
  tabKayit.classList.toggle("aktif", !girisAktif);
}

tabGiris.addEventListener("click", () => tabGoster("giris"));
tabKayit.addEventListener("click", () => tabGoster("kayit"));
document.getElementById("link-girise-don").addEventListener("click", (e) => {
  e.preventDefault();
  tabGoster("giris");
});

// ---------- Zaten giriş yapılmışsa yönlendir ----------
// Not: createUserWithEmailAndPassword anında onAuthStateChanged tetikler.
// Kayıt sırasında setDoc tamamlanmadan sayfa değişmesin diye flag kullanıyoruz.
let kaydoluyor = false;

authDurumDinle((user) => {
  if (user && !kaydoluyor) window.location.href = "../dashboard/index.html";
});

// ---------- URL param: reddedildi ----------
const params = new URLSearchParams(window.location.search);
if (params.get("ret") === "reddedildi") {
  hataGoster("Hesap talebiniz reddedildi. Detay için sistem yöneticinize başvurun.");
}

// ---------- Kurum kodu girildikçe admin kontrolü + rol seçimi güncelle ----------
let okulKontrolZamanlayici = null;
let secilenRol = null;   // "admin" | "ogretmen"

regKurumKoduEl.addEventListener("input", () => {
  const kod = regKurumKoduEl.value.trim();

  if (!/^\d{5,9}$/.test(kod)) {
    regRolContainer.innerHTML = "";
    regKontrolMesaj.style.display = "";
    regKontrolMesaj.textContent = "Geçerli kurum kodu girdikçe görev seçenekleri belirlenir...";
    secilenRol = null;
    return;
  }

  // Format geçerli — Firestore'a sor (debounce 600ms)
  clearTimeout(okulKontrolZamanlayici);
  regKontrolMesaj.style.display = "";
  regKontrolMesaj.textContent = "Kontrol ediliyor...";
  regRolContainer.innerHTML = "";
  secilenRol = null;

  okulKontrolZamanlayici = setTimeout(async () => {
    try {
      const adminVar = await okulAdminVarMi(kod);
      regKontrolMesaj.style.display = "none";
      regRolContainer.innerHTML = "";
      secilenRol = null;

      if (!adminVar) {
        rolRadioEkle("admin", "Okul Yöneticisi (Rehber Öğretmen / Müdür)",
          "Bu kurum kodu için henüz yönetici tanımlı değil — ilk yönetici siz olacaksınız.");
        secilenRol = "admin";
      } else {
        rolRadioEkle("ogretmen", "Sınıf Öğretmeni",
          "Bu okul için yönetici zaten mevcut. Öğretmen olarak kayıt olabilirsiniz.");
        secilenRol = "ogretmen";
      }
    } catch (e) {
      regKontrolMesaj.style.display = "none";
      regRolContainer.innerHTML = "";
      rolRadioEkle("admin", "Okul Yöneticisi (Rehber Öğretmen / Müdür)",
        "Bu kurum kodu için henüz yönetici tanımlı değil — ilk yönetici siz olacaksınız.");
      secilenRol = "admin";
    }
  }, 600);
});

function rolRadioEkle(deger, etiket, aciklama) {
  const wrap = document.createElement("label");
  wrap.style.cssText = [
    "display:flex", "align-items:flex-start", "gap:.6rem",
    "padding:.65rem .85rem", "border:1.5px solid var(--neutral-200)",
    "border-radius:10px", "cursor:pointer", "font-size:.875rem",
    "transition:border-color .15s"
  ].join(";");

  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "reg-rol";
  radio.value = deger;
  radio.checked = true;
  radio.style.marginTop = "2px";
  radio.addEventListener("change", () => { secilenRol = deger; });

  const textDiv = document.createElement("div");
  textDiv.innerHTML = `<strong>${etiket}</strong><br>
    <span style="color:var(--neutral-500);font-size:.82rem">${aciklama}</span>`;

  wrap.appendChild(radio);
  wrap.appendChild(textDiv);
  wrap.addEventListener("click", () => { secilenRol = deger; });
  regRolContainer.appendChild(wrap);
}

// ---------- Hata Mesajları (Giriş) ----------
const FIREBASE_HATALAR = {
  "auth/invalid-email":         "Geçersiz e-posta adresi.",
  "auth/user-not-found":        "Bu e-posta ile kayıtlı kullanıcı bulunamadı.",
  "auth/wrong-password":        "Şifre hatalı. Lütfen tekrar deneyiniz.",
  "auth/invalid-credential":    "E-posta veya şifre hatalı.",
  "auth/too-many-requests":     "Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.",
  "auth/network-request-failed":"Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.",
  "auth/user-disabled":         "Bu hesap devre dışı bırakılmış.",
};

function hataGoster(mesaj) {
  errorText.textContent = mesaj;
  errorBox.classList.add("visible");
  form.style.animation = "none";
  requestAnimationFrame(() => { form.style.animation = "shake .4s ease"; });
}
function hataGizle() { errorBox.classList.remove("visible"); }

// ---------- Hata Mesajları (Kayıt) ----------
const FIREBASE_KAYIT_HATALAR = {
  "auth/email-already-in-use": "Bu e-posta adresi zaten kullanımda.",
  "auth/invalid-email":        "Geçersiz e-posta adresi.",
  "auth/weak-password":        "Şifre çok zayıf. En az 6 karakter kullanın.",
  "auth/network-request-failed": "Ağ bağlantısı hatası.",
};

function regHataGoster(mesaj) {
  regErrorText.textContent = mesaj;
  regError.classList.add("visible");
}
function regHataGizle() { regError.classList.remove("visible"); }

// ---------- Şifremi Unuttum ----------
const FIREBASE_SIFIRLAMA_HATALAR = {
  "auth/invalid-email":          "Geçersiz e-posta adresi.",
  "auth/user-not-found":         "Bu e-posta ile kayıtlı kullanıcı bulunamadı.",
  "auth/too-many-requests":      "Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.",
  "auth/network-request-failed": "Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.",
};

function forgotGoster() {
  forgotError.classList.remove("visible");
  forgotEmailError.classList.remove("visible");
  forgotEmailInput.classList.remove("error");
  forgotForm.reset();
  forgotFormView.style.display = "";
  forgotSuccess.style.display = "none";
  forgotOverlay.classList.add("visible");
  forgotOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => forgotEmailInput.focus(), 50);
}

function forgotKapat() {
  forgotOverlay.classList.remove("visible");
  forgotOverlay.setAttribute("aria-hidden", "true");
}

function forgotHataGoster(mesaj) {
  forgotErrorText.textContent = mesaj;
  forgotError.classList.add("visible");
}
function forgotHataGizle() {
  forgotError.classList.remove("visible");
}

function forgotFormuDogrula() {
  const email = forgotEmailInput.value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    forgotEmailInput.classList.add("error");
    forgotEmailError.classList.add("visible");
    return false;
  }
  forgotEmailInput.classList.remove("error");
  forgotEmailError.classList.remove("visible");
  return true;
}

// ---------- Şifremi Unuttum Olayları ----------
forgotLink.addEventListener("click", (e) => {
  e.preventDefault();
  forgotGoster();
});

forgotClose.addEventListener("click", forgotKapat);
forgotBackLogin.addEventListener("click", (e) => {
  e.preventDefault();
  forgotKapat();
});
forgotDone.addEventListener("click", forgotKapat);

forgotOverlay.addEventListener("click", (e) => {
  if (e.target === forgotOverlay) forgotKapat();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && forgotOverlay.classList.contains("visible")) forgotKapat();
});

forgotEmailInput.addEventListener("input", () => {
  forgotEmailInput.classList.remove("error");
  forgotEmailError.classList.remove("visible");
  forgotHataGizle();
});

forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  forgotHataGizle();
  if (!forgotFormuDogrula()) return;

  yuklemeBaslat(forgotBtn);
  try {
    await sifreSifirlamaMailiGonder(forgotEmailInput.value.trim());
    forgotSentEmail.textContent = forgotEmailInput.value.trim();
    forgotFormView.style.display = "none";
    forgotSuccess.style.display = "";
  } catch (err) {
    console.error("Şifre sıfırlama hatası:", err.code, err.message);
    forgotHataGoster(FIREBASE_SIFIRLAMA_HATALAR[err.code] || "Şifre sıfırlama e-postası gönderilemedi.");
    yuklemeBitir(forgotBtn);
  }
});

// ---------- Form Doğrulama (Giriş) ----------
function formuDogrula() {
  let gecerli = true;
  if (!emailInput.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)) {
    emailInput.classList.add("error");
    emailError.classList.add("visible");
    gecerli = false;
  } else {
    emailInput.classList.remove("error");
    emailError.classList.remove("visible");
  }
  if (passInput.value.length < 6) {
    passInput.classList.add("error");
    passError.classList.add("visible");
    gecerli = false;
  } else {
    passInput.classList.remove("error");
    passError.classList.remove("visible");
  }
  return gecerli;
}

// ---------- Form Doğrulama (Kayıt) ----------
function registerFormuDogrula() {
  let gecerli = true;

  const alanlar = [
    { id: "reg-adsoyad",    errId: "reg-adsoyad-error",    test: v => v.trim().length >= 2 },
    { id: "reg-telefon",    errId: "reg-telefon-error",    test: v => /^0[5][0-9]{9}$/.test(v.replace(/\s/g,'')) },
    { id: "reg-email",      errId: "reg-email-error",      test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
    { id: "reg-password",   errId: "reg-password-error",   test: v => v.length >= 6 },
    { id: "reg-kurum-kodu", errId: "reg-kurum-kodu-error", test: v => /^\d{5,9}$/.test(v.trim()) },
    { id: "reg-okul-adi",   errId: "reg-okul-adi-error",   test: v => v.trim().length >= 3 },
  ];

  alanlar.forEach(({ id, errId, test }) => {
    const el = document.getElementById(id);
    if (!test(el.value)) {
      el.classList.add("error");
      document.getElementById(errId).classList.add("visible");
      gecerli = false;
    } else {
      el.classList.remove("error");
      document.getElementById(errId).classList.remove("visible");
    }
  });

  if (!secilenRol) {
    document.getElementById("reg-rol-error").classList.add("visible");
    gecerli = false;
  } else {
    document.getElementById("reg-rol-error").classList.remove("visible");
  }

  return gecerli;
}

// Anlık hata temizleme
emailInput.addEventListener("input", () => {
  emailInput.classList.remove("error");
  emailError.classList.remove("visible");
  hataGizle();
});
passInput.addEventListener("input", () => {
  passInput.classList.remove("error");
  passError.classList.remove("visible");
  hataGizle();
});

// ---------- Buton Yükleme Durumu ----------
function yuklemeBaslat(btn) { btn.disabled = true;  btn.classList.add("loading"); }
function yuklemeBitir(btn)  { btn.disabled = false; btn.classList.remove("loading"); }

function initParticles() {
  if (!window.particlesJS || !document.getElementById("particles-js")) return;

  try {
    const dom = window.pJSDom;
    if (Array.isArray(dom) && dom.length) {
      dom.forEach((entry) => {
        try {
          entry?.pJS?.fn?.vendors?.destroypJS?.();
        } catch (_) {
          // ignore cleanup failures
        }
      });
      window.pJSDom = [];
    }
  } catch (_) {
    // ignore
  }

  const shouldUseRetina = Number(window.devicePixelRatio || 1) <= 1.5;

  window.particlesJS("particles-js", {
    particles: {
      number: {
        value: 50,
        density: {
          enable: true,
          value_area: 750,
        },
      },
      color: {
        value: "#ca2323",
      },
      shape: {
        type: "star",
        stroke: {
          width: 0,
          color: "#000000",
        },
        polygon: {
          nb_sides: 5,
        },
      },
      opacity: {
        value: 0.5,
        random: false,
      },
      size: {
        value: 3,
        random: true,
      },
      line_linked: {
        enable: true,
        distance: 150,
        color: "#ca2323",
        opacity: 0.45,
        width: 1,
      },
      move: {
        enable: true,
        speed: 3,
        direction: "none",
        random: false,
        straight: false,
        out_mode: "out",
        bounce: false,
      },
    },
    interactivity: {
      detect_on: "canvas",
      events: {
        onhover: {
          enable: false,
          mode: "repulse",
        },
        onclick: {
          enable: true,
          mode: "push",
        },
        resize: false,
      },
    },
    retina_detect: shouldUseRetina,
  });
}

// ---------- Giriş Form Gönderimi ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hataGizle();
  if (!formuDogrula()) return;
  yuklemeBaslat(loginBtn);
  try {
    await adminGirisYap(emailInput.value.trim(), passInput.value);
  } catch (err) {
    console.error("Giriş hatası:", err.code, err.message);
    hataGoster(FIREBASE_HATALAR[err.code] || "Giriş yapılamadı. Lütfen tekrar deneyiniz.");
    yuklemeBitir(loginBtn);
  }
});

// ---------- Kayıt Form Gönderimi ----------
regForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  regHataGizle();
  regSuccess.style.display = "none";
  if (!registerFormuDogrula()) return;

  yuklemeBaslat(regBtn);

  const adSoyad   = document.getElementById("reg-adsoyad").value.trim();
  const telefon   = document.getElementById("reg-telefon").value.replace(/\s/g, '');
  const email     = document.getElementById("reg-email").value.trim();
  const pass      = regPassInput.value;
  const okulId    = regKurumKoduEl.value.trim();   // kurum kodu = okul kimlik no
  const okulAdi   = regOkulAdiEl.value.trim();

  kaydoluyor = true;   // ← redirect engeli: setDoc tamamlanana kadar bekle
  try {
    await kullaniciKayitOl(email, pass, okulId, okulAdi, adSoyad, telefon, secilenRol);
    regForm.style.display = "none";
    regSuccess.style.display = "";
  } catch (err) {
    console.error("Kayıt hatası:", err.code, err.message);
    regHataGoster(FIREBASE_KAYIT_HATALAR[err.code] || "Kayıt yapılamadı. Lütfen tekrar deneyin.");
    yuklemeBitir(regBtn);
  } finally {
    kaydoluyor = false;  // ← flag'i her zaman sıfırla
  }
});

// Shake animasyonu
const style = document.createElement("style");
style.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-8px); }
    40%      { transform: translateX(8px); }
    60%      { transform: translateX(-5px); }
    80%      { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);

initParticles();
