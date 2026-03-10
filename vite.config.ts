import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

/** Handles /api/rss?url=<encoded> inside the Vite dev server so no separate backend process is needed. */
function rssProxyPlugin(): Plugin {
  return {
    name: 'rss-proxy',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/api/rss')) return next();

        const { searchParams } = new URL(req.url, 'http://localhost');
        const feedUrl = searchParams.get('url');

        if (!feedUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing url parameter' }));
          return;
        }

        let parsedUrl: URL;
        try {
          parsedUrl = new URL(feedUrl);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid URL' }));
          return;
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Only http and https URLs are allowed' }));
          return;
        }

        try {
          const response = await fetch(feedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; InfoDeck/1.0 RSS Reader)',
              'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
            },
            signal: AbortSignal.timeout(10_000),
          });

          if (!response.ok) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Upstream responded with ${response.status} ${response.statusText}` }));
            return;
          }

          const contentType = response.headers.get('content-type') || 'application/xml; charset=utf-8';
          const text = await response.text();

          res.writeHead(200, { 'Content-Type': contentType });
          res.end(text);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Failed to fetch feed: ${message}` }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/InfoDeck/',
    plugins: [react(), tailwindcss(), rssProxyPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
