import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { app } from './src/serverApp.ts';
import { ensureDatabaseSeeded, syncLiveSportsFeeds } from './src/services/sportsSync.ts';

const safeDirname = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {
    // Fallback to cwd
  }
  return process.cwd();
})();

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(safeDirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SPORTZONE server listening on http://0.0.0.0:${PORT}`);

    // Automatic background live match minutes, scores, odds, and settlement sync every 8 seconds
    ensureDatabaseSeeded()
      .then(() => {
        setInterval(() => {
          syncLiveSportsFeeds().catch((err) => {
            console.warn('Background live sync warning:', err);
          });
        }, 8_000);
      })
      .catch(() => {});
  });
}

if (process.env.VERCEL !== '1') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { app };
export default app;
