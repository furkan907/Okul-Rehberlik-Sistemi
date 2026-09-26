// ============================================================
// js/firebase.js
// Firebase uygulamasının tek başlatma noktası.
// Tüm diğer servisler db ve auth'u buradan import eder.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAXtE8-TGv-hHaUE0t4cNq9QvrYOBZxQow",
  authDomain:        "okulrehberliksistemi.firebaseapp.com",
  projectId:         "okulrehberliksistemi",
  storageBucket:     "okulrehberliksistemi.firebasestorage.app",
  messagingSenderId: "708605236949",
  appId:             "1:708605236949:web:02418ac5ac96e292bdf45c"
};

export const FIREBASE_CONFIG = firebaseConfig;

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Tek okul mimarisi için varsayılan okul ID'si.
// Gerçek okul ID'si kullanıcı profilinden (Firestore /users/{uid}) okunur.
// Herkese açık sayfalarda URL paramütreüzerinden gelir (?okul=...).
export const OKUL_ID = "okul-001";
