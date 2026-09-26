// ============================================================
// js/riba.service.js
// RIBA anket yanıtları için Firestore CRUD işlemleri.
// Koleksiyon yolu: okullar/{okulId}/riba_yanitlari
// ============================================================

import { db, OKUL_ID, FIREBASE_CONFIG } from "./firebase.js";
import {
  collection,
  doc,
  addDoc,
  deleteField,
  getDocs,
  query,
  updateDoc,
  writeBatch,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const _okulId = () => window.__okulCtx?.okul_id || OKUL_ID;

const ribaYanitlariRef = (okulId = _okulId()) =>
  collection(db, "okullar", okulId, "riba_yanitlari");

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(firestoreValue) } };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "object") {
    const fields = Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, firestoreValue(nestedValue)])
    );
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

async function ribaYanitiCreateOnlyKaydet(okulId, belgeId, payload) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/okullar/${encodeURIComponent(okulId)}/riba_yanitlari?documentId=${encodeURIComponent(belgeId)}&key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [key, firestoreValue(value)])
      ),
    }),
  });

  if (response.ok) return belgeId;

  const errorBody = await response.json().catch(() => null);
  const status = errorBody?.error?.status || "";
  const message = errorBody?.error?.message || `HTTP ${response.status}`;
  const error = new Error(message);
  if (response.status === 409 || status === "ALREADY_EXISTS") {
    error.code = "already-exists";
  } else if (response.status === 403 || status === "PERMISSION_DENIED") {
    error.code = "permission-denied";
  } else {
    error.code = status ? status.toLowerCase().replace(/_/g, "-") : "unknown";
  }
  throw error;
}

