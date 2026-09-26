/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RiskDetails {
  anne_hayatta: boolean;
  baba_hayatta: boolean;
  parcalanmis_aile: boolean;
  ekonomik_durum: 'Iyi' | 'Orta' | 'Kotu' | '';
  saglik_sorunu: boolean;
  ozel_egitim_ihtiyacı: boolean;
  devamsizlik_riski: boolean;
  diger_notlar?: string;
}

export interface Student {
  id: string; // Genellikle T.C. Kimlik No
  tc: string;
  ad: string;
  soyad: string;
  sinif: string;
  sube: string;
  form_dolduruldu: boolean;
  risk_skoru: number;
  risk_detaylari: RiskDetails | null;
  son_guncellenme: any; // Firestore Timestamp
}
