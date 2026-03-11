/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { Radio, Globe, ExternalLink, Clock, Github, Twitter, Mail, Menu, Loader2, AlertCircle, Rss } from 'lucide-react';
import { FeedItem, SectionConfig, AVAILABLE_COLORS } from './types';
import { Sidebar } from './components/Sidebar';
import { CustomizeModal, AVAILABLE_ICONS } from './components/CustomizeModal';
import { AddFeedModal } from './components/AddFeedModal';
import { ControlBar, TimeFilter, SortBy } from './components/ControlBar';
import { fetchFeedWithStatus, FeedResult } from './utils/rssParser';

// ── Feed Card ────────────────────────────────────────────────────────────────

const FeedCard: React.FC<{ item: FeedItem; index: number }> = ({ item, index }) => {
  return (
    <motion.a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="group block p-5 mb-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-gray-100 group-hover:bg-black transition-colors duration-200" />
      <div className="flex justify-between items-start gap-4">
        <h3 className="font-medium text-gray-900 leading-snug group-hover:text-black transition-colors">
          {item.title}
        </h3>
        <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 font-mono">
        <div className="flex items-center gap-2">
          <img
            src={`https://www.google.com/s2/favicons?domain=${item.sourceDomain}&sz=64`}
            alt={item.source}
            className="w-5 h-5 rounded-sm bg-gray-100 object-contain"
            referrerPolicy="no-referrer"
          />
          <span className="uppercase tracking-wider font-semibold text-gray-700">{item.source}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>{item.time}</span>
        </div>
      </div>
    </motion.a>
  );
};

// ── Section empty / loading / error / no-results states ──────────────────────

const SectionPlaceholder: React.FC<{ type: 'empty' | 'loading' | 'error' | 'no-results'; message?: string }> = ({ type, message }) => {
  if (type === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm font-mono">Fetching feed…</span>
      </div>
    );
  }
  if (type === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-rose-400">
        <AlertCircle className="w-6 h-6" />
        <span className="text-sm font-mono text-center">{message || 'Failed to load feed'}</span>
      </div>
    );
  }
  if (type === 'no-results') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-300">
        <AlertCircle className="w-6 h-6" />
        <span className="text-sm font-mono text-center">No items match the current filters.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-300">
      <Rss className="w-6 h-6" />
      <span className="text-sm font-mono text-center">No feeds configured.<br />Add an RSS URL to get started.</span>
    </div>
  );
};

// ── Filter + sort helpers ─────────────────────────────────────────────────────

