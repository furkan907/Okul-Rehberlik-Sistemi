# Tek Platform Yol Haritasi

Bu dokuman, elde bulunan farkli okul sistemlerini zaman icinde tek bir platform altinda toplamak icin hazirlanmis teknik ve operasyonel planlama metnidir.

Amac tek bir dev repo yapmak degil; once tek kimlik, tek giris, ortak tasarim sistemi ve ortak mimari standartlar olusturmak; daha sonra modulleri kontrollu bicimde ayni platform altinda yasatmaktir.

Bu dokumanin hedef kitlesi:

- Sistemi uzun vadede gelistirecek kisi veya ekip
- Ileride projede degisiklik yapacak AI agent'lar
- Hangi modulu nereye tasimak gerektigine karar verecek teknik sorumlu

## 1. Vizyon

Hedef tek bir site gorunumu veren, ancak iceride moduler calisan bir okul yonetim platformu kurmaktir.

Platformun uzun vadeli hedefi:

- Tek giris ekrani
- Tek kullanici ve rol modeli
- Tek okul baglami
- Moduler uygulamalar
- Ortak tasarim sistemi
- Ortak deploy ve cache stratejisi
- Ortak veri adlandirma standardi

Platform icerisinde zamanla su moduller yasanabilir:

- Deneme Takip Sistemi
- Rehberlik Sistemi
- RIBA ve risk haritasi modulleri
- Ogrenci dosyalari / form takibi
- Raporlama modulleri
- Gelecekte eklenebilecek farkli okul yonetim araclari

Bu nedenle dogru hedef "tek site" degil, "tek platform"dur.

## 2. Temel Mimari Ilke

Platformun ana ilkesi sunmalidir:

1. Kullanici bir kez giris yapar.
2. Yetkileri ve okul baglami tek yerden belirlenir.
3. Kullanici ayni oturum icinde farkli moduller arasinda gecis yapar.
4. Moduller is mantigi olarak bagimsiz kalabilir.
5. Ortak servisler tekillestirilir.

Bu model, "moduler monolit" veya "ortak shell altinda moduller" yaklasimi olarak dusunulmelidir.

## 3. Hedef Mimarinin Katmanlari

### 3.1 Kimlik Katmani

Tum moduller icin tek auth sistemi kullanilmalidir.

Onerilen yapı:

- Firebase Auth veya esdeger tek kimlik katmani
- Custom claims ile rol yonetimi
- Ortak session yonetimi
- Ortak kullanici profil dokumani

Ortak kimlik modelinde en az su alanlar standart olmalidir:

- `uid`
- `role`
- `okul_id`
- `okul_adi`
- `ad_soyad`
- `aktif_moduller`
- `izinler`

### 3.2 Platform Shell

Tum modullerin ustunde ortak bir platform kabugu bulunmalidir.

Bu shell su gorevleri ustlenir:

- Login
- Logout
- Aktif okul secimi
- Aktif yil / donem secimi
- Yetki kontrolu
- Sol menu / ust menu
- Bildirimler
- Ortak hata gostergeleri
- Moduller arasi gecis

### 3.3 Modul Katmani

Her uygulama ayri bir modul olarak ele alinmalidir.

Ornek moduller:

- `exam-tracking`
- `guidance`
- `riba`
- `risk-map`
- `reporting`

Bu moduller:

- Kendi ekran akisini korur
- Kendi is mantigina sahip olur
- Ortak auth ve ortak UI katmanini kullanir
- Ortak veri ve cache kurallarina uyar

### 3.4 Veri ve Servis Katmani

Tum moduller, veri erisimini ortak prensiplerle yapmalidir.

Ana ilke:

- UI katmani dogrudan her yere dağilmis Firestore erisimi yapmamalidir.
- Veri erisimi servis veya data katmanina alinmalidir.

## 4. Neden Dogrudan Hepsini Birlestirmemek Gerekir

Erken asamada tum sistemleri tek repo veya tek kod tabanina zorla eritmek risklidir.

Ana riskler:

- Calisan sistemleri bozma riski
- Veri modeli cakismalari
- Yetki modeli karisikliklari
- Deploy karmasasi
- Debug zorlasmasi
- Bir moduldaki degisiklik digerini bozabilir

Bu nedenle dogru yol su siradir:

1. Ortak standartlari yaz
2. Ortak auth modelini kur
3. Ortak platform shell kur
4. Modulleri shell altinda calistir
5. Ortak component ve servisleri tekillestir
6. Ancak sonra fiziksel repo birlesimini dusun

## 5. Fazlara Bolunmus Gecis Plani

### Faz 0 - Envanter ve Standartlastirma

Bu fazda hicbir buyuk birlesim yapilmaz. Sadece mevcut sistemler haritalanir.

Yapilacaklar:

- Tum alt sistemleri listele
- Her sistemin amacini yaz
- Her sistemin auth modelini yaz
- Her sistemin veri kaynaklarini yaz
- Her sistemin deploy yontemini yaz
- Her sistemdeki ortak alanlari tespit et

