import express from 'express';

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.get('/api/rss', async (req, res) => {
  const url = req.query.url as string;

  if (!url) {
    res.status(400).json({ error: 'Missing required "url" query parameter' });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    res.status(400).json({ error: 'Only http and https URLs are allowed' });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InfoDeck/1.0 RSS Reader)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      res.status(502).json({ error: `Upstream responded with ${response.status} ${response.statusText}` });
      return;
    }

    const contentType = response.headers.get('content-type') || 'application/xml; charset=utf-8';
    const text = await response.text();

    res.setHeader('Content-Type', contentType);
    res.send(text);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to fetch feed: ${message}` });
  }
});

app.listen(PORT, () => {
  console.log(`InfoDeck proxy server running on http://localhost:${PORT}`);
});
