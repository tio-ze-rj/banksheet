import express from 'express';
import path from 'node:path';
import { parseRouter } from './routes/parse';
import { exportRouter } from './routes/export';
import { parsersRouter } from './routes/parsers';

export const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', parseRouter);
app.use('/api', exportRouter);
app.use('/api', parsersRouter);

const PORT = process.env.PORT ?? 3000;

if (require.main === module || process.argv[1]?.endsWith('server.ts')) {
  app.listen(PORT, () => {
    console.log(`banksheet web UI running at http://localhost:${PORT}`);
  });
}
