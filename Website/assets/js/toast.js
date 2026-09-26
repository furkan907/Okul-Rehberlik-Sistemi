// ============================================================
// js/toast.js
// Ekranın sağ alt köşesinde geçici bildirim gösterir.
// ============================================================

const container = (() => {
  let el = document.getElementById("toast-container");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-container";
    document.body.appendChild(el);
  }
  return el;
})();

/**
 * @param {string} mesaj   - Gösterilecek metin
 * @param {"info"|"success"|"error"|"warning"} tip
 * @param {number} sure    - Milisaniye cinsinden gösterim süresi
 */
export function toastGoster(mesaj, tip = "info", sure = 3500) {
  const ikonlar = {
    success: "✓",
    error:   "✕",
    warning: "⚠",
    info:    "ℹ"
  };

  const el = document.createElement("div");
  el.className = `toast ${tip}`;
  el.innerHTML = `<span>${ikonlar[tip] || "ℹ"}</span><span>${mesaj}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add("fade-out");
    el.addEventListener("animationend", () => el.remove());
  }, sure);
}

export const toast = {
  basari:  (m) => toastGoster(m, "success"),
  hata:    (m) => toastGoster(m, "error"),
  uyari:   (m) => toastGoster(m, "warning"),
  bilgi:   (m) => toastGoster(m, "info"),
};
