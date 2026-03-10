export type FeedItem = {
  id: string;
  title: string;
  source: string;
  sourceDomain: string;
  time: string;
  url: string;
  publishedAt?: string; // raw ISO/RFC date string used for filtering and sorting
};

export type SectionConfig = {
  id: string;
  name: string;
  icon: string;
  color: string;
  feeds: string[];
};

export const AVAILABLE_COLORS = [
  { name: 'blue', bg: 'bg-blue-50', text: 'text-blue-600' },
  { name: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { name: 'violet', bg: 'bg-violet-50', text: 'text-violet-600' },
  { name: 'rose', bg: 'bg-rose-50', text: 'text-rose-600' },
  { name: 'amber', bg: 'bg-amber-50', text: 'text-amber-600' },
  { name: 'sky', bg: 'bg-sky-50', text: 'text-sky-600' },
];
