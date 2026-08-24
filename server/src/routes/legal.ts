import { Router } from 'express';

const router = Router();

const CONTACT_EMAIL = process.env.LEGAL_CONTACT_EMAIL || 'seolen8@gmail.com';
const APP_NAME = 'UsPulse';
const UPDATED = '24 Ağustos 2026';

function page(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · ${APP_NAME}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    padding: 0;
    background: #FBF7F5;
    color: #2B1E2F;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 40px 24px 80px; }
  h1 { font-size: 28px; margin-bottom: 4px; color: #34243A; }
  .updated { color: #7A6B7E; font-size: 13px; margin-bottom: 32px; }
  h2 { font-size: 19px; margin-top: 34px; color: #34243A; }
  p, li { font-size: 15px; color: #3B2C3E; }
  ul { padding-left: 20px; }
  a { color: #E8685A; }
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    background: #FF8F82;
    color: #34243A;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.4px;
    margin-bottom: 14px;
  }
  .note {
    margin-top: 40px;
    padding: 16px 18px;
    border-radius: 14px;
    background: #F4E9E6;
    font-size: 13px;
    color: #5C4C60;
  }
</style>
</head>
<body>
  <div class="wrap">
    <span class="badge">${APP_NAME}</span>
    <h1>${title}</h1>
    <div class="updated">Son güncelleme: ${UPDATED}</div>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

router.get('/privacy', (_req, res) => {
  res.type('html').send(
    page(
      'Gizlilik Politikası',
      `
      <p>${APP_NAME}, birbirinden uzakta yaşayan çiftlerin bağlarını canlı tutmasına yardımcı olan küçük bir uygulamadır. Bu sayfa, uygulamayı kullanırken hangi verilerin toplandığını, nasıl kullanıldığını ve haklarınızın neler olduğunu açıklar.</p>

      <h2>Hangi verileri topluyoruz</h2>
      <ul>
        <li><strong>Hesap bilgileri:</strong> adın, e-posta adresin ve şifrenin şifrelenmiş (hash'lenmiş) hâli. Google veya Facebook ile giriş yaparsan, o hesabından paylaşılmasına izin verdiğin ad, e-posta ve profil kimliği.</li>
        <li><strong>Profil fotoğrafı (opsiyonel):</strong> Biz sekmesinden kendi fotoğrafını seçersen, cihazında küçültülüp sıkıştırılır ve sunucuya kaydedilir; bu fotoğraf yalnızca partnerine gösterilir. İstediğin zaman kaldırabilirsin.</li>
        <li><strong>Uygulama içi içerik:</strong> paylaştığın ruh hâli, gönderdiğin "kalp" (dokunuş) etkileşimlerinin zaman damgası, yazdığın anılar/notlar, günün sorusuna verdiğin cevaplar, eklediğin planlar ve birikim katkıları.</li>
        <li><strong>Anılara eklediğin fotoğraf/video/ses (opsiyonel):</strong> Anılar sekmesinde bir fotoğraf, video veya ses notu eklersen, bu dosya sunucumuza yüklenir ve yalnızca senin ile eşleşmiş partnerine gösterilir. Bir anıyı sildiğinde ya da hesabını sildiğinde, o anıya ait dosya da sunucudan kalıcı olarak silinir.</li>
        <li><strong>Konum (opsiyonel):</strong> Biz sekmesinden konum paylaşımını açarsan, cihazının yaklaşık enlem/boylamını sunucuya göndeririz. "Her zaman izin ver" konum iznini verirsen bu, aranızdaki mesafeyi güncel tutmak için <strong>uygulama kapalıyken/arka plandayken de</strong> periyodik olarak (birkaç dakikada bir ya da belirgin bir konum değişikliğinde) gönderilir; yalnızca "uygulamayı kullanırken" izni verirsen paylaşım sadece uygulamayı her açtığında gerçekleşir. Bunu <strong>istediğin zaman kapatabilirsin</strong>; kapatınca hem arka plan takibi durur hem de sunucudaki kayıt silinir.</li>
        <li><strong>Teknik veriler:</strong> sunucu barındırma sağlayıcımızın (Render) tuttuğu standart erişim kayıtları (ör. IP adresi, istek zamanı) — bunlar güvenlik ve hata ayıklama amacıyla kısa süreliğine tutulur.</li>
      </ul>
      <p><strong>Kesin konumun asla partnerine gösterilmez.</strong> Konum paylaşımını açtığında bile, hem sen hem partnerin paylaştıysa yalnızca ikiniz arasındaki hesaplanmış yaklaşık mesafe (km) partnerine gösterilir — kendi enlem/boylamın uygulamanın hiçbir ekranında, hiçbir API yanıtında partnerine ya da başka birine gönderilmez.</p>

      <h2>Verilerini ne için kullanıyoruz</h2>
      <ul>
        <li>Hesabını oluşturmak, giriş yapmanı sağlamak ve seni partnerinle eşleştirmek.</li>
        <li>Paylaştığın ruh hâli, anı, plan ve diğer içerikleri sadece seninle eşleşmiş partnerine göstermek.</li>
        <li>İkiniz de konum paylaşımını açtıysanız, aranızdaki yaklaşık mesafeyi hesaplayıp göstermek.</li>
        <li>Şifre sıfırlama gibi hesap güvenliği işlemlerini yürütmek.</li>
      </ul>
      <p>Verilerin reklam amacıyla kullanılmaz, satılmaz ve üçüncü taraflarla paylaşılmaz — Google/Facebook ile giriş yaptığında yalnızca kimliğini doğrulamak için o sağlayıcılarla iletişime geçilir.</p>

      <h2>Verilerin nerede saklanıyor</h2>
      <p>Veriler, Render.com üzerinde barındırılan bir sunucuda tutulur. Şifreler asla düz metin olarak saklanmaz; bcrypt ile hash'lenir. Oturumların JWT (JSON Web Token) ile doğrulanır.</p>

      <h2>Haklarınız</h2>
      <p>Uygulama içindeki <strong>Biz</strong> sekmesinden dilediğin zaman hesabını ve tüm kişisel verilerini kalıcı olarak silebilirsin. Ayrıntılar için <a href="/data-deletion">Kullanıcı Verilerinin Silinmesi</a> sayfasına bakabilirsin. Verilerinle ilgili bir soru veya talebin olursa <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresinden bize ulaşabilirsin.</p>

      <h2>Değişiklikler</h2>
      <p>Bu politika zaman zaman güncellenebilir; önemli değişiklikler bu sayfada yayınlanır.</p>

      <div class="note">Bu metin, küçük ölçekli bir kişisel/aile içi kullanım için hazırlanmış genel bir bilgilendirmedir; hukuki danışmanlık yerine geçmez. Uygulamayı geniş kitlelere açmayı planlıyorsan bir hukuk danışmanına başvurman önerilir.</div>
      `,
    ),
  );
});

router.get('/terms', (_req, res) => {
  res.type('html').send(
    page(
      'Kullanım Koşulları',
      `
      <p>${APP_NAME}'ü kullanarak aşağıdaki koşulları kabul etmiş olursun.</p>

      <h2>Hizmetin tanımı</h2>
      <p>${APP_NAME}, birbirinden uzakta yaşayan iki kişinin ruh hâli, anı, plan ve günlük soru gibi içerikleri paylaşarak bağlarını korumasına yardımcı olan bir mobil uygulamadır.</p>

      <h2>Hesabın ve içeriğin</h2>
      <ul>
        <li>Hesap bilgilerinin doğruluğundan ve şifreni gizli tutmaktan sen sorumlusun.</li>
        <li>Uygulamaya eklediğin içerik (anılar, notlar, planlar) sana aittir; bunları istediğin zaman düzenleyebilir veya silebilirsin.</li>
        <li>Uygulamayı yasa dışı, zarar verici veya başkalarının haklarını ihlal edecek şekilde kullanmamayı kabul edersin.</li>
      </ul>

      <h2>Hizmetin sunumu</h2>
      <p>${APP_NAME} küçük ölçekli, gelişmekte olan bir proje olarak sunulur ve "olduğu gibi" sağlanır; kesintisiz veya hatasız çalışacağına dair bir garanti verilmez. Ücretsiz barındırma katmanında zaman zaman geçici kesintiler (ör. yeniden başlatma sonrası kısa süreli erişilemezlik) yaşanabilir.</p>

      <h2>Sorumluluğun sınırlanması</h2>
      <p>${APP_NAME} ekibi, uygulamanın kullanımından doğabilecek dolaylı zararlardan yasaların izin verdiği azami ölçüde sorumlu tutulamaz.</p>

      <h2>Hesabın sonlandırılması</h2>
      <p>Hesabını dilediğin zaman uygulama içinden kalıcı olarak silebilirsin. Kötüye kullanım tespit edilmesi hâlinde bir hesabı askıya alma hakkımız saklıdır.</p>

      <h2>Değişiklikler</h2>
      <p>Bu koşullar zaman zaman güncellenebilir; güncel sürüm her zaman bu sayfada yayınlanır.</p>

      <h2>İletişim</h2>
      <p>Sorularının için <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresinden bize ulaşabilirsin.</p>

      <div class="note">Bu metin, küçük ölçekli bir kişisel/aile içi kullanım için hazırlanmış genel bir bilgilendirmedir; hukuki danışmanlık yerine geçmez.</div>
      `,
    ),
  );
});

router.get('/data-deletion', (_req, res) => {
  res.type('html').send(
    page(
      'Kullanıcı Verilerinin Silinmesi',
      `
      <p>Hesabını ve ${APP_NAME}'de sakladığımız tüm kişisel verilerini dilediğin zaman kalıcı olarak silebilirsin.</p>

      <h2>Uygulama içinden silme (önerilen yöntem)</h2>
      <ol>
        <li>${APP_NAME} uygulamasını aç ve <strong>Biz</strong> sekmesine git.</li>
        <li>En altta yer alan <strong>"Hesabımı sil"</strong> butonuna dokun.</li>
        <li>Onaylayınca; ruh hâli geçmişin, gönderdiğin dokunuşlar, yazdığın anılar, günün sorusuna verdiğin cevaplar ve eklediğin plan/birikim katkıların dâhil hesabın ve tüm kişisel verilerin sunucudan kalıcı ve geri alınamaz şekilde silinir.</li>
      </ol>
      <p>Bu işlem yalnızca kendi hesabını ve kendi eklediğin içerikleri siler; partnerinin hesabı etkilenmez.</p>

      <h2>Yalnızca konum verini silmek istiyorsan</h2>
      <p>Hesabının tamamını silmeden sadece konum paylaşımını kapatmak istersen, <strong>Biz</strong> sekmesindeki "Konum" satırına dokunup kapatabilirsin — bu, hem cihazındaki arka plan konum takibini durdurur hem de sunucudaki enlem/boylam kaydını hemen siler.</p>

      <h2>Facebook veya Google üzerinden giriş yaptıysan</h2>
      <p>Uygulama içinden hesabını sildiğinde, Facebook/Google hesabınla olan bağlantımız da (ilişkilendirilmiş kimlik bilgisi) veritabanımızdan silinir. Ayrıca Facebook/Google hesap ayarlarından "Bağlı Uygulamalar" listesinden ${APP_NAME}'ü kaldırmak istersen bu adımı ilgili platform üzerinden ayrıca yapabilirsin — bu, o platformdaki izin kaydını temizler.</p>

      <h2>Uygulamaya erişemiyorsan</h2>
      <p>Hesabına bir sebeple erişemiyorsan, hangi hesabın (kayıtlı e-posta adresin) silinmesini istediğini belirterek <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresine yazabilirsin; talebini elle işleme alıp verilerini sileriz.</p>

      <p>Daha fazla bilgi için <a href="/privacy">Gizlilik Politikası</a>'na bakabilirsin.</p>
      `,
    ),
  );
});

export default router;
