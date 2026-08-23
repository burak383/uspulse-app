# UsPulse

Uzak mesafe ilişkileri için bir "birlikte yakın kalın" uygulaması. Bu depo iki parçadan oluşuyor:

- `server/` - gerçek bir backend: Express + TypeScript + SQLite (better-sqlite3), JWT ile kimlik doğrulama, davet koduyla eşleşme (pairing), ve tüm ekranların ihtiyaç duyduğu veriler için REST API.
- `mobile/` - Expo (React Native + TypeScript) uygulaması. Orijinal FireVibe.ai çıktısındaki 7 ekran (Yuva, Planlar, Anılar, Biz, Eşleş, Günün Sorusu, Lizbon Hafta Sonu) düzeltilip gerçek navigasyon ve backend'e bağlı hale getirildi.

## Neyin düzeltildiğini bilmek isterseniz

Orijinal ZIP'te **her ekran çöküyordu**: `theme.ts` sadece `Colors`/`Fonts`/`Theme` adında export'lar veriyordu, ama 7 ekranın her biri onu farklı (ve hiçbiri eşleşmeyen) bir şekilde import ediyordu (`import { theme }` + `theme.colors`, `import { colors, fonts }`, `import theme from './theme'`). `theme.ts` artık üç şeklin hepsini export ediyor. Ayrıca birkaç ikon adı (`sparkles`, `message-heart-outline`, `creation-outline`, `calendar-heart-outline`, `coins`) yüklü ikon setinde mevcut değildi - gerçek isimlerle değiştirildi. Hiçbir ekranda navigasyon, state, veya backend bağlantısı yoktu - hepsi statik mockup'tı; artık React Navigation ile gezinip gerçek bir API'den veri okuyup yazıyorlar. `npx tsc --noEmit` hatasız geçiyor ve Metro paketleyicisi (`expo export`) sorunsuz derliyor.

Ayrıca uygulamadaki her veri türü artık uçtan uca **düzenlenebilir ve silinebilir**: dilek listesi/kontrol listesi öğeleri, birikim hedefleri ve katkıları, buluşma bilgisi, anılar ve zaman kapsülleri - hepsinde kalem (düzenle) ve çöp kutusu (sil) ikon butonları var, hepsi gerçek `PATCH`/`DELETE` uçlarına bağlı. Ekranlardaki tüm `Pressable` butonlar taranıp (`onPress` denetimiyle) çalışmayan/boş buton kalmadığı doğrulandı; anlamsız kalan birkaç buton (Yuva'daki hızlı-ekle döşemeleri, bildirim zili, Lizbon örnek ekranındaki "..." menüsü) da gerçek işlevlere bağlandı.

Giriş ekranına da üç yeni gerçek akış eklendi: **şifremi unuttum** (kod tabanlı sıfırlama), **Face ID / parmak izi ile hızlı giriş** ve **Google ile giriş**. Üçü de gerçek backend uçlarına ve gerçek native API'lere bağlı - detaylar için aşağıdaki "Giriş, şifre sıfırlama, Face ID, Google" bölümüne bakın.

## Hızlı başlangıç

### 1) Backend'i ayağa kaldırın

```bash
cd server
cp .env.example .env
npm install
npm run seed   # demo çift oluşturur: Elif & Deniz
npm run dev    # http://localhost:4000
```

Demo giriş bilgileri (seed script çalıştıktan sonra terminalde de yazar):

- `elif@uspulse.app` / `uspulse1234`
- `deniz@uspulse.app` / `uspulse1234`

Bu iki hesap zaten birbiriyle eşleşmiş durumda ve tasarımdaki tüm sayılarla (27 günlük seri, Kaş Kaçamağı birikimi %56, vs.) uyumlu demo verisiyle geliyor.

### 2) Mobil uygulamayı çalıştırın

```bash
cd mobile
npm install
npx expo start
```

Telefonunuzda **Expo Go** ile QR kodu okutun ya da bir simülatör açın.

**Önemli:** Fiziksel bir telefonda test ederken `mobile/.env` içindeki `EXPO_PUBLIC_API_URL` değerini `localhost` yerine bilgisayarınızın yerel ağ (LAN) IP adresine çevirin (örn. `http://192.168.1.20:4000/api`) - telefon için "localhost" kendisi demektir, bilgisayarınız değil. `mobile/.env.example` dosyasını `mobile/.env` olarak kopyalayıp düzenleyin.

## Backend API özeti

Tüm uçlar `Authorization: Bearer <token>` bekler (auth uçları hariç).

| Uç nokta | Açıklama |
|---|---|
| `POST /api/auth/register` | `{name, email, password}` - hesap açar, kendi davet kodunu döner |
| `POST /api/auth/login` | `{email, password}` |
| `POST /api/auth/forgot-password` | `{email}` - hesap varsa 15 dk geçerli bir sıfırlama kodu üretir |
| `POST /api/auth/reset-password` | `{email, code, newPassword}` - kodu doğrular, şifreyi günceller, otomatik giriş yapar |
| `POST /api/auth/google` | `{idToken}` - Google jetonunu doğrular, hesabı bulur/oluşturur, giriş yapar |
| `POST /api/auth/pair` | `{code}` - partnerin davet koduyla eşleşir |
| `GET /api/me` | Kullanıcı + partner + couple bilgisi |
| `GET/PUT /api/reunion` | Buluşma tarihi/yeri/başlığı |
| `GET/POST /api/mood` | Ruh hali |
| `GET/POST /api/touches` | "Kalbimi Gönder" + yakınlık serisi (streak) |
| `GET/POST/PATCH/DELETE /api/memories` | Anılar + zaman kapsülleri |
| `GET /api/questions/today`, `POST /api/questions/today/answer` | Günün sorusu |
| `GET/POST/PATCH/DELETE /api/plans` | Dilek listesi + ortak kontrol listesi |
| `GET/POST/PATCH/DELETE /api/savings`, `POST /api/savings/:id/contribute`, `DELETE /api/savings/:id/contribute/:contributionId` | Ortak birikim + katkılar |

## Giriş, şifre sıfırlama, Face ID, Google

### Şifremi unuttum

Giriş ekranındaki "Şifremi unuttum" linki iki adımlı gerçek bir akış açar: e-postanı girip kod istersin, backend 15 dakika geçerli 6 haneli bir kod üretip `users` tablosuna (bcrypt ile hashlenmiş olarak) kaydeder; ardından kodu ve yeni şifreni girip onaylarsın.

**Önemli sınırlama:** Bu demo backend'ine e-posta/SMS gönderen bir servis (Postmark, SendGrid, Twilio vb.) bağlı değil, yani kod hiçbir yere "gönderilmiyor". Bunun yerine kod sunucu konsoluna yazdırılıyor ve `NODE_ENV=production` olmadığı sürece API yanıtındaki `devCode` alanında da dönüyor - uygulama bu alanı görürse kodu otomatik olarak forma dolduruyor, böylece akış gerçek bir e-posta servisi olmadan da uçtan uca test edilebiliyor. Gerçek kullanıcılarla kullanmadan önce bir e-posta/SMS sağlayıcısı entegre edip `devCode` alanını (zaten `NODE_ENV=production` iken otomatik kapanıyor) kaldırmanız gerekir.

### Face ID / parmak izi ile hızlı giriş

`expo-local-authentication` + `expo-secure-store` ile gerçek, çalışan bir biyometrik giriş var. Şifreyle ilk girişten sonra uygulama "Face ID ile hızlı giriş etkinleştirilsin mi?" diye sorar; evet dersen o oturumun jetonu cihazın güvenli deposuna (Keychain/Keystore) yazılır. Bir dahaki açılışta giriş ekranında "Face ID ile giriş yap" (ya da cihaza göre "Parmak izi ile giriş yap") butonu belirir. Bunun çalışması için fiziksel bir cihazda (ya da biyometri simüle edilmiş bir simülatörde/emülatörde) Face ID/parmak izinin kurulu olması gerekir - kurulu değilse buton hiç görünmez.

### Google ile giriş

Giriş ekranındaki "Google ile giriş yap" butonu `expo-auth-session`'ın Google sağlayıcısını kullanır; backend'de `/api/auth/google` gelen jetonu Google'ın `tokeninfo` uç noktasıyla doğrular, `aud` değerini sizin istemci kimliklerinizle karşılaştırır, e-postayı doğrulanmış bulursa hesabı bulur (ya da e-posta eşleşiyorsa mevcut hesaba Google'ı bağlar, hiçbiri yoksa şifresiz yeni bir hesap açar).

