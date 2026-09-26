// ============================================================
// js/auth-guard.js
// Admin sayfalarının üstüne eklenir.
// Oturum açık değilse giriş sayfasına yönlendirir.
// Profil bilgisini Firestore'dan okuyup callback'e iletir.
// ============================================================

import { authDurumDinle, kullaniciProfilGetir, cikisYap } from "./auth.service.js";

// Uygulama kök yolu. Bu dosya /assets/js/auth-guard.js altında; bir seviye
// yukarısı /assets/ klasörüdür (css, js, pages vb. hepsi assets altında).
// Modülün kendi URL'sinden (import.meta.url) hesaplanır; böylece proje alt
// klasörden servis edilse bile login'e yönlendirme doğru çalışır.
const APP_BASE = new URL("../", import.meta.url).href;
const LOGIN_URL = APP_BASE + "pages/login/index.html";

/**
 * Sayfayı korur. Kullanıcı yoksa login'e atar.
 * Kullanıcı varsa profili çeker, window.__okulCtx'i ayarlar ve callback'i çalıştırır.
 * @param {Function} callback - (user, profil) => void
 *   profil: { role: "superadmin"|"admin"|"beklemede"|"reddedildi", okul_id, okul_adi }
 */
export function adminKoruması(callback) {
  // Sayfanın içeriğini gizle (flash önleme)
  document.documentElement.style.visibility = "hidden";

  authDurumDinle(async (user) => {
    if (!user) {
      window.location.href = LOGIN_URL;
      return;
    }

    // Kullanıcı profilini Firestore'dan al
    const profil = await kullaniciProfilGetir(user.uid);

    // --- Profil yok veya erişim engelli ---
    if (!profil.role || profil.role === "erisim-yok") {
      await cikisYap();
      window.location.href = LOGIN_URL;
      return;
    }

    // --- Onay bekleyen kullanıcı ---
    if (profil.role === "beklemede") {
      document.documentElement.style.visibility = "visible";
      document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                    background:#f8fafc;font-family:'Inter',sans-serif">
          <div style="text-align:center;padding:2.5rem;max-width:480px;background:#fff;
                      border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
            <div style="font-size:3rem;margin-bottom:1rem">⏳</div>
            <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:.5rem;color:#1e293b">
              Hesabınız Onay Bekliyor
            </h2>
            <p style="color:#64748b;font-size:.9rem;line-height:1.65;margin-bottom:1.5rem">
              Kayıt talebiniz alındı.<br>
              Sistem yöneticisi hesabınızı onayladıktan sonra giriş yapabilirsiniz.
            </p>
            <button id="bekleyen-cikis"
              style="padding:.65rem 1.75rem;background:#1e40af;color:#fff;border:none;
                     border-radius:8px;font-size:.9rem;cursor:pointer;font-family:inherit">
              Çıkış Yap
            </button>
          </div>
        </div>
      `;
      document.getElementById("bekleyen-cikis").addEventListener("click", async () => {
        await cikisYap();
        window.location.href = LOGIN_URL;
      });
      return;
    }

    // --- Reddedilen kullanıcı ---
    if (profil.role === "reddedildi") {
      await cikisYap();
      window.location.href = LOGIN_URL + "?ret=reddedildi";
      return;
    }

    // Aktif okul bağlamını global olarak ayarla
    // Tüm servisler bu değeri _okulId() ile okur
    window.__okulCtx = {
      role:     profil.role     || "admin",
      okul_id:  profil.okul_id  || null,
      okul_adi: profil.okul_adi || null,
      ad_soyad: profil.ad_soyad || null,
    };

    document.documentElement.style.visibility = "visible";
    callback(user, profil);
  });
}
