# UsPulse

Uzak mesafe ilişkileri için bir "birlikte yakın kalın" uygulaması. Bu depo iki parçadan oluşuyor:

- `server/` - gerçek bir backend: Express + TypeScript + SQLite (better-sqlite3), JWT ile kimlik doğrulama, davet koduyla eşleşme (pairing), ve tüm ekranların ihtiyaç duyduğu veriler için REST API.
- `mobile/` - Expo (React Native + TypeScript) uygulaması. Orijinal FireVibe.ai çıktısındaki 7 ekran (Yuva, Planlar, Anılar, Biz, Eşleş, Günün Sorusu, Lizbon Hafta Sonu) düzeltilip gerçek navigasyon ve backend'e bağlı hale getirildi.

## Neyin düzeltildiğini bilmek isterseniz

Orijinal ZIP'te **her ekran çöküyordu**: `theme.ts` sadece `Colors`/`Fonts`/`Theme` adında export'lar veriyordu, ama 7 ekranın her biri onu farklı (ve hiçbiri eşleşmeyen) bir şekilde import ediyordu (`import { theme }` + `theme.colors`, `import { colors, fonts }`, `import theme from './theme'`). `theme.ts` artık üç şeklin hepsini export ediyor. Ayrıca birkaç ikon adı (`sparkles`, `message-heart-outline`, `creation-outline`, `calendar-heart-outline`, `coins`) yüklü ikon setinde mevcut değildi - gerçek isimlerle değiştirildi. Hiçbir ekranda navigasyon, state, veya backend bağlantısı yoktu - hepsi statik mockup'tı; artık React Navigation ile gezinip gerçek bir API'den veri okuyup yazıyorlar. `npx tsc --noEmit` hatasız geçiyor ve Metro paketleyicisi (`expo export`) sorunsuz derliyor.

Ayrıca uygulamadaki her veri türü artık uçtan uca **düzenlenebilir ve silinebilir**: dilek listesi/kontrol listesi öğeleri, birikim hedefleri ve katkıları, buluşma bilgisi, anılar ve zaman kapsülleri - hepsinde kalem (düzenle) ve çöp kutusu (sil) ikon butonları var, hepsi gerçek `PATCH`/`DELETE` uçlarına bağlı. Ekranlardaki tüm `Pressable` butonlar taranıp (`onPress` denetimiyle) çalışmayan/boş buton kalmadığı doğrulandı; anlamsız kalan birkaç buton (Yuva'daki hızlı-ekle döşemeleri, bildirim zili, Lizbon örnek ekranındaki "..." menüsü) da gerçek işlevlere bağlandı.

Giriş ekranına da iki yeni gerçek akış eklendi: **şifremi unuttum** (kod tabanlı sıfırlama) ve **Google ile giriş**. İkisi de gerçek backend uçlarına ve gerçek native API'lere bağlı - detaylar için aşağıdaki "Giriş, şifre sıfırlama, Google" bölümüne bakın.

## Hızlı başlangıç

### 1) Backend'i ayağa kaldırın

```bash
cd server
cp .env.example .env
npm install
npm run dev    # http://localhost:4000
```

Otomatik oluşturulan bir demo hesap yok - `POST /api/auth/register` ile kendi hesabınızı oluşturup `POST /api/auth/pair` (mobil tarafta Eşleş ekranındaki davet kodu akışı) ile eşleşin.

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

## Giriş, şifre sıfırlama, Google

### Şifremi unuttum

Giriş ekranındaki "Şifremi unuttum" linki iki adımlı gerçek bir akış açar: e-postanı girip kod istersin, backend 15 dakika geçerli 6 haneli bir kod üretip `users` tablosuna (bcrypt ile hashlenmiş olarak) kaydeder; ardından kodu ve yeni şifreni girip onaylarsın.

**Önemli sınırlama:** Bu demo backend'ine e-posta/SMS gönderen bir servis (Postmark, SendGrid, Twilio vb.) bağlı değil, yani kod hiçbir yere "gönderilmiyor". Bunun yerine kod sunucu konsoluna yazdırılıyor ve `NODE_ENV=production` olmadığı sürece API yanıtındaki `devCode` alanında da dönüyor - uygulama bu alanı görürse kodu otomatik olarak forma dolduruyor, böylece akış gerçek bir e-posta servisi olmadan da uçtan uca test edilebiliyor. Gerçek kullanıcılarla kullanmadan önce bir e-posta/SMS sağlayıcısı entegre edip `devCode` alanını (zaten `NODE_ENV=production` iken otomatik kapanıyor) kaldırmanız gerekir.

### Google ile giriş

Giriş ekranındaki "Google ile giriş yap" butonu native `@react-native-google-signin/google-signin` kütüphanesini kullanır (Expo'nun `expo-auth-session` tabanlı tarayıcı akışı deprecated ilan edildi ve Google artık bunu reddediyor); backend'de `/api/auth/google` gelen jetonu Google'ın `tokeninfo` uç noktasıyla doğrular, `aud` değerini sizin istemci kimliklerinizle karşılaştırır, e-postayı doğrulanmış bulursa hesabı bulur (ya da e-posta eşleşiyorsa mevcut hesaba Google'ı bağlar, hiçbiri yoksa şifresiz yeni bir hesap açar).

Bunu çalıştırmak için kendi Google OAuth istemci kimliklerinizi girmeniz gerekir - bunlar proje bazlı olduğu için sizin adınıza oluşturamayız:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)'da bir proje açın, OAuth onay ekranını yapılandırın.
2. Bir **Web application** tipinde OAuth istemcisi oluşturun (her iki platformda da `webClientId` olarak kullanılır, jetonun `aud` alanı buna göre doğrulanır) ve ayrıca uygulamanın paket adı (`app.uspulse.mobile`) + imzalayan keystore'un SHA-1 parmak iziyle bir **Android** istemcisi (iOS için bundle ID ile bir **iOS** istemcisi) kaydedin.
3. Web istemci kimliğini `server/.env` içindeki `GOOGLE_CLIENT_IDS`e (virgülle ayırarak, jetonu doğrulayan asıl kontrol burada yapılıyor) ve `mobile/.env` içindeki `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`'ye ekleyin.
4. Hiçbiri girilmemişse buton yine görünür ama tıklandığında ne yapılması gerektiğini açıklayan bir uyarı gösterir - sessizce hiçbir şey yapmaz.

**Not:** Native kod içerdiği için Expo Go'da çalışmaz - `npx expo prebuild` + EAS/yerel bir derleme (dev client, debug ya da release build) gerekir.

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
