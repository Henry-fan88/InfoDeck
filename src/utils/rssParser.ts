import { FeedItem } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function extractSourceDomain(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

// ── Fetch strategies ────────────────────────────────────────────────────────

const FETCH_TIMEOUT = 12_000;

/**
 * Self-hosted Cloudflare Worker proxy URL.
 * Set VITE_PROXY_URL in .env (or .env.production) to enable, e.g.:
 *   VITE_PROXY_URL=https://infodeck-rss-proxy.<you>.workers.dev
 * When set, this is the primary (most reliable) strategy.
 */
const WORKER_PROXY_URL = import.meta.env.VITE_PROXY_URL as string | undefined;

/** Fetch through the self-hosted Cloudflare Worker proxy. */
async function fetchViaWorker(url: string): Promise<string> {
  if (!WORKER_PROXY_URL) throw new Error('Worker proxy not configured');
  const proxyUrl = `${WORKER_PROXY_URL}/?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error('Empty response from worker');
  return text;
}

/** Try fetching the URL directly — works when the feed server sets CORS headers. */
async function fetchDirect(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error('Empty response');
  return text;
}

/** Fetch through the codetabs CORS proxy. */
async function fetchViaCodetabs(url: string): Promise<string> {
  const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error('Empty response from proxy');
  if (text.includes('<H1>Access Denied</H1>') || text.includes('ERROR PAGE:'))
    throw new Error('Feed server blocked the proxy');
  return text;
}

/** Fetch via rss2json API — server-side fetch that returns JSON instead of XML.
 *  Works for feeds that block CORS proxies but allow normal server requests. */
async function fetchViaRss2json(url: string): Promise<FeedItem[]> {
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(json.message || 'rss2json error');
  if (!json.items?.length) throw new Error('No items');

  const feedTitle = json.feed?.title || 'Unknown';
  const feedLink = json.feed?.link || '';
  return json.items.map((item: { title?: string; link?: string; pubDate?: string; author?: string }, i: number) => {
    const link = item.link || '#';
    const pubDate = item.pubDate || '';
    return {
      id: link || `r2j-${i}`,
      title: item.title || 'Untitled',
      source: feedTitle,
      sourceDomain: extractSourceDomain(feedLink || link),
      time: pubDate ? formatRelativeTime(pubDate) : 'Unknown',
      url: link,
      publishedAt: pubDate || undefined,
    };
  });
}

/** Try fetching via the local dev proxy. */
async function fetchViaDevProxy(url: string): Promise<string> {
  const res = await fetch(`/api/rss?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error('Empty response');
  return text;
}

// ── Format detection ─────────────────────────────────────────────────────────

type FeedFormat = 'rss1' | 'rss2' | 'atom' | 'opml' | 'unknown';

function detectFormat(doc: Document): FeedFormat {
  // localName strips the namespace prefix (e.g. "rdf:RDF" → localName "RDF")
  const local = doc.documentElement.localName.toLowerCase();

  if (local === 'opml') return 'opml';
  if (local === 'feed') return 'atom';   // Atom
  if (local === 'rss')  return 'rss2';  // RSS 2.0
  if (local === 'rdf')  return 'rss1';  // RSS 1.0 — root is rdf:RDF

  // Fallback: scan content
  if (doc.getElementsByTagName('entry').length > 0) return 'atom';
  if (doc.getElementsByTagName('item').length  > 0) return 'rss2';

  return 'unknown';
}

// ── Per-format parsers ───────────────────────────────────────────────────────

/** RSS 1.0 / RDF — used by Nature, older academic publishers */
function parseRss1(doc: Document): FeedItem[] {
  const channelTitle =
    doc.getElementsByTagName('channel')[0]
      ?.getElementsByTagName('title')[0]
      ?.textContent?.trim() ?? 'Unknown';

  return Array.from(doc.getElementsByTagName('item')).map((item, i) => {
    const title = item.getElementsByTagName('title')[0]?.textContent?.trim() || 'Untitled';

    let link = item.getElementsByTagName('link')[0]?.textContent?.trim() || '';
    if (!link) link = item.getAttributeNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'about') || '#';

    const dateStr =
      item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'date')[0]
        ?.textContent?.trim() ?? '';

    const source =
      item.getElementsByTagNameNS('http://prismstandard.org/namespaces/basic/2.0/', 'publicationName')[0]
        ?.textContent?.trim() ?? channelTitle;

    return {
      id: link || `rss1-${i}`,
      title,
      source,
      sourceDomain: extractSourceDomain(link),
      time: dateStr ? formatRelativeTime(dateStr) : 'Unknown',
      url: link,
      publishedAt: dateStr || undefined,
    };
  });
}

/** RSS 2.0 — the most common format (BBC, Reuters, most news sites) */
function parseRss2(doc: Document): FeedItem[] {
  const channelTitle =
    doc.getElementsByTagName('channel')[0]
      ?.getElementsByTagName('title')[0]
      ?.textContent?.trim() ?? 'Unknown';

  return Array.from(doc.getElementsByTagName('item')).map((item, i) => {
    const title = item.getElementsByTagName('title')[0]?.textContent?.trim() || 'Untitled';
    const link  = item.getElementsByTagName('link')[0]?.textContent?.trim() || '#';

    // pubDate (RSS 2.0 standard) or dc:date (extension)
    const pubDate =
      item.getElementsByTagName('pubDate')[0]?.textContent?.trim() ||
      item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'date')[0]?.textContent?.trim() || '';

    // Source: inline <source> element → dc:publisher → channel title
    const source =
      item.getElementsByTagName('source')[0]?.textContent?.trim() ||
      item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'publisher')[0]?.textContent?.trim() ||
      channelTitle;

    return {
      id: link || `rss2-${i}`,
      title,
      source,
      sourceDomain: extractSourceDomain(link),
      time: pubDate ? formatRelativeTime(pubDate) : 'Unknown',
      url: link,
      publishedAt: pubDate || undefined,
    };
  });
}

