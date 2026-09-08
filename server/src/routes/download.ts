import { Router } from 'express';

const router = Router();

// Davet mesajındaki tek linkin gittiği yer: cihazın işletim sistemine göre
// doğru mağazaya yönlendiren (ya da henüz mağazada olmayan platform için
// bilgilendirici bir sayfa gösteren) küçük bir "akıllı link". Firebase
// Dynamic Links gibi üçüncü taraf bir servise ihtiyaç yok -- User-Agent'a
// bakıp Express içinde 302 ile yönlendirmek yeterli. bkz. mobile/screens/
// ELe.tsx (shareInvite) -- bu linki davet mesajına ekliyor.
const APP_NAME = 'UsPulse';
const ANDROID_PACKAGE = 'app.uspulse.mobile';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
// NOT: iOS'ta henüz bir App Store listelemesi yok (uygulama şimdilik sadece
// Android'de yayınlanacak) -- iOS App Store linki eklendiğinde burası
// güncellenip aşağıdaki iOS dalı da gerçek mağaza linkine yönlendirilebilir.
const IOS_APP_STORE_URL: string | null = null;

function page(bodyHtml: string): string {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${APP_NAME}'ı indir</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    background: #FBF7F5;
    color: #2B1E2F;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .wrap { max-width: 420px; margin: 0 auto; padding: 40px 24px 60px; text-align: center; }
  h1 { font-size: 24px; margin: 18px 0 8px; color: #34243A; }
  p { font-size: 15px; color: #3B2C3E; }
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    background: #FF8F82;
    color: #34243A;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.4px;
  }
  .btn {
    display: inline-block;
    margin-top: 22px;
    padding: 14px 28px;
    border-radius: 999px;
    background: #E8685A;
    color: #FFF6F4;
    font-weight: 700;
    font-size: 15px;
    text-decoration: none;
  }
  .hint { margin-top: 28px; font-size: 12.5px; color: #7A6B7E; }
</style>
</head>
<body>
  <div class="wrap">
    <span class="badge">${APP_NAME}</span>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

router.get('/get-app', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  if (isAndroid) {
    res.redirect(302, PLAY_STORE_URL);
    return;
  }

  if (isIOS) {
    if (IOS_APP_STORE_URL) {
      res.redirect(302, IOS_APP_STORE_URL);
      return;
    }
    res.type('html').send(
      page(`
        <h1>iOS sürümü çok yakında</h1>
        <p>${APP_NAME} şu an yalnızca Android için yayında. iPhone/iPad sürümü üzerinde çalışıyoruz -- hazır olduğunda burada olacak.</p>
        <p class="hint">Android telefonun varsa aşağıdaki bağlantıyı o cihazda açabilirsin.</p>
        <a class="btn" href="${PLAY_STORE_URL}">Google Play'de görüntüle</a>
      `),
    );
    return;
  }

  // Masaüstü ya da tanınmayan bir cihaz -- her iki seçeneği de göster.
  res.type('html').send(
    page(`
      <h1>${APP_NAME}'ı telefonuna indir</h1>
      <p>Bu bağlantıyı telefonunda açtığında doğru mağazaya yönlendirilirsin.</p>
      <a class="btn" href="${PLAY_STORE_URL}">Android · Google Play</a>
      <p class="hint">iOS sürümü çok yakında.</p>
    `),
  );
});

export default router;
