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

/** Routes external URLs through the backend proxy to avoid CORS. Local paths pass through directly.
 *  In production (GitHub Pages), routes through the codetabs CORS proxy. */
function buildFetchUrl(url: string): string {
  if (url.startsWith('/') || url.startsWith('./')) return url;
  if (import.meta.env.PROD) {
    return `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
  }
  return `/api/rss?url=${encodeURIComponent(url)}`;
}

function extractSourceDomain(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
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

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Fetches and parses an RSS/Atom/OPML URL into FeedItems.
 * Handles RSS 1.0, RSS 2.0, Atom, and OPML (auto-resolves the first feed inside).
 */
export async function parseRssFeed(url: string, _depth = 0): Promise<FeedItem[]> {
  if (_depth > 2) throw new Error('Too many feed redirects');

  const response = await fetch(buildFetchUrl(url));
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const text = await response.text();

  const domParser = new DOMParser();
  const doc = domParser.parseFromString(text, 'application/xml');

  if (doc.querySelector('parsererror')) throw new Error('Failed to parse feed XML');

  const format = detectFormat(doc);

  switch (format) {
    case 'rss1': return parseRss1(doc);
    case 'rss2': return parseRss2(doc);
    case 'atom': return parseAtom(doc);

    case 'opml': {
      // OPML is a directory of feeds — extract all xmlUrl attributes and fetch the first one
      const feedUrls = Array.from(doc.getElementsByTagName('outline'))
        .map(o => o.getAttribute('xmlUrl'))
        .filter((u): u is string => Boolean(u));

      if (feedUrls.length === 0) throw new Error('OPML file contains no RSS feed URLs');

      // Recursively parse the first feed inside the OPML
      return parseRssFeed(feedUrls[0], _depth + 1);
    }

    default:
      throw new Error('Unrecognized feed format. Supported: RSS 1.0, RSS 2.0, Atom, OPML.');
  }
}
