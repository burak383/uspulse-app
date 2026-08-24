import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { seedDemoData } from './seed';
import legalRouter from './routes/legal';
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
import { UPLOADS_DIR } from './uploads';

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

// Facebook/Google uygulama incelemesi ve genel şeffaflık için: gizlilik
// politikası, kullanım koşulları ve veri silme talimatları -- /api altında
// değil, kök yolda (ör. https://.../privacy) çünkü bunlar API uçları değil,
// insan tarafından okunacak sayfalar.
app.use('/', legalRouter);

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
