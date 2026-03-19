# 🚀 WECODE ONLİNE — KURULUM REHBERİ
## (Hiç bilmesen de yapabilirsin, adım adım)

---

## 📋 GENEL PLAN
```
Sen bu klasördeki dosyaları → GitHub'a yüklersin
GitHub'daki dosyaları → Render.com çalıştırır (sunucu)
Yeğenler → tarayıcıdan bağlanır, oynayabilir!
```

---

## ADIM 1: GitHub Hesabı Aç (ücretsiz)

1. https://github.com adresine git
2. "Sign up" butonuna tıkla
3. E-posta, şifre, kullanıcı adı gir
4. Hesabını onayla (e-postana kod gelir)

---

## ADIM 2: Yeni Proje (Repository) Oluştur

1. GitHub'a giriş yap
2. Sağ üstteki **+** butonuna tıkla → "New repository"
3. Repository name: **wecode-oyunu**
4. Public seç (ücretsiz hosting için gerekli)
5. **"Create repository"** butonuna tıkla

---

## ADIM 3: Dosyaları GitHub'a Yükle

1. Oluşturduğun repository sayfasında
   **"uploading an existing file"** linkine tıkla
2. Bu ZIP içindeki TÜM dosyaları sürükle-bırak:
   - server.js
   - package.json
   - .gitignore
   - public/ klasörünün içindekileri de dahil et
     (public klasörünü olduğu gibi sürükle)
3. En altta "Commit changes" yeşil butonuna tıkla
4. ✅ Dosyalar GitHub'da!

---

## ADIM 4: Render.com Hesabı Aç (ücretsiz)

1. https://render.com adresine git
2. **"Get Started for Free"** butonuna tıkla
3. **"Continue with GitHub"** seç
   (GitHub hesabınla giriş yaparsın, ayrı şifre gerekmez)
4. Render.com sana GitHub'a erişim izni isteyecek → onayla

---

## ADIM 5: Render.com'da Sunucu Oluştur

1. Render.com'da giriş yaptıktan sonra:
   **"New +"** → **"Web Service"** tıkla
2. GitHub repository listesinden **wecode-oyunu** seç
   (görmüyorsan "Configure account" tıkla ve izin ver)
3. Şu ayarları yap:

   | Ayar | Değer |
   |------|-------|
   | Name | wecode-oyunu |
   | Region | Frankfurt (EU Central) |
   | Branch | main |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `node server.js` |
   | Instance Type | **Free** |

4. **"Create Web Service"** butonuna tıkla
5. Deploy başlar, 2-3 dakika bekle
6. Yeşil **"Live"** yazısı çıkınca hazır!
7. Sayfanın üstünde şöyle bir URL göreceksin:
   ```
   https://wecode-oyunu.onrender.com
   ```
   Bu URL'yi bir yere kaydet!

---

## ADIM 6: Oyunu Test Et

1. https://wecode-oyunu.onrender.com adresine git
   (ilk açılış 30 saniye sürebilir — bu normal)
2. İki farklı tarayıcı sekmesi aç
3. İlk sekmede: Ad gir → "Oda Oluştur" tıkla → 6 haneli kodu gör
4. İkinci sekmede: Aynı adresi aç → Ad gir → Kodu yapıştır → "Odaya Katıl"
5. Oyun başlamalı! 🎉

---

## ADIM 7 (İSTEĞE BAĞLI): Kendi Domain'ini Bağla

Eğer bendevarimturkiye.com'dan oynamasını istiyorsan:

1. Render.com'da servisine gir → "Settings" → "Custom Domains"
2. **"Add Custom Domain"** tıkla
3. `wecode.bendevarimturkiye.com` yaz
4. Render sana bir **CNAME değeri** verecek, şöyle bir şey:
   ```
   wecode-oyunu.onrender.com
   ```
5. Plesk paneline git:
   - Domains → bendevarimturkiye.com → DNS Settings
   - Yeni kayıt ekle:
     - Type: **CNAME**
     - Host: **wecode**
     - Value: (Render'ın verdiği adres)
6. 10-30 dakika bekle
7. Artık https://wecode.bendevarimturkiye.com adresinden oynanabilir!

---

## ⚠️ BİLMEN GEREKENLER

**Ücretsiz Render hesabında:**
- 15 dakika kimse bağlanmazsa sunucu "uyuyor"
- İlk bağlantıda 30-60 saniye bekleme olabilir
- Bu tamamen normaldir, oyun başladıktan sonra hızlıdır

**Çözüm (isteğe bağlı):**
- Render'da "Cron Job" ekleyerek her 10 dakikada
  sunucuya ping atabilirsin (uyumasını önler)
- Veya aylık $7 ücretli plana geçebilirsin

---

## 🆘 SORUN OLURSA

Render'da deploy hatası çıkarsa:
1. "Logs" sekmesine tıkla, kırmızı hata mesajını oku
2. En yaygın sorun: package.json'daki yazım hatası

GitHub'a dosya yükleyemiyorsan:
1. Dosya adlarında Türkçe karakter olmamalı
2. Klasör boyutu 100MB altında olmalı (bizimki çok küçük, sorun olmaz)