const TIME_WINDOW_MS: Record<TimeFilter, number> = {
  'all': Infinity,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function applyControlsToItems(
  items: FeedItem[],
  timeFilter: TimeFilter,
  sourceFilter: string,
  sortBy: SortBy,
  shuffleSeed: number,
): FeedItem[] {
  let result = [...items];

  // Time filter
  if (timeFilter !== 'all') {
    const cutoff = Date.now() - TIME_WINDOW_MS[timeFilter];
    result = result.filter(item => {
      if (!item.publishedAt) return true; // no date → always show
      return new Date(item.publishedAt).getTime() >= cutoff;
    });
  }

  // Source filter
  if (sourceFilter !== 'all') {
    result = result.filter(item => item.source === sourceFilter);
  }

  // Sort
  if (sortBy === 'random') {
    return seededShuffle(result, shuffleSeed);
  }

  const getTime = (item: FeedItem) =>
    item.publishedAt ? new Date(item.publishedAt).getTime() : 0;

  result.sort((a, b) => {
    switch (sortBy) {
      case 'time-desc': return getTime(b) - getTime(a);
      case 'time-asc': return getTime(a) - getTime(b);
      case 'source-asc': return a.source.localeCompare(b.source);
      case 'source-desc': return b.source.localeCompare(a.source);
      default: return 0;
    }
  });

  return result;
}

// ── App ──────────────────────────────────────────────────────────────────────

type FeedStatus = 'idle' | 'loading' | 'success' | 'error';

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const [sections, setSections] = useState<SectionConfig[]>(() => {
    try {
      const saved = localStorage.getItem('infodeck-sections');
      if (saved) return JSON.parse(saved) as SectionConfig[];
    } catch { /* ignore */ }
    return [
      {
        id: 'news',
        name: 'News',
        icon: 'Globe',
        color: 'blue',
        feeds: [
          'https://feeds.bbci.co.uk/news/rss.xml',
          'https://www.theguardian.com/international/rss',
          'https://www.aljazeera.com/xml/rss/all.xml',
          'https://www.economist.com/latest/rss.xml',
        ],
      },
      {
        id: 'science',
        name: 'Science & Technology',
        icon: 'Cpu',
        color: 'emerald',
        feeds: [
          'https://www.nature.com/nature.rss',
          'https://www.nasa.gov/rss/dyn/breaking_news.rss',
          'https://www.newscientist.com/section/news/feed/',
          'https://arstechnica.com/feed/',
          'https://www.thelancet.com/rssfeed/lanhae_current.xml',
        ],
      },
      {
        id: 'finance',
        name: 'Finance',
        icon: 'TrendingUp',
        color: 'violet',
        feeds: [
          'https://www.ft.com/?format=rss',
          'https://feeds.bloomberg.com/markets/news.rss',
        ],
      },
    ];
  });

  const [sectionItems, setSectionItems] = useState<Record<string, FeedItem[]>>({});
  const [sectionStatus, setSectionStatus] = useState<Record<string, FeedStatus>>({});
  const [sectionError, setSectionError] = useState<Record<string, string>>({});
  // Per-feed error map: feedUrl → error message (empty string = ok)
  const [feedErrors, setFeedErrors] = useState<Record<string, string>>({});

  // Control bar state
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('time-desc');
  const [shuffleSeed, setShuffleSeed] = useState(0);

  // Stable key derived only from feed URLs so unrelated section edits don't trigger re-fetch
  const feedsKey = JSON.stringify(sections.map(s => ({ id: s.id, feeds: s.feeds })));
  const feedsKeyRef = useRef(feedsKey);
  feedsKeyRef.current = feedsKey;
  const prevFeedsKeyRef = useRef('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Persist sections to localStorage on every change
  useEffect(() => {
    localStorage.setItem('infodeck-sections', JSON.stringify(sections));
  }, [sections]);

  // Auto-refresh interval timer
  useEffect(() => {
    if (refreshInterval === 0) return;
    const timer = setInterval(() => setRefreshTick(t => t + 1), refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval]);

  useEffect(() => {
    const feedsChanged = feedsKey !== prevFeedsKeyRef.current;
    prevFeedsKeyRef.current = feedsKey;
    const silent = !feedsChanged; // tick-triggered: no loading spinner

    sections.forEach(section => {
      if (section.feeds.length === 0) {
        if (!silent) {
          setSectionStatus(prev => ({ ...prev, [section.id]: 'idle' }));
          setSectionItems(prev => ({ ...prev, [section.id]: [] }));
        }
        return;
      }

      if (!silent) {
        setSectionStatus(prev => ({ ...prev, [section.id]: 'loading' }));
      }

      Promise.all(section.feeds.map(url => fetchFeedWithStatus(url)))
        .then((results: FeedResult[]) => {
          const items = results.flatMap(r => r.items);
          setSectionItems(prev => ({ ...prev, [section.id]: items }));
          setSectionStatus(prev => ({
            ...prev,
            [section.id]: items.length > 0 ? 'success' : 'error',
          }));
          if (items.length === 0 && !silent) {
            setSectionError(prev => ({
              ...prev,
              [section.id]: 'No feeds returned any items',
            }));
          }
          // Update per-feed error status
          setFeedErrors(prev => {
            const next = { ...prev };
            for (const r of results) {
              next[r.url] = r.error || '';
            }
            return next;
          });
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedsKey, refreshTick]);

  // Derive unique sources from all loaded items (sorted alphabetically)
  const availableSources = useMemo(() => {
    const sources = new Set<string>();
    (Object.values(sectionItems) as FeedItem[][]).forEach(items =>
      items.forEach(item => sources.add(item.source))
    );
    return Array.from(sources).sort();
  }, [sectionItems]);

  // Reset source filter if the selected source disappears
  useEffect(() => {
    if (sourceFilter !== 'all' && !availableSources.includes(sourceFilter)) {
      setSourceFilter('all');
    }
  }, [availableSources, sourceFilter]);

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 font-sans selection:bg-black selection:text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#fafafa]/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 -ml-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            <div className="hidden md:flex flex-col text-xs font-mono text-gray-500">
              <span>{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              <span>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</span>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2">
            <h1 className="text-2xl md:text-3xl font-black tracking-[0.2em] text-black" style={{ fontFamily: 'var(--font-display)' }}>
              INFODECK
            </h1>
          </div>

          <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-full border border-red-100 shadow-sm">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-bold tracking-widest uppercase">Live</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 mt-12 flex-1 w-full">

        {/* Control Bar */}
        <ControlBar
          timeFilter={timeFilter}
          onTimeFilterChange={setTimeFilter}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          availableSources={availableSources}
          onShuffle={() => { setSortBy('random'); setShuffleSeed(Date.now()); }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 xl:gap-12">
          {sections.map((section) => {
            const IconComponent = AVAILABLE_ICONS[section.icon] || Globe;
            const colorConfig = AVAILABLE_COLORS.find(c => c.name === section.color) || AVAILABLE_COLORS[0];
            const status = sectionStatus[section.id] || (section.feeds.length === 0 ? 'idle' : 'loading');
            const rawItems = sectionItems[section.id] || [];
            const error = sectionError[section.id];

            const displayItems = status === 'success'
              ? applyControlsToItems(rawItems, timeFilter, sourceFilter, sortBy, shuffleSeed)
              : [];

            return (
              <section key={section.id}>
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-200">
                  <div className={`p-2 rounded-lg ${colorConfig.bg} ${colorConfig.text}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold tracking-wide uppercase" style={{ fontFamily: 'var(--font-display)' }}>
                    {section.name}
                  </h2>
                  {status === 'success' && rawItems.length > 0 && (
                    <span className="ml-auto text-xs font-mono text-gray-400">
                      {displayItems.length}/{rawItems.length}
                    </span>
                  )}
                </div>

                <div className="h-[calc(100vh-14rem)] overflow-y-auto pr-2 pb-10 custom-scrollbar">
                  {status === 'loading' && <SectionPlaceholder type="loading" />}
                  {status === 'error' && <SectionPlaceholder type="error" message={error} />}
                  {status === 'idle' && <SectionPlaceholder type="empty" />}
                  {status === 'success' && displayItems.length === 0 && rawItems.length > 0 && (
                    <SectionPlaceholder type="no-results" />
                  )}
                  {status === 'success' && displayItems.map((item, idx) => (
                    <FeedCard key={item.id} item={item} index={idx} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <h3 className="text-xl font-black tracking-[0.2em] text-black mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                INFODECK
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
                Your modern, auto-updating dashboard for the latest news and research updates. Aggregating top sources in one clean interface at your disposal.
              </p>
            </div>
            {/* Platform section — hidden until links are ready
            <div>
              <h4 className="font-bold text-gray-900 mb-4 uppercase text-xs tracking-wider">Platform</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-black transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Sources</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Suggest a Feed</a></li>
              </ul>
            </div>
            */}
            {/* Legal section — hidden until links are ready
            <div>
              <h4 className="font-bold text-gray-900 mb-4 uppercase text-xs tracking-wider">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-black transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
            */}
          </div>
          <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} InfoDeck.
            </p>
            <div className="flex items-center gap-4 text-gray-400">
              <a href="#" className="hover:text-black transition-colors"><Github className="w-4 h-4" /></a>
              <a href="#" className="hover:text-black transition-colors"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="hover:text-black transition-colors"><Mail className="w-4 h-4" /></a>
            </div>
          </div>
        </div>
      </footer>

      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onCustomize={() => setIsCustomizeOpen(true)}
        onAddFeed={() => setIsAddFeedOpen(true)}
        refreshInterval={refreshInterval}
        onRefreshIntervalChange={setRefreshInterval}
      />

      <CustomizeModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        sections={sections}
        onSave={setSections}
        feedErrors={feedErrors}
      />

      <AddFeedModal
        isOpen={isAddFeedOpen}
        onClose={() => setIsAddFeedOpen(false)}
        sections={sections}
        onSave={setSections}
      />
    </div>
  );
}
