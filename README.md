# InfoDeck

InfoDeck is a modern, auto-updating RSS dashboard that aggregates news, science, finance, or any custom topic into a clean, responsive multi-column interface. Users can configure sections with any RSS/Atom feed URL, filter and sort articles, and have the dashboard silently refresh in the background at a chosen interval.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Architecture Overview](#architecture-overview)
5. [Key Components](#key-components)
6. [RSS Feed Support](#rss-feed-support)
7. [CORS Proxy](#cors-proxy)
8. [State & Persistence](#state--persistence)
9. [Getting Started](#getting-started)
10. [Available Scripts](#available-scripts)
11. [Customization Reference](#customization-reference)

---

## Features

### Dashboard
- **Multi-column grid layout** — responsive 1 / 2 / 3 column grid (mobile → tablet → desktop)
- **Live header clock** — displays current date and time, updated every minute
- **Feed cards** — each card shows article title, source favicon, source name, and relative publish time (e.g. "3h ago")
- **Per-section item count** — shows `filtered / total` items in each section header

### Filtering & Sorting
- **Time filter** — All Time, Last 15 min, Last 1 hour, Last 3 hours, Last 24 hours
- **Source filter** — dynamically populated from all loaded feed items; only appears once feeds are loaded
- **Sort** — Newest First, Oldest First, Source A→Z, Source Z→A
- **Shuffle button** — one-click seeded random shuffle; turns black when active; resets when a sort option is chosen

### Feed Management
- **Add RSS Feed modal** — paste any RSS/Atom/OPML URL and assign it to a section
- **Customize Sections modal** — full section editor:
  - Rename sections
  - Reorder sections (up/down)
  - Pick from 12 Lucide icons
  - Pick from 6 color themes (Blue, Emerald, Violet, Rose, Amber, Sky)
  - Add, edit, or remove multiple feed URLs per section
  - Add or delete sections entirely

### Auto-Refresh
- **Sidebar slider** — choose refresh interval: Off, 1 min, 5 min, 15 min, 30 min, 1 hr
- **Silent background refresh** — re-fetches all feeds without showing loading spinners; loading state only shown on initial load or when feed URLs change
- **Animated indicator** — the refresh icon in the sidebar spins when auto-refresh is active

### Persistence
- **localStorage** — the full sections configuration (names, icons, colors, feed URLs) is automatically saved to `localStorage` under the key `infodeck-sections` on every change and restored on page load. Persists across page refreshes and browser restarts.

---

## Tech Stack

| Area | Library / Tool | Version |
|---|---|---|
| UI Framework | React | 19 |
| Build Tool | Vite | 6 |
| Language | TypeScript | ~5.8 |
| Styling | Tailwind CSS | v4 |
| Animations | Motion (formerly Framer Motion) | 12 |
| Icons | Lucide React | 0.546 |
| Production server | Express | 4 |
| Dev server | tsx (watch mode) | 4 |

---

## Project Structure

```
infodeck/
├── index.html                   # App shell — sets title "InfoDeck" and favicon /logo.png
├── logo.png                     # Source logo file
├── public/
│   ├── logo.png                 # Favicon served by Vite
│   └── nature.rss               # Local RSS file served as a static asset
├── server.ts                    # Standalone Express proxy server (for production use)
├── vite.config.ts               # Vite config — includes embedded RSS proxy plugin
├── package.json
├── tsconfig.json
└── src/
    ├── main.tsx                 # React entry point
    ├── index.css                # Global styles, Tailwind import, custom-scrollbar class
    ├── types.ts                 # Shared TypeScript types and AVAILABLE_COLORS constant
    ├── App.tsx                  # Root component — state, fetch logic, layout
    ├── utils/
    │   └── rssParser.ts         # Multi-format RSS/Atom/OPML parser
    └── components/
        ├── Sidebar.tsx          # Slide-out menu with auto-refresh slider
        ├── ControlBar.tsx       # Filter, sort, and shuffle controls
        ├── CustomizeModal.tsx   # Full section editor modal
        └── AddFeedModal.tsx     # Quick add-a-feed modal
```

---

## Architecture Overview

```
User Browser
│
├── App.tsx  (state owner)
│   ├── sections[]          → persisted to localStorage
│   ├── sectionItems{}      → fetched from RSS feeds
│   ├── sectionStatus{}     → 'idle' | 'loading' | 'success' | 'error'
│   ├── timeFilter          → passed to applyControlsToItems()
│   ├── sourceFilter        → passed to applyControlsToItems()
│   ├── sortBy              → passed to applyControlsToItems()
│   ├── shuffleSeed         → used for stable random sort
│   ├── refreshInterval     → drives setInterval for auto-refresh
│   └── refreshTick         → incremented by interval, triggers silent re-fetch
│
├── Components (receive props, emit callbacks)
│   ├── ControlBar          → renders filter/sort/shuffle UI
│   ├── Sidebar             → renders menu + refresh slider
│   ├── CustomizeModal      → edits sections config
│   └── AddFeedModal        → adds a single feed URL
│
└── rssParser.ts
    └── parseRssFeed(url)
        ├── Local paths (/public/...) → fetched directly
        └── External URLs → routed through /api/rss?url=<encoded>
                                └── Vite dev plugin or Express server
                                    fetches on server-side (no CORS)
```

---

## Key Components

### `src/App.tsx`
The single source of truth for all application state. Key responsibilities:

- **`sections` state** — array of `SectionConfig` objects, initialized from `localStorage` or defaults
- **`feedsKey`** — a JSON string derived only from section IDs and feed URLs. Only changes when feeds actually change, preventing unnecessary re-fetches on cosmetic edits (rename, color, icon)
- **Fetch effect** — `useEffect` depends on `[feedsKey, refreshTick]`. Distinguishes silent refreshes (tick-only) from visible ones (URL change) by comparing `feedsKey` to a `prevFeedsKeyRef`
- **`applyControlsToItems()`** — pure function that applies time filter → source filter → sort/shuffle to a list of `FeedItem[]`. Uses a seeded Fisher-Yates shuffle when `sortBy === 'random'`
- **`availableSources`** — `useMemo` that derives the unique source list from all loaded items, used to populate the source filter dropdown

### `src/utils/rssParser.ts`
Handles all feed fetching and parsing. Supports four formats detected automatically from the XML root element:

| Format | Root Element | Used By |
|---|---|---|
| RSS 1.0 (RDF) | `rdf:RDF` | Nature, older academic publishers |
| RSS 2.0 | `rss` | BBC, Reuters, most news sites |
| Atom | `feed` | YouTube, blogs, Google services |
| OPML | `opml` | Feed directories (auto-resolves first `xmlUrl`) |

Each item includes a `publishedAt` raw date string used for accurate time-based filtering and sorting.

### `src/components/Sidebar.tsx`
Slide-in menu from the left. Contains:
- Navigation buttons: Customize Sections, Add RSS Feed
- **Auto-refresh slider** — maps slider index 0–5 to `REFRESH_INTERVALS` (Off / 1 min / 5 min / 15 min / 30 min / 1 hr). The `RefreshCw` icon animates when active.

```ts
export const REFRESH_INTERVALS = [
  { label: 'Off',    ms: 0              },
  { label: '1 min',  ms: 1  * 60 * 1000 },
  { label: '5 min',  ms: 5  * 60 * 1000 },
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '1 hr',   ms: 60 * 60 * 1000 },
]
```

### `src/components/ControlBar.tsx`
The filter/sort bar above the section grid. Three centered pill dropdowns + one Shuffle button absolutely positioned to the right:
- **Time filter pill** — highlighted border when a non-default value is active
- **Source filter pill** — only rendered when `availableSources.length > 0`
- **Sort pill** — shows the current sort order; resets to "Newest First" display when shuffle is active
- **Shuffle button** — black filled when active (`sortBy === 'random'`), white outlined otherwise

### `src/components/CustomizeModal.tsx`
Opens from the sidebar. Deep-clones the `sections` array into local state on open, so edits are non-destructive until "Save Changes" is clicked. Provides:
- Section reorder (up/down arrows)
- Section rename (text input)
- Icon picker — 12 icons: `Globe Cpu TrendingUp Briefcase Heart Music Video Star Zap Coffee Book Monitor`
- Color picker — 6 themes defined in `src/types.ts`
- Per-section feed URL list (add / edit / remove)
- Add / delete entire sections

### `src/components/AddFeedModal.tsx`
Lightweight quick-add modal. Accepts one URL and a target section dropdown. Appends the URL to the chosen section's `feeds[]` array and closes.

### `src/types.ts`
Central type definitions shared across all components:

```ts
type FeedItem = {
  id: string;
  title: string;
  source: string;
  sourceDomain: string;
  time: string;          // human-readable relative time ("3h ago")
  url: string;
  publishedAt?: string;  // raw ISO/RFC date — used for filtering and sorting
}

type SectionConfig = {
  id: string;
  name: string;
  icon: string;          // key into AVAILABLE_ICONS map in CustomizeModal
  color: string;         // key into AVAILABLE_COLORS in types.ts
  feeds: string[];       // array of RSS/Atom URLs
}
```

---

## RSS Feed Support

Any standard RSS or Atom URL can be used. Paste the URL directly into "Add RSS Feed" or the Customize Sections modal.

**Tested formats:**
- `https://www.nature.com/nature.rss` — RSS 1.0 (RDF)
- `https://feeds.bbci.co.uk/news/rss.xml` — RSS 2.0
- `http://news.bbc.co.uk/rss/feeds.opml` — OPML (auto-resolves to first feed)
- Standard Atom feeds (YouTube channels, blogs, etc.)

**Local files** placed in `public/` can be referenced with a leading slash (e.g. `/nature.rss`) and are fetched directly without the proxy.

---

## CORS Proxy

Fetching RSS feeds directly from the browser fails due to CORS restrictions. InfoDeck solves this with a server-side proxy:

### Development (`npm run dev`)
A Vite plugin in `vite.config.ts` registers a middleware on the Vite dev server:

```
GET /api/rss?url=<encoded-feed-url>
```

The plugin fetches the external URL server-side and streams the XML back to the browser. No separate process is needed — just `npm run dev`.

### Production (`server.ts`)
`server.ts` is a standalone Express server (default port 3001) that exposes the same `/api/rss` endpoint for production deployments. Run it with:

```bash
npm run server
```

Both implementations:
- Validate that the URL uses `http:` or `https:` only
- Apply a 10-second fetch timeout
- Pass the original `Content-Type` header through
- Return structured JSON errors on failure

---

## State & Persistence

| State | Stored In | Lifetime |
|---|---|---|
| Sections config (names, icons, colors, feeds) | `localStorage` key `infodeck-sections` | Permanent (until user clears browser data) |
| Filter / sort / shuffle | React state | Page session only |
| Auto-refresh interval | React state | Page session only |
| Feed items (fetched articles) | React state | Page session only |

To reset to defaults, clear `infodeck-sections` from localStorage (DevTools → Application → Local Storage).

---

## Getting Started

### Prerequisites
- **Node.js** v18 or later — download from [nodejs.org](https://nodejs.org/)

### Installation

```bash
# 1. Navigate to the project folder
cd path/to/infodeck

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open `http://localhost:3000` in your browser.

The Vite dev server includes the RSS proxy — no separate backend process is needed during development.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 3000 with hot module reload and embedded RSS proxy |
| `npm run build` | Compile TypeScript and bundle for production into `dist/` |
| `npm run preview` | Serve the production build locally (port 4173) |
| `npm run server` | Start the standalone Express RSS proxy server (port 3001) for production use |
| `npm run lint` | Run TypeScript type-check (`tsc --noEmit`) |
| `npm run clean` | Delete the `dist/` folder |

---

## Customization Reference

### Adding a new section color
Edit `src/types.ts` → `AVAILABLE_COLORS`. Each entry needs a Tailwind `bg-*` and `text-*` class:

```ts
{ name: 'teal', bg: 'bg-teal-50', text: 'text-teal-600' }
```

### Adding a new icon
Edit `src/components/CustomizeModal.tsx` → import the icon from `lucide-react` and add it to `AVAILABLE_ICONS`:

```ts
import { ..., Flame } from 'lucide-react';
export const AVAILABLE_ICONS = { ..., Flame };
```

### Adding a new auto-refresh interval
Edit `src/components/Sidebar.tsx` → `REFRESH_INTERVALS`:

```ts
{ label: '2 min', ms: 2 * 60 * 1000 }
```

### Customizing the footer
Edit `src/App.tsx` around line 355 — the footer section is marked with a `{/* Footer */}` comment. The Platform and Legal link sections are preserved in JSX comments and can be re-enabled when ready.

### Changing the default sections
Edit `src/App.tsx` → the fallback array inside the `useState` initializer for `sections` (around line 151). Note that if `localStorage` already has a saved config, the defaults will not apply until the user clears their browser data.