Bu fazin ciktilari:

- Sistem envanteri
- Ortak terimler sozlugu
- Ortak rol sozlugu
- Veri modeli esleme tablosu

### Faz 1 - Ortak Teknik Standartlar

Bu fazda tum sistemlerin uymasi gereken kurallar belirlenir.

Belirlenecek standartlar:

- Dosya ve klasor yerlesimi
- CSS dosya yapisi
- JS modullerinin ayrimi
- Constants / config standardi
- Firebase baglanti modeli
- Hata yonetimi
- Cache stratejisi
- Deploy akisi
- Dokumantasyon standardi

Bu fazin hedefi, farkli sistemlerin birbirine benzemesini saglamaktir.

### Faz 2 - Ortak Kimlik ve Rol Yapisi

Bu fazda tek girise hazirlik yapilir.

Yapilacaklar:

- Ortak kullanici profili semasi tanimla
- Rolleri normalize et
- Modullere gore izinleri ayir
- Okul bazli yetki modelini sabitle
- Ortak auth helper katmani olustur

Ornek rol duzeyi:

- `student`
- `teacher`
- `guidance`
- `admin`
- `superadmin`

Ornek izin alanlari:

- `exam.read`
- `exam.write`
- `guidance.read`
- `guidance.write`
- `riba.read`
- `riba.write`
- `reports.export`
- `system.manage`

### Faz 3 - Ortak Platform Shell

Bu fazda tek girisli ana portal yapisi kurulur.

Yapilacaklar:

- Tek login sayfasi
- Tek dashboard shell
- Ortak sol menu
- Moduller arasi gecis yapisi
- Ortak ust bar
- Ortak bildirim sistemi
- Ortak okul secici

Bu faz sonunda kullanici ayni platform icinde farkli modullere gecebilir.

### Faz 4 - Modullerin Tasinmasi

Bu fazda moduller tek tek ortak shell altina alinir.

Onerilen sira:

1. Deneme Takip
2. Rehberlik Ana Modulu
3. RIBA / Risk Haritasi
4. Raporlama ve export modulleri
5. Diger yardimci okul araclari

Her modul tasinirken:

- UI shell'e baglanir
- Auth ortaklastirilir
- Config ortaklastirilir
- Eski kod parcalari temizlenir
- Dokumantasyon guncellenir

### Faz 5 - Ortak Tasarim Sistemi

Bu fazda tum alt sistemlerde benzer bir UI dili saglanir.

Standartlastirilacak alanlar:

- Renk degiskenleri
- Font ailesi ve font dosyalari
- Kart yapisi
- Buton yapisi
- Form bileşenleri
- Tablo stili
- Panel layout yapisi
- Mobil davranislar

Amac tek tip gorunmek degil, tek platforma ait hissettirmektir.

### Faz 6 - Ortak Veri ve Servis Katmani

Bu fazda veri erisimi ve backend taraflari sadeleştirilir.

Yapilacaklar:

- Ortak constants modulu
- Ortak data access helpers
- Ortak metadata modeli
- Ortak cache invalidation modeli
- Ortak export / report servisleri

### Faz 7 - Repo Yaklastirma veya Birlesim

Bu en son dusunulmelidir.

Iki olasi model:

- Ayrı repolar, ortak teknik standartlar
- Tek ana repo, moduller alt klasorlerde

Oneri: Once mantiksal platform birligi, daha sonra fiziksel repo karari.

## 6. Klasor ve Dosya Yerlesim Standardi

Kullanim kolayligi icin tum alt sistemlerde benzer yerlesim olmalidir.

Onerilen frontend yapisi:

```text
platform/
├─ docs/
├─ apps/
│  ├─ portal/
│  ├─ exam-tracking/
│  ├─ guidance/
│  ├─ riba/
│  └─ reporting/
├─ shared/
│  ├─ assets/
│  │  ├─ images/
│  │  ├─ fonts/
│  │  └─ icons/
│  ├─ styles/
│  │  ├─ tokens.css
│  │  ├─ base.css
│  │  ├─ layout.css
│  │  ├─ forms.css
│  │  ├─ tables.css
│  │  └─ components.css
│  ├─ js/
│  │  ├─ constants/
│  │  ├─ auth/
│  │  ├─ data/
│  │  ├─ cache/
│  │  ├─ ui/
│  │  ├─ utils/
│  │  └─ exports/
│  └─ components/
├─ backend/
│  ├─ api/
│  ├─ jobs/
│  ├─ shared/
│  └─ docs/
└─ tools/
   ├─ deploy/
   ├─ scripts/
   └─ maintenance/
```

Eger su an icin tek repo icinde ilerlenmeyecekse bile mantik ayni tutulmalidir.

## 7. CSS ve Tasarim Dosyalari Icin Standart

Sizin istediginiz seylerden biri, dosya adlarindan ve klasor yapisindan bile neyin nerede oldugunun anlasilmasidir. Bu cok dogru bir hedef.