/** Atom — used by YouTube, many blogs and Google services */
function parseAtom(doc: Document): FeedItem[] {
  const feedTitle =
    doc.querySelector('feed > title')?.textContent?.trim() ||
    doc.getElementsByTagName('title')[0]?.textContent?.trim() || 'Unknown';

  return Array.from(doc.getElementsByTagName('entry')).map((entry, i) => {
    const title = entry.getElementsByTagName('title')[0]?.textContent?.trim() || 'Untitled';

    // Atom links are attributes: <link href="..."> or <link rel="alternate" href="...">
    const linkEls = Array.from(entry.getElementsByTagName('link'));
    const linkEl  = linkEls.find(el => !el.getAttribute('rel') || el.getAttribute('rel') === 'alternate') ?? linkEls[0];
    const link    = linkEl?.getAttribute('href') || '#';

    const dateStr =
      entry.getElementsByTagName('updated')[0]?.textContent?.trim() ||
      entry.getElementsByTagName('published')[0]?.textContent?.trim() || '';

    return {
      id: link || `atom-${i}`,
      title,
      source: feedTitle,
      sourceDomain: extractSourceDomain(link),
      time: dateStr ? formatRelativeTime(dateStr) : 'Unknown',
      url: link,
      publishedAt: dateStr || undefined,
    };
  });
}

// ── XML parsing entry point ─────────────────────────────────────────────────

function parseXmlText(text: string, originalUrl: string, depth: number): FeedItem[] | Promise<FeedItem[]> {
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(text, 'application/xml');

  if (doc.querySelector('parsererror'))
    throw new Error('Failed to parse feed XML');

  const format = detectFormat(doc);

  switch (format) {
    case 'rss1': return parseRss1(doc);
    case 'rss2': return parseRss2(doc);
    case 'atom': return parseAtom(doc);

    case 'opml': {
      const feedUrls = Array.from(doc.getElementsByTagName('outline'))
        .map(o => o.getAttribute('xmlUrl'))
        .filter((u): u is string => Boolean(u));
      if (feedUrls.length === 0) throw new Error('OPML file contains no RSS feed URLs');
      return parseRssFeed(feedUrls[0], depth + 1);
    }

    default:
      throw new Error('Unrecognized feed format. Supported: RSS 1.0, RSS 2.0, Atom, OPML.');
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

export type FeedResult = {
  items: FeedItem[];
  error?: string;
  url: string;
};

/**
 * Fetches and parses an RSS/Atom/OPML URL into FeedItems.
 * Uses a multi-strategy fallback: Worker proxy (if configured) → direct → CORS proxy → rss2json API.
 */
export async function parseRssFeed(url: string, _depth = 0): Promise<FeedItem[]> {
  if (_depth > 2) throw new Error('Too many feed redirects');

  // Local paths: no proxy needed
  if (url.startsWith('/') || url.startsWith('./')) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseXmlText(await res.text(), url, _depth) as FeedItem[];
  }

  // Dev mode: just use the local Express proxy
  if (!import.meta.env.PROD) {
    const text = await fetchViaDevProxy(url);
    return parseXmlText(text, url, _depth) as FeedItem[];
  }

  // Production: try multiple strategies
  const errors: string[] = [];

  // Strategy 0: self-hosted Cloudflare Worker proxy (most reliable if configured)
  if (WORKER_PROXY_URL) {
    try {
      const text = await fetchViaWorker(url);
      return await parseXmlText(text, url, _depth);
    } catch (e) {
      errors.push(`worker: ${(e as Error).message}`);
    }
  }

  // Strategy 1: direct fetch (works when feed server sets CORS headers)
  try {
    const text = await fetchDirect(url);
    return await parseXmlText(text, url, _depth);
  } catch (e) {
    errors.push(`direct: ${(e as Error).message}`);
  }

  // Strategy 2: codetabs CORS proxy
  try {
    const text = await fetchViaCodetabs(url);
    return await parseXmlText(text, url, _depth);
  } catch (e) {
    errors.push(`proxy: ${(e as Error).message}`);
  }

  // Strategy 3: rss2json API (server-side fetch, returns JSON)
  try {
    return await fetchViaRss2json(url);
  } catch (e) {
    errors.push(`rss2json: ${(e as Error).message}`);
  }

  throw new Error(`All fetch strategies failed — ${errors.join('; ')}`);
}

/**
 * Fetch a single feed and return a FeedResult (never throws).
 * Includes error info for per-feed status tracking.
 */
export async function fetchFeedWithStatus(url: string): Promise<FeedResult> {
  try {
    const items = await parseRssFeed(url);
    return { url, items };
  } catch (e) {
    return { url, items: [], error: (e as Error).message };
  }
}