Bunu çalıştırmak için kendi Google OAuth istemci kimliklerinizi girmeniz gerekir - bunlar proje bazlı olduğu için sizin adınıza oluşturamayız:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)'da bir proje açın, OAuth onay ekranını yapılandırın.
2. İhtiyacınız olan platformlar için OAuth istemci kimlikleri oluşturun (iOS, Android, Web - kullandığınız platformlar kadarı yeterli).
3. Bu kimlikleri `server/.env` içindeki `GOOGLE_CLIENT_IDS`e (virgülle ayırarak, jetonu doğrulayan asıl kontrol burada yapılıyor) ve `mobile/.env` içindeki ilgili `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` değişkenlerine ekleyin.
4. Hiçbiri girilmemişse buton yine görünür ama tıklandığında ne yapılması gerektiğini açıklayan bir uyarı gösterir - sessizce hiçbir şey yapmaz.

**Not:** Google'ın OAuth yönlendirmesi native bir "custom scheme" gerektirir (`app.json`'a `"scheme": "uspulse"` zaten eklendi); bazı platformlarda bunun güvenilir çalışması için Expo Go yerine bir geliştirme derlemesi (`npx expo prebuild` + EAS dev client ya da yerel bir derleme) gerekebilir.

## Kapsam dışı bırakılanlar (bilerek)

- Gerçek konum/mesafe takibi, pil yüzdesi paylaşımı: sadece kozmetik demo verisi olarak kaldı (arka planda gerçek bir konum servisi kurmak ayrı bir proje).
- Fotoğraf/ses/video yükleme: `Anılar` ekranında not (ve zaman kapsülü) tabanlı anı ekleme/düzenleme/silme tam çalışıyor; gerçek dosya yükleme (kamera, ses kaydı) için bir depolama servisi (S3/Cloudinary vb.) eklenmesi gerekir - Yuva ekranındaki "Fotoğraf/Çizim/Ses notu" kısayolları şimdilik sizi Anılar ekranına yönlendirip oradan not olarak eklemenizi sağlıyor.
- "UsPulse Plus" premium akışı, mağaza/ödeme entegrasyonu: tasarımda zaten kilitli/teaser olarak sunulmuş, öyle bırakıldı.
- Push bildirimleri.
- Gerçek e-posta/SMS gönderimi: şifre sıfırlama kodu çalışıyor ama hiçbir yere iletilmiyor, sadece konsola ve (dev modda) API yanıtına yazılıyor - ayrıntı için yukarıdaki "Şifremi unuttum" bölümüne bakın.
- Google dışında başka bir sosyal girişi (Apple, Facebook vb.) yok; aynı desenle (`/api/auth/google`'a benzer bir uç + jeton doğrulama) eklenebilir.

## Depo yapısı

```
uspulse-app/
  server/     backend (Express + SQLite)
  mobile/     Expo React Native uygulaması
```