Onerilen CSS stratejisi:

- `tokens.css`: renk, spacing, radius, shadow, z-index, font degiskenleri
- `base.css`: reset, html, body, tipografi, link, genel elementler
- `layout.css`: grid, shell, header, sidebar, page containers
- `forms.css`: input, select, button, label, validation
- `tables.css`: tablo, filtre bar, export alanlari, responsive tablolar
- `components.css`: badge, modal, card, tabs, toast, loader
- `pages/*.css`: sadece sayfaya ozel istisnalar

Ana kural:

- Ortak stiller ortak dosyalarda olmalı
- Sayfa css dosyasi sadece sayfaya ozel olanlari tutmali
- Bir buton stili her sayfada yeniden yazilmamali

## 8. JavaScript Modulleri Icin Standart

Onerilen JS yapisi:

- `constants/`: config, selectors, route sabitleri, alan adlari
- `auth/`: login, session, guard, role helpers
- `data/`: Firestore veya API veri erisim katmani
- `cache/`: local/session cache wrappers
- `ui/`: render helpers, interaction helpers, page shell
- `utils/`: format, tarih, string, validate helperlari
- `exports/`: excel, pdf, csv islemleri
- `pages/`: her sayfanin orkestrasyon dosyasi

Bu ayrim su soruyu kolaylastirir: "Bu degisiklik nereye yapilmali?"

## 9. Ortak Veri Adlandirma Standardi

Gelecekte birlestirme icin veri isimleri kritik hale gelir.

Standartlastirilmasi onerilen ana alanlar:

- `okul_id`
- `okul_adi`
- `kullanici_id`
- `ad_soyad`
- `role`
- `permissions`
- `created_at`
- `updated_at`
- `created_by`
- `status`
- `year`
- `term`
- `module`

Ana ilke:

- Her yerde ayni kavram ayni isimle gecmeli
- Kisa ama belirsiz isimlerden kacınılmalı
- Turkce veya Ingilizce tercihinde bir standard belirlenmeli

## 10. Dokumantasyon Standardi

Her alt sistemde asgari olarak su dokumanlar olmali:

- `README.md`
- `TeknikDetaylar.md` veya esdegeri
- `DEPLOY.md`
- `DATA_MODEL.md`
- `ARCHITECTURE.md`

Buyuk kural:

- AI agent bir repoya girdiginde once bu dokumanlari okuyup hareket etmeli

## 11. Rehberlik Sistemini Bu Hedefe Hazirlama Listesi

Mevcut rehberlik sistemi tarafinda, tek platform hedefine hazirlik icin yapilmasi gerekenler:

1. Ortak constants katmani olusturmak
2. Auth ve okul baglami tek dosyada toplamak
3. Veri erisimini servis katmanina daha net ayirmak
4. UI stillerini ortak ve sayfaya ozel olarak ayirmak
5. Export mekanizmalarini ayri modullerde toplamak
6. Sayfa bazli JS dosyalarinda orchestration disinda mantik birikmesini azaltmak
7. Teknik bir referans dokuman yazmak
8. Deploy / cache / versioning akisini acik ve tekrar edilebilir hale getirmek

## 12. Onerilen Kisa Vadeli Yol

Bugunden itibaren en mantikli siralama su olur:

### 12.1 Rehberlik Sistemini Toparlama

- Kod tabanini modullestir
- Ortak naming convention belirle
- CSS yapisini standardize et
- Teknik referans dokumani yaz

### 12.2 Ortak Tasarim Diline Gecis

- Ortak renk tokenlari
- Ortak login yapisi
- Ortak kart ve tablo stilleri
- Ortak layout kaliplari

### 12.3 Ortak Auth Hazirligi

- Tek kullanici profili modelini tasarla
- Rol ve izinleri normalize et
- Okul baglami standardi belirle

### 12.4 Portal Shell Tasarimi

- Sol menu mimarisi
- Modul giris noktalari
- Dashboard / ana platform sayfasi

## 13. Basari Kriterleri

Bu planin basarili sayilmasi icin su kosullar saglanmalidir:

- Kullanici tek hesapla tum modullere gecis yapabilmeli
- Moduller birbirini bozmadan gelisebilmeli
- Bir gelistirici veya AI agent kodda neyin nerede oldugunu hizli anlayabilmeli
- Deploy akislari tahmin edilebilir olmali
- Veri modelleri kontrolsuz buyumemeli
- Tasarim dili moduller arasinda tanidik kalmali

## 14. Son Karar Onerisi

Uzun vadede hedef su olmalidir:

- Tek giris
- Tek platform shell
- Moduler uygulamalar
- Ortak tasarim sistemi
- Ortak auth ve veri standardi

Ama gecis yontemi su olmalidir:

- Once standartlastir
- Sonra ortaklastir
- En son birlestir

Bu siralama, hem teknik riski azaltir hem de eldeki calisan sistemlerin gucunu korur.