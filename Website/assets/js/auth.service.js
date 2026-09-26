// ============================================================
// js/auth.service.js
// Firebase Auth işlemleri: giriş, çıkış, durum takibi.
// ============================================================

import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Admin e-posta ve şifre ile giriş yapar.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<UserCredential>}
 */
export async function adminGirisYap(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

/**
 * Mevcut kullanıcıyı sistemden çıkarır.
 */
export async function cikisYap() {
  return await signOut(auth);
}

/**
 * Şifre sıfırlama e-postası gönderir.
 * Kullanıcı mail adresini girer, Firebase bu adrese sıfırlama bağlantısı yollar.
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function sifreSifirlamaMailiGonder(email) {
  return await sendPasswordResetEmail(auth, email);
}

/**
 * Auth durum değişikliğini dinler.
 * @param {Function} callback - (user) => void
 */
export function authDurumDinle(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Anlık oturum açmış kullanıcıyı döner.
 */
export function mevcutKullanici() {
  return auth.currentUser;
}

/**
 * Kullanıcının Firestore profilini getirir.
 * Profil yoksa varsayılan superadmin profili döner (ilk kurulum için).
 * @param {string} uid
 * @returns {Promise<{role:string, okul_id:string|null, okul_adi:string|null}>}
 */
export async function kullaniciProfilGetir(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  // Profil yoksa erişimi reddet.
  // Superadmin hesabı Firebase Console'dan /users/{uid} belgesi oluşturularak tanımlanır.
  return { role: "erisim-yok", okul_id: null, okul_adi: null };
}

/**
 * Kullanıcı profilini Firestore'a kaydeder (oluşturma veya güncelleme).
 * @param {string} uid
 * @param {{role?:string, okul_id?:string, okul_adi?:string}} data
 */
export async function kullaniciProfilKaydet(uid, data) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, data, { merge: true });
}

/**
 * Yeni okul yöneticisi hesabı oluşturur ve profili Firestore'a "beklemede" olarak kaydeder.
 * @param {string} email
 * @param {string} password
 * @param {string} okulId
 * @param {string} okulAdi
 * @param {string} adSoyad
 */
export async function kullaniciKayitOl(email, password, okulId, okulAdi, adSoyad, telefon, requestedRole) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await kullaniciProfilKaydet(credential.user.uid, {
    role:           "beklemede",
    requested_role: requestedRole || "admin",
    okul_id:        okulId,
    okul_adi:       okulAdi,
    ad_soyad:       adSoyad,
    telefon:        telefon || "",
    email,
    kayit_tarihi:   new Date().toISOString(),
  });
  return credential;
}

/**
 * Onay bekleyen kullanıcıları getirir (yalnızca süperadmin kullanır).
 * @returns {Promise<Array>}
 */
export async function bekleyenKullanicilariGetir() {
  const q = query(collection(db, "users"), where("role", "==", "beklemede"));
  const snap = await getDocs(q);
  const tum = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  // Sadece yönetici talepleri — öğretmen onayı admin panelinden yapılır
  return tum.filter(u => !u.requested_role || u.requested_role === "admin");
}

/**
 * Bekleyen kullanıcıyı onaylar.
 * - requested_role === "admin"    → role: "admin", /okullar/{okul_id} güncellenir
 * - requested_role === "ogretmen" → role: "ogretmen", isteğe bağlı siniflar kaydedilir
 * @param {string} uid
 * @param {string[]} [siniflar] - Öğretmene atanacak sınıflar (isteğe bağlı)
 */
export async function kullaniciOnayla(uid, siniflar = []) {
  const profilSnap = await getDoc(doc(db, "users", uid));
  const data = profilSnap.data() || {};
  const hedefRol = data.requested_role || "admin";

  const updateData = { role: hedefRol };
  if (siniflar.length > 0) updateData.siniflar = siniflar;

  await updateDoc(doc(db, "users", uid), updateData);

  // Admin onaylandıysa okul belgesini güncelle
  if (hedefRol === "admin" && data.okul_id) {
    await setDoc(
      doc(db, "okullar", data.okul_id),
      { has_admin: true, admin_uid: uid, okul_adi: data.okul_adi || data.okul_id },
      { merge: true }
    );
  }
}

/**
 * Belirtilen okul için onay bekleyen öğretmen taleplerini getirir (admin kullanır).
 * @param {string} okulId
 * @returns {Promise<Array>}
 */
export async function bekleyenOgretmenleriGetir(okulId) {
  const q = query(
    collection(db, "users"),
    where("role", "==", "beklemede"),
    where("requested_role", "==", "ogretmen"),
    where("okul_id", "==", okulId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

/**
 * Bekleyen kullanıcıyı reddeder (role → "reddedildi").
 * @param {string} uid
 */
export async function kullaniciReddet(uid) {
  await updateDoc(doc(db, "users", uid), { role: "reddedildi" });
}

/**
 * Kayıt formundaki okul seçim listesi için tüm okulları getirir.
 * Oturum gerektirmez (/okullar public read kuralıyla).
 * @returns {Promise<Array<{id:string, okul_adi:string}>>}
 */
export async function okulListesiGetir() {
  const snap = await getDocs(collection(db, "okullar"));
  return snap.docs
    .map(d => ({ id: d.id, okul_adi: d.data().okul_adi || d.id }))
    .sort((a, b) => (a.okul_adi || '').localeCompare(b.okul_adi || '', 'tr'));
}

/**
 * Belirli bir okul için zaten onaylanmış bir admin var mı kontrol eder.
 * @param {string} okulId
 * @returns {Promise<boolean>}
 */
export async function okulAdminVarMi(okulId) {
  const snap = await getDoc(doc(db, "okullar", okulId));
  return snap.exists() && snap.data().has_admin === true;
}

/**
 * Tüm kullanıcıları getirir (yalnızca superadmin kullanır).
 * @returns {Promise<Array>}
 */
export async function tumKullanicilariGetir() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

/**
 * Kullanıcıyı Firestore'dan siler (Auth hesabı kalır ama erişim engellenir).
 * @param {string} uid
 */
export async function kullaniciSil(uid) {
  await deleteDoc(doc(db, "users", uid));
}
