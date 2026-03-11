/**
 * InfoDeck RSS Proxy — Cloudflare Worker
 *
 * A lightweight CORS proxy that fetches RSS feeds server-side,
 * bypassing browser CORS restrictions.
 *
 * Deploy: https://dash.cloudflare.com → Workers & Pages → Create → paste this code → Deploy
 * Usage:  https://<your-worker>.workers.dev/?url=https://example.com/feed.xml
 */

const ALLOWED_ORIGINS = ['*']; // Restrict to your domain in production if desired

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('url');

    if (!target) {
      return new Response(
        JSON.stringify({ error: 'Missing ?url= parameter' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
      );
    }

    // Validate URL
    try {
      new URL(target);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
      );
    }

    try {
      const response = await fetch(target, {
        headers: {
          'User-Agent': 'InfoDeck RSS Reader/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        },
        redirect: 'follow',
      });

      const body = await response.text();
      const contentType = response.headers.get('Content-Type') || 'application/xml';

      return new Response(body, {
        status: response.status,
        headers: {
          ...corsHeaders(),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=300',
          'X-Proxy-Status': 'ok',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Upstream fetch failed', details: err.message }),
        { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
      );
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}
