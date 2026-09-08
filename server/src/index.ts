import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { seedDemoData } from './seed';
import legalRouter from './routes/legal';
import downloadRouter from './routes/download';
import authRouter from './routes/auth';
import meRouter from './routes/me';
import reunionRouter from './routes/reunion';
import moodRouter from './routes/mood';
import touchesRouter from './routes/touches';
import memoriesRouter from './routes/memories';
import questionsRouter from './routes/questions';
import plansRouter from './routes/plans';
import savingsRouter from './routes/savings';
import notificationsRouter from './routes/notifications';
import drivingRouter from './routes/driving';
import webhooksRouter from './routes/webhooks';
import { UPLOADS_DIR } from './uploads';

// Express 4, async route handler'lar içinde reddedilen (rejected) promise'leri
// otomatik yakalamıyor -- try/catch'siz bir handler'da atlanan bir hata
// normalde process'i (dolayısıyla TÜM sunucuyu, tüm çiftler için) çökertir.
// Route'ların çoğuna ayrı ayrı try/catch eklendi (bkz. routes/auth.ts), ama bu
// global dinleyici gözden kaçan/gelecekte eklenecek bir handler için son bir
// güvenlik ağı: süreci ayakta tutar ve hatayı en azından loglar.
process.on('unhandledRejection', (reason) => {
  console.error('Yakalanmamış promise reddi:', reason);
});

// Render, hem gerçekten Render'da çalıştığımızı hem de Dashboard'dan
// unutulmuş/eksik bırakılmış kritik ortam değişkenlerini erken (ve gürültülü
// biçimde) tespit etmek için kullanılıyor -- NODE_ENV'in aksine Render bu
// değişkeni her zaman kendisi otomatik ayarlıyor.
const isRenderDeploy = Boolean(process.env.RENDER);
if (isRenderDeploy && !process.env.JWT_SECRET) {
  console.error(
    'KRİTİK: JWT_SECRET ortam değişkeni ayarlanmamış. Render Dashboard > Environment üzerinden gerçek bir ' +
      'sır değeri eklemeden bu servisi canlıda çalıştırma -- aksi halde tüm kullanıcı oturumları varsayılan, ' +
      'herkesçe bilinen bir anahtarla imzalanır.',
  );
  process.exit(1);
}
if (isRenderDeploy && process.env.AUTO_SEED !== 'false') {
  console.warn(
    'UYARI: AUTO_SEED kapalı değil -- bu canlı Render dağıtımı her yeniden başlayışta demo hesapları ' +
      '(elif@uspulse.app / deniz@uspulse.app) otomatik oluşturacak. Kalıcı diske geçtikten sonra Dashboard\'dan ' +
      'AUTO_SEED=false ayarlamayı düşün.',
  );
}

const app = express();
// Render (ve genel olarak çoğu PaaS) bir ters proxy arkasında çalıştırıyor;
// bu olmadan req.protocol her zaman 'http' döner ve routes/memories.ts'te
// oluşturduğumuz medya URL'leri (https yerine) yanlış şemayla üretilir.
app.set('trust proxy', 1);
app.use(cors());
// Varsayılan 100kb sınırı profil fotoğrafı (base64) yüklemeleri için yetersiz
// -- sıkıştırılmış/512x512'ye küçültülmüş bir JPEG'in base64 hâli genelde
// birkaç yüz KB'a kadar çıkabiliyor. bkz. routes/me.ts PUT /avatar.
// NOT: bu limit sadece application/json gövdeler için geçerli -- anı
// medyası (fotoğraf/video/ses) multer ile ayrı bir multipart akışından
// okunuyor ve bu limitten etkilenmiyor (bkz. routes/memories.ts, uploads.ts).
app.use(express.json({ limit: '3mb' }));
// Yüklenen anı medyalarını (fotoğraf/video/ses) doğrudan sunuyoruz.
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'uspulse-server', time: new Date().toISOString() });
});

// Google uygulama incelemesi ve genel şeffaflık için: gizlilik
// politikası, kullanım koşulları ve veri silme talimatları -- /api altında
// değil, kök yolda (ör. https://.../privacy) çünkü bunlar API uçları değil,
// insan tarafından okunacak sayfalar.
app.use('/', legalRouter);
// Davet mesajındaki tek indirme linki (/get-app) -- cihaza göre Google
// Play'e yönlendirir ya da iOS için "çok yakında" sayfası gösterir. bkz.
// routes/download.ts ve mobile/screens/ELe.tsx (shareInvite).
app.use('/', downloadRouter);

app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/reunion', reunionRouter);
app.use('/api/mood', moodRouter);
app.use('/api/touches', touchesRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/plans', plansRouter);
app.use('/api/savings', savingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/driving', drivingRouter);
// RevenueCat'ten gelen sunucu-sunucu webhook çağrısı -- JWT ile korunmuyor
// (mobil uygulamadan gelmiyor), kendi paylaşılan-sır (Bearer) doğrulamasını
// kendi içinde yapıyor. bkz. routes/webhooks.ts.
app.use('/api/webhooks', webhooksRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Bulunamadı: ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

// Ücretsiz Render planında dosya sistemi kalıcı değil: servis her uyanışta/
// yeniden başlayışta SQLite dosyası sıfırlanıyor ve Shell sekmesi (npm run
// seed) ücretsiz planda kullanılamıyor. Bu yüzden demo verisini her
// başlangıçta otomatik oluşturuyoruz; seedDemoData() zaten var olan kayıtları
// atladığı için (idempotent) veri zaten duruyorsa hiçbir şeyi değiştirmez.
// Devre dışı bırakmak istersen ortam değişkeni olarak AUTO_SEED=false ekle.
if (process.env.AUTO_SEED !== 'false') {
  try {
    seedDemoData();
  } catch (err) {
    console.error('Demo verisi oluşturulurken hata oluştu:', err);
  }
}

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`UsPulse API http://localhost:${PORT} adresinde çalışıyor`);
});
