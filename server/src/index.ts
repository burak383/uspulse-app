import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import meRouter from './routes/me';
import reunionRouter from './routes/reunion';
import moodRouter from './routes/mood';
import touchesRouter from './routes/touches';
import memoriesRouter from './routes/memories';
import questionsRouter from './routes/questions';
import plansRouter from './routes/plans';
import savingsRouter from './routes/savings';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'uspulse-server', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/reunion', reunionRouter);
app.use('/api/mood', moodRouter);
app.use('/api/touches', touchesRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/plans', plansRouter);
app.use('/api/savings', savingsRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Bulunamadı: ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`UsPulse API http://localhost:${PORT} adresinde çalışıyor`);
});