function temizParca(value) {
  return String(value || "")
    .trim()
    .replace(/\//g, "-");
}

export function ribaOgrenciAnahtariOlustur({ kademe, sinif, sube, ogrenci_no }) {
  return [kademe, sinif, sube, ogrenci_no].map(temizParca).join("__");
}

export function ribaYanitBelgeIdOlustur({ anket_turu, kademe, sinif, sube, ogrenci_no }) {
  return [temizParca(anket_turu), ribaOgrenciAnahtariOlustur({ kademe, sinif, sube, ogrenci_no })].join("__");
}

export function ribaLegacyYanitMi(yanit) {
  if (!yanit || !["ogrenci", "veli"].includes(yanit.anket_turu)) return false;
  if (!yanit.kademe || !yanit.sinif || !yanit.sube || !yanit.ogrenci_no) return false;
  return yanit.id !== ribaYanitBelgeIdOlustur(yanit);
}

export function ribaEksikLegacyYanitMi(yanit) {
  if (!yanit || !["ogrenci", "veli"].includes(yanit.anket_turu)) return false;
  if (ribaLegacyYanitMi(yanit)) return false;
  if (yanit.kademe && yanit.sinif && yanit.sube && yanit.ogrenci_no) return false;
  return !String(yanit.id || "").includes("__");
}

export function ribaEksikAlanlariniGetir(yanit) {
  const eksikAlanlar = [];
  if (!yanit?.kademe) eksikAlanlar.push("kademe");
  if (!yanit?.sinif) eksikAlanlar.push("sinif");
  if (!yanit?.sube) eksikAlanlar.push("sube");
  if (!yanit?.ogrenci_no) eksikAlanlar.push("ogrenci_no");
  return eksikAlanlar;
}

function nullAlanlariniGetir(veri = {}) {
  return Object.entries(veri)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
}

function ribaYanitPayloadiniHazirla(yanit = {}, overrides = {}) {
  const payload = {
    ...yanit,
    ...overrides,
  };

  Object.keys(payload).forEach(key => {
    if (payload[key] === null || payload[key] === undefined) {
      delete payload[key];
    }
  });

  delete payload.id;
  delete payload.ogrenci_anahtari;
  delete payload.response_key;
  return payload;
}

/**
 * RIBA anket yanıtını Firestore'a kaydeder.
 *
 * @param {Object} params
 * @param {"ogrenci"|"veli"|"ogretmen"} params.anket_turu
 * @param {"ortaokul"|"lise"}           params.kademe
 * @param {string}                      params.sinif       - "5", "9" vb.
 * @param {string}                      params.sube        - "A", "B" vb.
 * @param {string|null}                 params.ogrenci_id  - Öğretmen için null
 * @param {string|null}                 params.ogrenci_no  - Öğrenci okul no / sabit kimlik
 * @param {string|null}                 params.ogrenci_anahtari - Kademe+sınıf+şube+öğrenci no bileşik anahtar
 * @param {Object}                      params.cevaplar    - { q1: "A", q2: "B", ... }
 * @param {string[]}                    params.secilen_kategoriler - Her sorunun kategori adı
 * @param {string|null}                 params.ogretmen_ad_soyad
 * @param {string|null}                 params.ogretmen_brans
 * @returns {Promise<string>}  Oluşturulan doküman ID'si
 */
export async function ribaYanitiKaydet({
  anket_turu,
  kademe,
  sinif,
  sube,
  ogrenci_id = null,
  ogrenci_no = null,
  ogrenci_anahtari = null,
  cevaplar,
  secilen_kategoriler,
  ogretmen_ad_soyad = null,
  ogretmen_brans = null,
}) {
  const payload = {
    anket_turu,
    kademe,
    sinif,
    sube,
    ogrenci_id,
    ogrenci_no,
    ogrenci_anahtari,
    cevaplar,
    secilen_kategoriler,
    ogretmen_ad_soyad,
    ogretmen_brans,
    gonderim_tarihi: new Date(),
  };
  const kayitPayloadi = ribaYanitPayloadiniHazirla(payload);

  if ((anket_turu === "ogrenci" || anket_turu === "veli") && kademe && sinif && sube && ogrenci_no) {
    const belgeId = ribaYanitBelgeIdOlustur({ anket_turu, kademe, sinif, sube, ogrenci_no });
    await ribaYanitiCreateOnlyKaydet(_okulId(), belgeId, kayitPayloadi);
    return belgeId;
  }

  const docRef = await addDoc(ribaYanitlariRef(), kayitPayloadi);
  return docRef.id;
}

/**
 * Belirli tur ve sınıfa ait tüm RIBA yanıtlarını getirir.
 *
 * @param {"ogrenci"|"veli"|"ogretmen"} tur
 * @param {string|null} sinifFiltre  - "5" gibi; null ise tüm sınıflar
 * @returns {Promise<Array>}
 */
export async function ribaYanitlariniGetir(tur, sinifFiltre = null) {
  let q;
  if (sinifFiltre) {
    q = query(
      ribaYanitlariRef(),
      where("anket_turu", "==", tur),
      where("sinif", "==", sinifFiltre)
    );
  } else {
    q = query(ribaYanitlariRef(), where("anket_turu", "==", tur));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Belirli bir sınıf şubesine ait RIBA yanıtlarını getirir.
 *
 * @param {"ogrenci"|"veli"|"ogretmen"} tur
 * @param {string} sinif   - "5"
 * @param {string} sube    - "A"
 * @returns {Promise<Array>}
 */
export async function ribaSinifYanitlariniGetir(tur, sinif, sube) {
  const q = query(
    ribaYanitlariRef(),
    where("anket_turu", "==", tur),
    where("sinif", "==", sinif),
    where("sube", "==", sube)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Tüm RIBA yanıtlarını getirir (rapor sayfası için).
 * @returns {Promise<Array>}
 */
export async function tumRibaYanitlariniGetir() {
  const snapshot = await getDocs(ribaYanitlariRef());
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Belirtilen RIBA yanıt belgelerini siler.
 * @param {string[]} yanitIds
 */
export async function ribaYanitlariniSil(yanitIds = []) {
  if (!Array.isArray(yanitIds) || yanitIds.length === 0) return;

  const benzersizIdler = [...new Set(yanitIds.filter(Boolean))];
  const CHUNK = 450;

  for (let i = 0; i < benzersizIdler.length; i += CHUNK) {
    const batch = writeBatch(db);
    benzersizIdler.slice(i, i + CHUNK).forEach(yanitId => {
      batch.delete(doc(db, "okullar", _okulId(), "riba_yanitlari", yanitId));
    });
    await batch.commit();
  }
}

/**
 * Legacy RİBA yanıtındaki eksik alanları günceller.
 * @param {string} yanitId
 * @param {{ kademe?:string, sinif?:string, sube?:string, ogrenci_no?:string }} alanlar
 */
export async function legacyRibaAlanlariniGuncelle(yanitId, alanlar = {}) {
  const guncelleme = {};

  if (typeof alanlar.kademe === "string") guncelleme.kademe = alanlar.kademe.trim();
  if (typeof alanlar.sinif === "string") guncelleme.sinif = alanlar.sinif.trim();
  if (typeof alanlar.sube === "string") guncelleme.sube = alanlar.sube.trim().toUpperCase();
  if (typeof alanlar.ogrenci_no === "string") guncelleme.ogrenci_no = alanlar.ogrenci_no.trim();

  if (Object.keys(guncelleme).length === 0) return;
  await updateDoc(doc(db, "okullar", _okulId(), "riba_yanitlari", yanitId), guncelleme);
}

export async function ribaTekrarAlanlariniTemizle() {
  const snapshot = await getDocs(ribaYanitlariRef());
  const guncellenecekler = snapshot.docs.filter(d => {
    const data = d.data();
    return "response_key" in data || "ogrenci_anahtari" in data;
  });

  const CHUNK = 450;
  for (let i = 0; i < guncellenecekler.length; i += CHUNK) {
    const batch = writeBatch(db);
    guncellenecekler.slice(i, i + CHUNK).forEach(d => {
      batch.update(d.ref, {
        ogrenci_anahtari: deleteField(),
        response_key: deleteField(),
      });
    });
    await batch.commit();
  }

  return { guncellenen: guncellenecekler.length };
}

export async function ribaNullAlanlariniTemizle() {
  const snapshot = await getDocs(ribaYanitlariRef());
  const guncellenecekler = snapshot.docs
    .map(d => ({ ref: d.ref, nullAlanlar: nullAlanlariniGetir(d.data()) }))
    .filter(item => item.nullAlanlar.length > 0);

  const CHUNK = 450;
  for (let i = 0; i < guncellenecekler.length; i += CHUNK) {
    const batch = writeBatch(db);
    guncellenecekler.slice(i, i + CHUNK).forEach(({ ref, nullAlanlar }) => {
      batch.update(ref, Object.fromEntries(
        nullAlanlar.map(alan => [alan, deleteField()])
      ));
    });
    await batch.commit();
  }

  return { guncellenen: guncellenecekler.length };
}

/**
 * Legacy RIBA kayıtlarını yeni deterministik belge kimliğine taşır.
 * Hedef belge zaten varsa eski kayıt silinmez; veri kaybı önlemek için atlanır.
 * @param {Array<Object>} yanitlar
 * @returns {Promise<{ tasinan:number, atlanan:number, tasinanIds:string[], atlananIds:string[] }>}
 */
export async function legacyRibaYanitlariniYeniFormataTasi(yanitlar = []) {
  const adaylar = yanitlar.filter(ribaLegacyYanitMi);
  if (adaylar.length === 0) {
    return { tasinan: 0, atlanan: 0, tasinanIds: [], atlananIds: [] };
  }

  const mevcutIdler = new Set(yanitlar.map(yanit => yanit.id).filter(Boolean));
  const tasinacaklar = [];
  const atlananIds = [];

  adaylar.forEach(yanit => {
    const hedefId = ribaYanitBelgeIdOlustur(yanit);
    if (mevcutIdler.has(hedefId)) {
      atlananIds.push(yanit.id);
      return;
    }
    tasinacaklar.push({ eskiId: yanit.id, hedefId, yanit });
    mevcutIdler.add(hedefId);
  });

  const CHUNK = 200;
  for (let i = 0; i < tasinacaklar.length; i += CHUNK) {
    const batch = writeBatch(db);
    tasinacaklar.slice(i, i + CHUNK).forEach(({ eskiId, hedefId, yanit }) => {
      const payload = ribaYanitPayloadiniHazirla(yanit, {
        ogrenci_anahtari: yanit.ogrenci_anahtari || ribaOgrenciAnahtariOlustur(yanit),
      });

      batch.set(doc(db, "okullar", _okulId(), "riba_yanitlari", hedefId), payload);
      batch.delete(doc(db, "okullar", _okulId(), "riba_yanitlari", eskiId));
    });
    await batch.commit();
  }

  return {
    tasinan: tasinacaklar.length,
    atlanan: atlananIds.length,
    tasinanIds: tasinacaklar.map(item => item.eskiId),
    atlananIds,
  };
}

/**
 * Bir öğrencinin belirli tur için daha önce yanıt verip vermediğini kontrol eder.
 * Öğrenci/Veli için kullanılır.
 *
 * @param {string} ogrenci_id
 * @param {"ogrenci"|"veli"} tur
 * @returns {Promise<boolean>}
 */
export async function ribaYanitVar(ogrenci_id, tur) {
  const q = query(
    ribaYanitlariRef(),
    where("anket_turu", "==", tur),
    where("ogrenci_id", "==", ogrenci_id)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Bir öğretmenin belirli kademe için daha önce yanıt verip vermediğini kontrol eder.
 *
 * @param {string} adSoyad
 * @param {string|null} kademe
 * @returns {Promise<boolean>}
 */
export async function ribaOgretmenYanitVar(adSoyad, kademe = null) {
  const filtreler = [
    where("anket_turu", "==", "ogretmen"),
    where("ogretmen_ad_soyad", "==", adSoyad),
  ];

  if (kademe) {
    filtreler.push(where("kademe", "==", kademe));
  }

  const q = query(ribaYanitlariRef(), ...filtreler);
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Yanıt listesinden kategori bazlı istatistik hesaplar.
 * Her soru için A/B seçim sayıları ve kategori adları döner.
 *
 * @param {Array} yanitlar  - ribaYanitlariniGetir() çıktısı
 * @param {Array} sorular   - RIBA_SORULAR[tur][kademe] dizisi
 * @returns {Array<{
 *   soruId: string,
 *   a_metin: string, a_kategori: string, a_sayi: number,
 *   b_metin: string, b_kategori: string, b_sayi: number,
 *   toplam: number
 * }>}
 */
export function ribaIstatistikHesapla(yanitlar, sorular) {
  return sorular.map(soru => {
    let a_sayi = 0;
    let b_sayi = 0;
    yanitlar.forEach(yanit => {
      const secim = (yanit.cevaplar || {})[soru.id];
      if (secim === "A") a_sayi++;
      else if (secim === "B") b_sayi++;
    });
    return {
      soruId:      soru.id,
      a_metin:     soru.a_metin,
      a_kategori:  soru.a_kategori,
      a_sayi,
      b_metin:     soru.b_metin,
      b_kategori:  soru.b_kategori,
      b_sayi,
      toplam:      a_sayi + b_sayi,
    };
  });
}
