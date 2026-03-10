import React from 'react';
import { Clock, Rss, ArrowUpDown, ChevronDown, Shuffle } from 'lucide-react';

export type TimeFilter = 'all' | '15m' | '1h' | '3h' | '1d';
export type SortBy    = 'time-desc' | 'time-asc' | 'source-asc' | 'source-desc' | 'random';

type ControlBarProps = {
  timeFilter: TimeFilter;
  onTimeFilterChange: (v: TimeFilter) => void;
  sourceFilter: string;
  onSourceFilterChange: (v: string) => void;
  sortBy: SortBy;
  onSortByChange: (v: SortBy) => void;
  availableSources: string[];
  onShuffle: () => void;
};

function SelectPill({
  icon: Icon,
  value,
  onChange,
  children,
  active,
}: {
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <div
      className={`relative flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl shadow-sm transition-colors ${
        active ? 'border-gray-800' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-gray-800' : 'text-gray-400'}`} />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer pr-1"
      >
        {children}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 pointer-events-none" />
    </div>
  );
}

export function ControlBar({
  timeFilter,
  onTimeFilterChange,
  sourceFilter,
  onSourceFilterChange,
  sortBy,
  onSortByChange,
  availableSources,
  onShuffle,
}: ControlBarProps) {
  const timeActive   = timeFilter !== 'all';
  const sourceActive = sourceFilter !== 'all';
  const sortActive   = sortBy !== 'time-desc' && sortBy !== 'random';
  const isShuffled   = sortBy === 'random';

  return (
    <div className="relative flex items-center justify-center mb-10">
      {/* Centered pills */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {/* Time filter */}
        <SelectPill
          icon={Clock}
          value={timeFilter}
          onChange={v => onTimeFilterChange(v as TimeFilter)}
          active={timeActive}
        >
          <option value="all">All Time</option>
          <option value="15m">Last 15 min</option>
          <option value="1h">Last 1 hour</option>
          <option value="3h">Last 3 hours</option>
          <option value="1d">Last 24 hours</option>
        </SelectPill>

        {/* Source filter — only shown when there are sources to filter by */}
        {availableSources.length > 0 && (
          <SelectPill
            icon={Rss}
            value={sourceFilter}
            onChange={v => onSourceFilterChange(v)}
            active={sourceActive}
          >
            <option value="all">All Sources</option>
            {availableSources.map(src => (
              <option key={src} value={src}>{src}</option>
            ))}
          </SelectPill>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Sort */}
        <SelectPill
          icon={ArrowUpDown}
          value={sortBy === 'random' ? 'time-desc' : sortBy}
          onChange={v => onSortByChange(v as SortBy)}
          active={sortActive}
        >
          <option value="time-desc">Newest First</option>
          <option value="time-asc">Oldest First</option>
          <option value="source-asc">Source A → Z</option>
          <option value="source-desc">Source Z → A</option>
        </SelectPill>
      </div>

      {/* Shuffle button — absolutely positioned to the right */}
      <button
        onClick={onShuffle}
        className={`absolute right-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors ${
          isShuffled
            ? 'bg-black text-white'
            : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-800 hover:text-black'
        }`}
      >
        <Shuffle className="w-4 h-4" />
        Shuffle
      </button>
    </div>
  );
}
