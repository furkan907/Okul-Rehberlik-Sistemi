// ============================================================
// js/students.service.js
// Firestore ogrenciler koleksiyonu için CRUD işlemleri.
// Koleksiyon yolu: okullar/{okulId}/ogrenciler
// ============================================================

import { db, OKUL_ID, FIREBASE_CONFIG } from "./firebase.js";
import {
  collection,
  doc,
  deleteField,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Aktif okul ID'sini döner.
// Önce window.__okulCtx (auth-guard veya public sayfa tarafından set edilir),
// sonra OKUL_ID varsayılanına bakılır.
const _okulId = () => window.__okulCtx?.okul_id || OKUL_ID;

const ogrencilerRef = (okulId = _okulId()) =>
  collection(db, "okullar", okulId, "ogrenciler");

const riskHaritalariRef = (okulId = _okulId()) =>
  collection(db, "okullar", okulId, "risk_haritalari");

const riskHaritasiDocRef = (riskBelgeId, okulId = _okulId()) =>
  doc(db, "okullar", okulId, "risk_haritalari", riskBelgeId);

function temizParca(value) {
  return String(value || "")
    .trim()
    .replace(/\//g, "-");
}

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
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [key, firestoreValue(nestedValue)])
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

async function riskHaritasiCreateOnlyCommit(okulId, riskBelgeId, riskPayload, ogrenciId, ogrenciOzeti) {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
  const resourceBase = `projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
  const response = await fetch(`${baseUrl}:commit?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `${resourceBase}/okullar/${okulId}/risk_haritalari/${riskBelgeId}`,
            fields: Object.fromEntries(
              Object.entries(riskPayload).map(([key, value]) => [key, firestoreValue(value)])
            ),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `${resourceBase}/okullar/${okulId}/ogrenciler/${ogrenciId}`,
            fields: Object.fromEntries(
              Object.entries(ogrenciOzeti).map(([key, value]) => [key, firestoreValue(value)])
            ),
          },
          updateMask: { fieldPaths: Object.keys(ogrenciOzeti) },
          currentDocument: { exists: true },
        },
      ],
    }),
  });

  if (response.ok) return riskBelgeId;

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

function siniftanKademeBul(sinif) {
  const sinifNo = Number.parseInt(String(sinif || "").trim(), 10);
  if (!Number.isNaN(sinifNo)) {
    return sinifNo >= 9 ? "lise" : "ortaokul";
  }
  if (String(sinif || "").toLocaleLowerCase("tr").includes("özel eğitim")) {
    return "ortaokul";
  }
  return null;
}

export function riskOgrenciAnahtariOlustur({ kademe, sinif, sube, ogrenci_no }) {
  return [kademe, sinif, sube, ogrenci_no].map(temizParca).join("__");
}

export function riskBelgeIdOlustur({ kademe, sinif, sube, ogrenci_no }) {
  return ["risk", riskOgrenciAnahtariOlustur({ kademe, sinif, sube, ogrenci_no })].join("__");
}

function riskBelgesiPayloadiniHazirla(riskKimligi = {}, alanlar = {}) {
  const payload = {
    ...riskKimligi,
    ...alanlar,
  };
  delete payload.ogrenci_anahtari;
  delete payload.risk_belge_id;
  delete payload.response_key;
  return payload;
}

function riskKaydindanOgrenciAnahtariGetir(kayit) {
  if (!kayit) return "";
  if (kayit.kademe && kayit.sinif && kayit.sube && kayit.ogrenci_no) {
    return riskOgrenciAnahtariOlustur(kayit);
  }
  return String(kayit.ogrenci_anahtari || "").trim();
}

function nullAlanlariniGetir(veri = {}) {
  return Object.entries(veri)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
}

function ogrenciRiskKimliginiGetir(ogrenci) {
  const ogrenci_no = ogrenciNoGetir(ogrenci);
  const sinif = String(ogrenci?.sinif || "").trim();
  const sube = String(ogrenci?.sube || "").trim().toUpperCase();
  const kademe = String(ogrenci?.kademe || siniftanKademeBul(sinif) || "").trim();
  if (!ogrenci_no || !sinif || !sube || !kademe) return null;

  const ogrenci_anahtari = riskOgrenciAnahtariOlustur({ kademe, sinif, sube, ogrenci_no });
  return {
    kademe,
    sinif,
    sube,
    ogrenci_no,
    ogrenci_anahtari,
    risk_belge_id: riskBelgeIdOlustur({ kademe, sinif, sube, ogrenci_no }),
  };
}

export function riskAnketDoldurulduMu(kayit) {
  return Boolean(kayit?.risk_anket_dolduruldu ?? kayit?.form_dolduruldu ?? false);
}

function legacyRiskVerisiniGetir(ogrenci) {
  return {
    risk_anket_dolduruldu: riskAnketDoldurulduMu(ogrenci),
    form_verisi: ogrenci.form_verisi || null,
    risk_detaylari: ogrenci.risk_detaylari || {},
    idare_notlari: ogrenci.idare_notlari || {},
    risk_skoru: ogrenci.risk_skoru || 0,
    gonderim_tarihi: ogrenci.gonderim_tarihi || ogrenci.form_gonderim_tarihi || null,
    ogrenci_id: ogrenci.id || null,
  };
}

export function ogrenciNoGetir(ogrenci) {
  return String(ogrenci?.ogrenci_no ?? ogrenci?.tc ?? ogrenci?.okul_no ?? "").trim();
}

/**
 * Belirli bir sınıftaki, formu henüz doldurulmamış öğrencileri getirir.
 * Veli form sihirbazı Adım 2 için kullanılır.
 * @param {string} sinif  - Örn: "5-A"
 */
export async function formBekleyenOgrencileriGetir(sinifSube) {
  const parts = sinifSube.split("-");
  const sinif = parts[0];
  const sube  = parts[1] || "";
  const q = query(ogrencilerRef(), where("sinif", "==", sinif));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(o => o.sube === sube)
    .filter(o => !riskAnketDoldurulduMu(o));
}

/**
 * Belirli bir sınıftaki, RIBA anketini doldurmamış öğrencileri getirir.
 * @param {string} sinifSube  - Örn: "5-A"
 * @param {"ogrenci"|"veli"}  tur
 */
export async function ribaBekleyenOgrencileriGetir(sinifSube, tur = "ogrenci") {
  const parts = sinifSube.split("-");
  const sinif = parts[0];
  const sube  = parts[1] || "";
  const veriAlani = tur === "veli" ? "riba_veli_dolduruldu" : "riba_ogrenci_dolduruldu";
  const q = query(
    ogrencilerRef(),
    where("sinif", "==", sinif),
    where(veriAlani, "==", false)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(o => o.sube === sube);
}

/**
 * Belirli bir öğrencinin RIBA anket tamamlanma durumunu günceller.
 * @param {string} ogrenciId
 * @param {"ogrenci"|"veli"}  tur
 */
export async function ribaTamamlandiIsaretle(ogrenciId, tur = "ogrenci") {
  const ref = doc(db, "okullar", _okulId(), "ogrenciler", ogrenciId);
  const veriAlani = tur === "veli" ? "riba_veli_dolduruldu" : "riba_ogrenci_dolduruldu";
  return await updateDoc(ref, { [veriAlani]: true });
}

/**
 * Yanıtlara göre eksik kalan RIBA tamamlanma bayraklarını toplu günceller.
 * Sadece false olan alanları true yapar.
 * @param {Array<{ogrenciId:string, tur:"ogrenci"|"veli"}>} guncellemeler
 */
export async function ribaTamamlanmaBayraklariniEsitle(guncellemeler = []) {
  if (!Array.isArray(guncellemeler) || guncellemeler.length === 0) return;

  const benzersiz = new Map();
  guncellemeler.forEach(item => {
    if (!item?.ogrenciId || (item.tur !== "ogrenci" && item.tur !== "veli")) return;
    benzersiz.set(`${item.tur}:${item.ogrenciId}`, item);
  });

  const kayitlar = [...benzersiz.values()];
  const CHUNK = 450;

  for (let i = 0; i < kayitlar.length; i += CHUNK) {
    const batch = writeBatch(db);
    kayitlar.slice(i, i + CHUNK).forEach(({ ogrenciId, tur }) => {
      const ref = doc(db, "okullar", _okulId(), "ogrenciler", ogrenciId);
      const veriAlani = tur === "veli" ? "riba_veli_dolduruldu" : "riba_ogrenci_dolduruldu";
      batch.update(ref, { [veriAlani]: true });
    });
    await batch.commit();
  }
}

/**
 * Tüm öğrencileri getirir (admin dashboard için).
 * @param {string|null} sinifFiltre  - null ise tüm okul listelenir
 */
export async function tumOgrencileriGetir(sinifFiltre = null) {
  let q = sinifFiltre
    ? query(ogrencilerRef(), where("sinif", "==", sinifFiltre))
    : ogrencilerRef();
  const [ogrenciSnapshot, riskSnapshot] = await Promise.all([
    getDocs(q),
    getDocs(riskHaritalariRef()),
  ]);

  const riskIdMap = new Map();
  const riskOgrenciIdMap = new Map();
  const riskAnahtarMap = new Map();
  const riskOgrenciNoMap = new Map();

  riskSnapshot.docs.forEach(d => {
    const data = d.data();
    riskIdMap.set(d.id, { id: d.id, ...data });
    if (data?.ogrenci_id) riskOgrenciIdMap.set(data.ogrenci_id, { id: d.id, ...data });
    const ogrenciAnahtari = riskKaydindanOgrenciAnahtariGetir(data);
    if (ogrenciAnahtari) riskAnahtarMap.set(ogrenciAnahtari, { id: d.id, ...data });
    if (data?.ogrenci_no) riskOgrenciNoMap.set(String(data.ogrenci_no).trim(), { id: d.id, ...data });
  });

  return ogrenciSnapshot.docs.map(d => {
    const ogrenci = { id: d.id, ...d.data() };
    const riskKimligi = ogrenciRiskKimliginiGetir(ogrenci);
    const riskKoleksiyonVerisi = (riskKimligi && riskIdMap.get(riskKimligi.risk_belge_id))
      || (riskKimligi && riskAnahtarMap.get(riskKimligi.ogrenci_anahtari))
      || riskOgrenciIdMap.get(d.id)
      || riskOgrenciNoMap.get(ogrenciNoGetir(ogrenci))
      || null;
    const riskVerisi = riskKoleksiyonVerisi || legacyRiskVerisiniGetir(ogrenci);
    return {
      ...ogrenci,
      ...riskVerisi,
      risk_koleksiyon_kayitli: Boolean(riskKoleksiyonVerisi),
      risk_belge_id: riskKoleksiyonVerisi?.id || riskKimligi?.risk_belge_id || null,
    };
  });
}

export async function riskVerileriniKoleksiyonaTasi() {
  const [ogrenciSnapshot, riskSnapshot] = await Promise.all([
    getDocs(ogrencilerRef()),
    getDocs(riskHaritalariRef()),
  ]);

  const mevcutRiskIdleri = new Set(riskSnapshot.docs.map(d => d.id));
  const guncellenecekler = ogrenciSnapshot.docs.filter(d => {
    const data = d.data();
    const riskKimligi = ogrenciRiskKimliginiGetir(data);
    const detayVar = Boolean(data.form_verisi)
      || Object.keys(data.risk_detaylari || {}).length > 0
      || Object.keys(data.idare_notlari || {}).length > 0;
    return Boolean(riskKimligi) && riskAnketDoldurulduMu(data) && detayVar && !mevcutRiskIdleri.has(riskKimligi.risk_belge_id);
  });

  const CHUNK = 225;
  for (let i = 0; i < guncellenecekler.length; i += CHUNK) {
    const batch = writeBatch(db);
    guncellenecekler.slice(i, i + CHUNK).forEach(d => {
      const data = d.data();
      const riskKimligi = ogrenciRiskKimliginiGetir(data);
      if (!riskKimligi) return;
      batch.set(riskHaritasiDocRef(riskKimligi.risk_belge_id), riskBelgesiPayloadiniHazirla(riskKimligi, {
        ogrenci_id: d.id,
        risk_anket_dolduruldu: riskAnketDoldurulduMu(data),
        form_verisi: data.form_verisi || null,
        risk_detaylari: data.risk_detaylari || {},
        idare_notlari: data.idare_notlari || {},
        risk_skoru: data.risk_skoru || 0,
        gonderim_tarihi: data.gonderim_tarihi || data.form_gonderim_tarihi || null,
      }), { merge: true });
      batch.update(d.ref, {
        form_verisi: deleteField(),
        risk_detaylari: deleteField(),
        idare_notlari: deleteField(),
        form_gonderim_tarihi: deleteField(),
      });
    });
    await batch.commit();
  }

  return { guncellenen: guncellenecekler.length };
}

export async function riskAlanlariniTemizle() {
  const snapshot = await getDocs(ogrencilerRef());
  const guncellenecekler = snapshot.docs.filter(d => {
    const data = d.data();
    return "form_verisi" in data
      || "risk_detaylari" in data
      || "idare_notlari" in data
      || data.form_gonderim_tarihi === null;
  });

  const CHUNK = 450;
  for (let i = 0; i < guncellenecekler.length; i += CHUNK) {
    const batch = writeBatch(db);
    guncellenecekler.slice(i, i + CHUNK).forEach(d => {
      batch.update(d.ref, {
        form_verisi: deleteField(),
        risk_detaylari: deleteField(),
        idare_notlari: deleteField(),
        form_gonderim_tarihi: deleteField(),
      });
    });
    await batch.commit();
  }

  return { guncellenen: guncellenecekler.length };
}

export async function riskTekrarAlanlariniTemizle() {
  const snapshot = await getDocs(riskHaritalariRef());
  const guncellenecekler = snapshot.docs.filter(d => {
    const data = d.data();
    return "response_key" in data || "risk_belge_id" in data || "ogrenci_anahtari" in data;
  });

  const CHUNK = 450;
  for (let i = 0; i < guncellenecekler.length; i += CHUNK) {
    const batch = writeBatch(db);
    guncellenecekler.slice(i, i + CHUNK).forEach(d => {
      batch.update(d.ref, {
        ogrenci_anahtari: deleteField(),
        response_key: deleteField(),
        risk_belge_id: deleteField(),
      });
    });
    await batch.commit();
  }

  return { guncellenen: guncellenecekler.length };
}

export async function riskNullAlanlariniTemizle() {
  const snapshot = await getDocs(riskHaritalariRef());
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

export async function riskAnketAlanlariniDonustur() {
  const [ogrenciSnapshot, riskSnapshot] = await Promise.all([
    getDocs(ogrencilerRef()),
    getDocs(riskHaritalariRef()),
  ]);

  const ogrenciDocs = ogrenciSnapshot.docs.filter(d => "form_dolduruldu" in d.data() || !("risk_anket_dolduruldu" in d.data()));
  const riskDocs = riskSnapshot.docs.filter(d => "form_dolduruldu" in d.data() || !("risk_anket_dolduruldu" in d.data()));

  const CHUNK = 400;
  for (let i = 0; i < ogrenciDocs.length; i += CHUNK) {
    const batch = writeBatch(db);
    ogrenciDocs.slice(i, i + CHUNK).forEach(d => {
      const data = d.data();
      batch.update(d.ref, {
        risk_anket_dolduruldu: riskAnketDoldurulduMu(data),
        form_dolduruldu: deleteField(),
      });
    });
    await batch.commit();
  }

  for (let i = 0; i < riskDocs.length; i += CHUNK) {
    const batch = writeBatch(db);
    riskDocs.slice(i, i + CHUNK).forEach(d => {
      const data = d.data();
      batch.update(d.ref, {
        risk_anket_dolduruldu: riskAnketDoldurulduMu(data),
        form_dolduruldu: deleteField(),
      });
    });
    await batch.commit();
  }

  return { guncellenen: ogrenciDocs.length + riskDocs.length };
}

export async function riskBelgeleriniYeniFormataTasi() {
  const [ogrenciSnapshot, riskSnapshot] = await Promise.all([
    getDocs(ogrencilerRef()),
    getDocs(riskHaritalariRef()),
  ]);

  const ogrenciMap = new Map(ogrenciSnapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  const mevcutRiskIdleri = new Set(riskSnapshot.docs.map(d => d.id));
  const tasinacaklar = [];
  const atlananlar = [];

  riskSnapshot.docs.forEach(d => {
    const data = d.data();
    const bagliOgrenci = data.ogrenci_id ? ogrenciMap.get(data.ogrenci_id) : null;
    const riskKimligi = data.kademe && data.sinif && data.sube && data.ogrenci_no
      ? {
          kademe: String(data.kademe).trim(),
          sinif: String(data.sinif).trim(),
          sube: String(data.sube).trim().toUpperCase(),
          ogrenci_no: String(data.ogrenci_no).trim(),
          ogrenci_anahtari: data.ogrenci_anahtari || riskOgrenciAnahtariOlustur(data),
          risk_belge_id: riskBelgeIdOlustur(data),
        }
      : ogrenciRiskKimliginiGetir(bagliOgrenci);

    if (!riskKimligi) {
      atlananlar.push(d.id);
      return;
    }

    if (d.id === riskKimligi.risk_belge_id) return;
    if (mevcutRiskIdleri.has(riskKimligi.risk_belge_id)) {
      atlananlar.push(d.id);
      return;
    }

    tasinacaklar.push({ eskiId: d.id, yeniId: riskKimligi.risk_belge_id, data, riskKimligi });
    mevcutRiskIdleri.add(riskKimligi.risk_belge_id);
  });

  const CHUNK = 200;
  for (let i = 0; i < tasinacaklar.length; i += CHUNK) {
    const batch = writeBatch(db);
    tasinacaklar.slice(i, i + CHUNK).forEach(({ eskiId, yeniId, data, riskKimligi }) => {
      batch.set(riskHaritasiDocRef(yeniId), riskBelgesiPayloadiniHazirla({
        ...data,
        ...riskKimligi,
      }, {
        ogrenci_id: data.ogrenci_id || null,
        risk_anket_dolduruldu: riskAnketDoldurulduMu(data),
      }), { merge: true });
      batch.delete(riskHaritasiDocRef(eskiId));
    });
    await batch.commit();
  }

  return { tasinan: tasinacaklar.length, atlanan: atlananlar.length };
}

/**
 * Mevcut öğrenci belgelerine ogrenci_no alanını tc alanından kopyalar.
 * @returns {Promise<{guncellenen:number}>}
 */
export async function ogrenciNumaralariniEsitle() {
  const snapshot = await getDocs(ogrencilerRef());
  const guncellenecekler = snapshot.docs.filter(d => {
    const data = d.data();
    return !String(data.ogrenci_no || "").trim() && String(data.tc || "").trim();
  });

  const CHUNK = 450;
  for (let i = 0; i < guncellenecekler.length; i += CHUNK) {
    const batch = writeBatch(db);
    guncellenecekler.slice(i, i + CHUNK).forEach(d => {
      const data = d.data();
      batch.update(d.ref, { ogrenci_no: String(data.tc).trim() });
    });
    await batch.commit();
  }

  return { guncellenen: guncellenecekler.length };
}

/**
 * ogrenci_no alanı bulunan öğrenci belgelerinden eski tc alanını kaldırır.
 * Yalnızca tc ve ogrenci_no aynıysa kaldırır.
 * @returns {Promise<{guncellenen:number}>}
 */
export async function ogrenciTcAlanlariniKaldir() {
  const snapshot = await getDocs(ogrencilerRef());
  const guncellenecekler = snapshot.docs.filter(d => {
    const data = d.data();
    const tc = String(data.tc || "").trim();
    const ogrenciNo = String(data.ogrenci_no || "").trim();
    return tc && ogrenciNo && tc === ogrenciNo;
  });

  const CHUNK = 450;
  for (let i = 0; i < guncellenecekler.length; i += CHUNK) {
    const batch = writeBatch(db);
    guncellenecekler.slice(i, i + CHUNK).forEach(d => {
      batch.update(d.ref, { tc: deleteField() });
    });
    await batch.commit();
  }

  return { guncellenen: guncellenecekler.length };
}

/**
 * Tek öğrenci dokümanını ID ile getirir.
 * @param {string} ogrenciId
 */
export async function ogrenciGetir(ogrenciId) {
  const ref = doc(db, "okullar", _okulId(), "ogrenciler", ogrenciId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Form verisinden risk detaylarını otomatik hesaplar.
 * @param {Object} formVerisi
 * @returns {{ [key: string]: boolean }}
 */
function riskHesapla(formVerisi) {
  const veli  = formVerisi.veli_bilgileri  || {};
  const genel = formVerisi.aile_genel      || {};
  const se    = formVerisi.sosyo_ekonomik  || {};
  const anne  = veli.anne       || {};
  const baba  = veli.baba       || {};
  const bakim = veli.bakim_veren || {};
  return {
    aile_suregen:     anne.kronik_hastalik === "evet" || baba.kronik_hastalik === "evet" || bakim.kronik_hastalik === "evet",
    aile_ruhsal:      anne.ruhsal_hastalik === "evet" || baba.ruhsal_hastalik === "evet" || bakim.ruhsal_hastalik === "evet",
    aile_bagimlilik:  genel.bagimlilik  === "evet",
    cezai_hukum:      genel.cezai_hukum === "evet",
    mevsimlik_isci:   anne.calisma === "mevsimlik" || baba.calisma === "mevsimlik",
    suregen_hastalik: formVerisi.kronik_rahatsizlik === "evet",
    ruhsal_hastalik:  formVerisi.psikolojik_rahatsizlik === "evet",
    maddi_sikinti:    se.sosyal_yardim === "evet" || se.hane_geliri === "lt5000",
  };
}

/**
 * Öğrencinin form bilgilerini günceller.
 * form_dolduruldu: true yapılır, risk kriterleri otomatik hesaplanır.
 * @param {string} ogrenciId
 * @param {Object} formVerisi
 */
export async function formuKaydet(ogrenciId, formVerisi) {
  const ogrenciRef = doc(db, "okullar", _okulId(), "ogrenciler", ogrenciId);
  const ogrenciSnap = await getDoc(ogrenciRef);
  if (!ogrenciSnap.exists()) throw new Error("Öğrenci bulunamadı.");
  const ogrenci = { id: ogrenciSnap.id, ...ogrenciSnap.data() };
  const riskKimligi = ogrenciRiskKimliginiGetir(ogrenci);
  if (!riskKimligi) throw new Error("Öğrenci risk kimliği oluşturulamadı.");
  const riskRef = riskHaritasiDocRef(riskKimligi.risk_belge_id);
  const riskDetaylari = riskHesapla(formVerisi);
  const riskSkoru     = Object.values(riskDetaylari).filter(Boolean).length;
  const gonderimTarihi = new Date();
  await riskHaritasiCreateOnlyCommit(_okulId(), riskKimligi.risk_belge_id, riskBelgesiPayloadiniHazirla(riskKimligi, {
    ogrenci_id: ogrenciId,
    risk_anket_dolduruldu: true,
    form_verisi: formVerisi,
    risk_detaylari: riskDetaylari,
    risk_skoru: riskSkoru,
    gonderim_tarihi: gonderimTarihi,
  }), ogrenciId, {
    risk_anket_dolduruldu: true,
    risk_skoru: riskSkoru,
    gonderim_tarihi: gonderimTarihi,
  });
  return riskRef.id;
}

/**
 * İdare tarafından işaretlenen risk notlarını kaydeder ve risk skorunu günceller.
 * @param {string} ogrenciId
 * @param {{ [key: string]: boolean }} idareNotlari
 */
export async function idareNotlariKaydet(ogrenciId, idareNotlari) {
  const ogrenciRef = doc(db, "okullar", _okulId(), "ogrenciler", ogrenciId);
  const ogrenciSnap = await getDoc(ogrenciRef);
  if (!ogrenciSnap.exists()) throw new Error("Öğrenci bulunamadı.");
  const ogrenci = { id: ogrenciSnap.id, ...ogrenciSnap.data() };
  const riskKimligi = ogrenciRiskKimliginiGetir(ogrenci);
  if (!riskKimligi) throw new Error("Öğrenci risk kimliği oluşturulamadı.");
  const riskRef = riskHaritasiDocRef(riskKimligi.risk_belge_id);
  const riskSnap = await getDoc(riskRef);
  const mevcut = riskSnap.exists()
    ? riskSnap.data()
    : (ogrenciSnap.data() || {});
  const formRiskSayisi  = Object.values(mevcut.risk_detaylari || {}).filter(Boolean).length;
  const idareRiskSayisi = Object.values(idareNotlari).filter(Boolean).length;
  const riskSkoru = formRiskSayisi + idareRiskSayisi;
  const batch = writeBatch(db);

  batch.set(riskRef, riskBelgesiPayloadiniHazirla(riskKimligi, {
    ogrenci_id: ogrenciId,
    idare_notlari: idareNotlari,
    risk_skoru: riskSkoru,
  }), { merge: true });

  batch.update(ogrenciRef, {
    risk_skoru: riskSkoru,
  });

  return await batch.commit();
}

/**
 * Tek öğrenci ekler.
 * @param {Object} ogr  - { tc, ad, soyad, sinif (e.g. "5-A") }
 */
export async function tekOgrenciEkle(ogr) {
  const ref = doc(ogrencilerRef());
  const sinifParts = (ogr.sinif || '').split('-');
  const ogrenciNo = ogrenciNoGetir(ogr);
  await setDoc(ref, {
    ogrenci_no:      ogrenciNo,
    ad:              ogr.ad.trim().toUpperCase(),
    soyad:           ogr.soyad.trim().toUpperCase(),
    cinsiyet:        ogr.cinsiyet?.trim() || '',
    sinif:           (sinifParts[0] || ogr.sinif || '').trim(),
    sube:            (sinifParts[1] || ogr.sube || '').trim().toUpperCase(),
    risk_anket_dolduruldu:    false,
    riba_ogrenci_dolduruldu:  false,
    riba_veli_dolduruldu:     false,
    risk_skoru:      0,
    created_at:      serverTimestamp()
  });
}

/**
 * PDF'den parse edilen öğrenci listesini Firestore'a toplu yazar.
 * Aynı TC'ye sahip öğrenciler zaten varsa atlanır (mükerrer yüklemeyi önler).
 * Firestore writeBatch limiti 500 olduğundan parçalara böler.
 * @param {Array<Object>} ogrenciler  - parse edilmiş öğrenci dizisi
 * @param {string}        okulId      - Firestore okul doküman ID'si
 * @returns {{ eklenen: number, atlanan: number }}
 */
export async function topluOgrenciYukle(ogrenciler, okulId = OKUL_ID) {
  // Mükerrer kayıt önleme: sinif|sube|tc bileşik anahtarı kullan.
  // Aynı binada ortaokul+lise olan okullarda (İmam Hatip vb.) okul numaraları
  // iki kademe arasında tekrar edebilir; tek başına tc yeterli değil.
  const mevcutSnap = await getDocs(ogrencilerRef(okulId));
  const mevcutKeys = new Set(
    mevcutSnap.docs.map(d => {
      const data = d.data();
      return `${data.sinif}|${data.sube}|${ogrenciNoGetir(data)}`;
    })
  );

  const yeniOgrenciler = ogrenciler.filter(
    ogr => !mevcutKeys.has(`${ogr.sinif}|${ogr.sube}|${ogrenciNoGetir(ogr)}`)
  );
  const atlananSayisi  = ogrenciler.length - yeniOgrenciler.length;

  const CHUNK = 500;
  for (let i = 0; i < yeniOgrenciler.length; i += CHUNK) {
    const batch = writeBatch(db);
    yeniOgrenciler.slice(i, i + CHUNK).forEach(ogr => {
      const ref = doc(ogrencilerRef(okulId));
      const ogrenciNo = ogrenciNoGetir(ogr);
      batch.set(ref, {
        ogrenci_no:      ogrenciNo,
        ad:              ogr.ad.trim().toUpperCase(),
        soyad:           ogr.soyad.trim().toUpperCase(),
        cinsiyet:        ogr.cinsiyet || '',
        sinif:           ogr.sinif,
        sube:            ogr.sube,
        kademe:          ogr.kademe || null,
        risk_anket_dolduruldu:    false,
        riba_ogrenci_dolduruldu:  false,
        riba_veli_dolduruldu:     false,
        risk_skoru:      0,
        created_at:      serverTimestamp()
      });
    });
    await batch.commit();
  }
  return { eklenen: yeniOgrenciler.length, atlanan: atlananSayisi };
}

/**
 * e-Okul Özel Eğitim Gereksinimli Öğrenci Listesi PDF'inden parse edilen
 * kayıtları mevcut öğrencilerle eşleştirip idare_notlari ve engel_durumu
 * alanlarını toplu günceller.
 *
 * @param {Array<{ogrNo:string, sinif:string, sube:string, adSoyad:string, engeller:string[]}>} kayitlar
 * @returns {Promise<{eslesen:number, eslesmedi:number}>}
 */
export async function ozelEgitimGuncelle(kayitlar) {
  const [snapshot, riskSnapshot] = await Promise.all([
    getDocs(ogrencilerRef()),
    getDocs(riskHaritalariRef()),
  ]);
  const ogrenciMap = {};
  const ogrenciById = new Map(snapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  const riskIdMap = new Map();
  const riskOgrenciIdMap = new Map();
  const riskAnahtarMap = new Map();
  riskSnapshot.docs.forEach(d => {
    const data = d.data();
    riskIdMap.set(d.id, data);
    if (data?.ogrenci_id) riskOgrenciIdMap.set(data.ogrenci_id, data);
    const ogrenciAnahtari = riskKaydindanOgrenciAnahtariGetir(data);
    if (ogrenciAnahtari) riskAnahtarMap.set(ogrenciAnahtari, data);
  });
  snapshot.docs.forEach(d => {
    const data = d.data();
    const riskKimligi = ogrenciRiskKimliginiGetir({ id: d.id, ...data });
    ogrenciMap[ogrenciNoGetir(data)] = {
      id: d.id,
      ...data,
      __risk: (riskKimligi && riskIdMap.get(riskKimligi.risk_belge_id))
        || (riskKimligi && riskAnahtarMap.get(riskKimligi.ogrenci_anahtari))
        || riskOgrenciIdMap.get(d.id)
        || legacyRiskVerisiniGetir({ id: d.id, ...data }),
    };
  });

  const updates = [];

  for (const kayit of kayitlar) {
    const ogr = ogrenciMap[String(kayit.ogrNo).trim()];
    if (!ogr) continue;

    const engeller = kayit.engeller;
    const hasOzelYetenekli = engeller.some(e => /özel yetenek/i.test(e));
    const hasOzelEgitim    = engeller.some(e => !/özel yetenek/i.test(e));

    const mevcutIdare = ogr.__risk?.idare_notlari || {};
    const yeniIdare   = { ...mevcutIdare };
    if (hasOzelYetenekli) yeniIdare.ozel_yetenekli = true;
    if (hasOzelEgitim)    yeniIdare.ozel_egitim    = true;

    const formRiskSayisi  = Object.values(ogr.__risk?.risk_detaylari || {}).filter(Boolean).length;
    const idareRiskSayisi = Object.values(yeniIdare).filter(Boolean).length;

    updates.push({
      id:           ogr.id,
      idare_notlari: yeniIdare,
      engel_durumu:  engeller,
      risk_skoru:    formRiskSayisi + idareRiskSayisi,
      sinif:         kayit.sinif,
      sube:          kayit.sube,
    });
  }

  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = writeBatch(db);
    updates.slice(i, i + CHUNK).forEach(u => {
      const ogrenciRef = doc(db, "okullar", _okulId(), "ogrenciler", u.id);
      const ogrenci = ogrenciById.get(u.id) || null;
      const riskKimligi = ogrenciRiskKimliginiGetir({ ...(ogrenci || {}), id: u.id, sinif: u.sinif, sube: u.sube });
      if (!riskKimligi) return;
      batch.set(riskHaritasiDocRef(riskKimligi.risk_belge_id), riskBelgesiPayloadiniHazirla(riskKimligi, {
        ogrenci_id: u.id,
        idare_notlari: u.idare_notlari,
        risk_skoru: u.risk_skoru,
      }), { merge: true });
      batch.update(ogrenciRef, {
        engel_durumu:  u.engel_durumu,
        risk_skoru:    u.risk_skoru,
        sinif:         u.sinif,
        sube:          u.sube,
      });
    });
    await batch.commit();
  }

  return { eslesen: updates.length, eslesmedi: kayitlar.length - updates.length };
}

/**
 * e-Okul Ağırlıklı Puan Ortalaması PDF'inden parse edilen kayıtları
 * mevcut öğrencilerle eşleştirip idare_notlari.akademik_dusuk ve
 * not_ortalamasi alanlarını toplu günceller.
 * 70,00 altındaki öğrenciler otomatik olarak akademik_dusuk işaretlenir.
 *
 * @param {Array<{ogrNo:string, adSoyad:string, sinif:string, sube:string, ortalama:number}>} kayitlar
 * @returns {Promise<{eslesen:number, eslesmedi:number, akademikDusuk:number}>}
 */
export async function notOrtalamasiGuncelle(kayitlar) {
  const [snapshot, riskSnapshot] = await Promise.all([
    getDocs(ogrencilerRef()),
    getDocs(riskHaritalariRef()),
  ]);
  const ogrenciMap = {};
  const ogrenciById = new Map(snapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  const riskIdMap = new Map();
  const riskOgrenciIdMap = new Map();
  const riskAnahtarMap = new Map();
  riskSnapshot.docs.forEach(d => {
    const data = d.data();
    riskIdMap.set(d.id, data);
    if (data?.ogrenci_id) riskOgrenciIdMap.set(data.ogrenci_id, data);
    const ogrenciAnahtari = riskKaydindanOgrenciAnahtariGetir(data);
    if (ogrenciAnahtari) riskAnahtarMap.set(ogrenciAnahtari, data);
  });
  snapshot.docs.forEach(d => {
    const data = d.data();
    const riskKimligi = ogrenciRiskKimliginiGetir({ id: d.id, ...data });
    ogrenciMap[ogrenciNoGetir(data)] = {
      id: d.id,
      ...data,
      __risk: (riskKimligi && riskIdMap.get(riskKimligi.risk_belge_id))
        || (riskKimligi && riskAnahtarMap.get(riskKimligi.ogrenci_anahtari))
        || riskOgrenciIdMap.get(d.id)
        || legacyRiskVerisiniGetir({ id: d.id, ...data }),
    };
  });

  const updates = [];
  let akademikDusukSayisi = 0;

  for (const kayit of kayitlar) {
    const ogr = ogrenciMap[String(kayit.ogrNo).trim()];
    if (!ogr) continue;

    // null ortalama = notu olmayan öğrenci → akademik başarısı düşük
    const dusuk = kayit.ortalama === null || kayit.ortalama < 70;
    if (dusuk) akademikDusukSayisi++;

    const mevcutIdare = ogr.__risk?.idare_notlari || {};
    const yeniIdare   = { ...mevcutIdare };
    if (dusuk)                yeniIdare.akademik_dusuk  = true;
    if (kayit.disiplinCezasi) yeniIdare.disiplin_cezasi = true;

    const formRiskSayisi  = Object.values(ogr.__risk?.risk_detaylari || {}).filter(Boolean).length;
    const idareRiskSayisi = Object.values(yeniIdare).filter(Boolean).length;

    const updateEntry = {
      id:            ogr.id,
      idare_notlari: yeniIdare,
      not_ortalamasi: kayit.ortalama, // null kaydedilir — "notu yok" bilgisini korur
      risk_skoru:    formRiskSayisi + idareRiskSayisi,
    };
    updates.push(updateEntry);
  }

  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = writeBatch(db);
    updates.slice(i, i + CHUNK).forEach(u => {
      const ogrenciRef = doc(db, "okullar", _okulId(), "ogrenciler", u.id);
      const ogrenci = ogrenciById.get(u.id) || null;
      const riskKimligi = ogrenciRiskKimliginiGetir(ogrenci);
      if (!riskKimligi) return;
      batch.set(riskHaritasiDocRef(riskKimligi.risk_belge_id), riskBelgesiPayloadiniHazirla(riskKimligi, {
        ogrenci_id: u.id,
        idare_notlari: u.idare_notlari,
        risk_skoru: u.risk_skoru,
      }), { merge: true });
      batch.update(ogrenciRef, {
        not_ortalamasi: u.not_ortalamasi,
        risk_skoru:     u.risk_skoru,
      });
    });
    await batch.commit();
  }

  return {
    eslesen:      updates.length,
    eslesmedi:    kayitlar.length - updates.length,
    akademikDusuk: akademikDusukSayisi,
  };
}

/**
 * Tüm okulları /okullar koleksiyonundan getirir (superadmin için).
 * @returns {Promise<Array<{id:string, okul_adi:string}>>}
 */
export async function tumOkullariGetir() {
  const snap = await getDocs(collection(db, "okullar"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Tek bir okulun adını /okullar/{okulId} dokümanından getirir.
 * @param {string} okulId
 * @returns {Promise<string|null>}
 */
export async function okulAdiniGetir(okulId) {
  if (!okulId) return null;

  const snap = await getDoc(doc(db, "okullar", okulId));
  if (!snap.exists()) return null;

  return snap.data().okul_adi || null;
}

/**
 * Tek bir okulun export ve başlık bilgilerinin tamamını getirir.
 * @param {string} okulId
 * @returns {Promise<{okul_adi:string, rehber_ogretmeni_adi:string, okul_muduru_adi:string}|null>}
 */
export async function okulBilgileriniGetir(okulId) {
  if (!okulId) return null;

  const snap = await getDoc(doc(db, "okullar", okulId));
  if (!snap.exists()) return null;

  const data = snap.data() || {};
  return {
    okul_adi: data.okul_adi || "",
    rehber_ogretmeni_adi: data.rehber_ogretmeni_adi || "",
    okul_muduru_adi: data.okul_muduru_adi || "",
  };
}

/**
 * Bir okulu /okullar/{okulId} dokumanı olarak kaydeder ya da günceller.
 * Tüm okulların listelenmesi için öğrenci yüklemesiyle birlikte çağrılır.
 * @param {string} okulId
 * @param {string} okulAdi
 */
export async function okulKaydet(okulId, okulAdi) {
  const ref = doc(db, "okullar", okulId);
  await setDoc(ref, { okul_adi: okulAdi, guncelleme_tarihi: serverTimestamp() }, { merge: true });
}

/**
 * Okul bazlı export imza alanlarını kaydeder.
 * @param {string} okulId
 * @param {{rehber_ogretmeni_adi?:string, okul_muduru_adi?:string}} bilgiler
 */
export async function okulImzaBilgileriniKaydet(okulId, bilgiler = {}) {
  if (!okulId) throw new Error("Okul bilgisi bulunamadı.");

  const ref = doc(db, "okullar", okulId);
  await setDoc(ref, {
    rehber_ogretmeni_adi: String(bilgiler.rehber_ogretmeni_adi || "").trim(),
    okul_muduru_adi: String(bilgiler.okul_muduru_adi || "").trim(),
    guncelleme_tarihi: serverTimestamp(),
  }, { merge: true });
}
