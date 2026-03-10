import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings, Plus, RefreshCw } from 'lucide-react';

export const REFRESH_INTERVALS = [
  { label: 'Off',    ms: 0              },
  { label: '1 min',  ms: 1  * 60 * 1000 },
  { label: '5 min',  ms: 5  * 60 * 1000 },
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '1 hr',   ms: 60 * 60 * 1000 },
] as const;

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  onCustomize: () => void;
  onAddFeed: () => void;
  refreshInterval: number;
  onRefreshIntervalChange: (ms: number) => void;
};

export function Sidebar({ isOpen, onClose, onCustomize, onAddFeed, refreshInterval, onRefreshIntervalChange }: SidebarProps) {
  const sliderIndex = REFRESH_INTERVALS.findIndex(r => r.ms === refreshInterval);
  const currentLabel = REFRESH_INTERVALS[sliderIndex]?.label ?? 'Off';
  const isActive = refreshInterval > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-50 flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-lg font-black tracking-widest uppercase" style={{ fontFamily: 'var(--font-display)' }}>Menu</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 flex-1 flex flex-col gap-2">
              <button
                onClick={() => { onCustomize(); onClose(); }}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black rounded-xl transition-colors w-full text-left"
              >
                <Settings className="w-5 h-5" />
                Customize Sections
              </button>
              <button
                onClick={() => { onAddFeed(); onClose(); }}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black rounded-xl transition-colors w-full text-left"
              >
                <Plus className="w-5 h-5" />
                Add RSS Feed
              </button>
            </div>

            {/* Auto-refresh slider */}
            <div className="px-5 py-5 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${isActive ? 'text-black animate-spin [animation-duration:3s]' : 'text-gray-400'}`} />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Auto-Refresh</span>
                </div>
                <span className={`text-xs font-mono font-semibold ${isActive ? 'text-black' : 'text-gray-400'}`}>
                  {currentLabel}
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={REFRESH_INTERVALS.length - 1}
                step={1}
                value={sliderIndex === -1 ? 0 : sliderIndex}
                onChange={e => onRefreshIntervalChange(REFRESH_INTERVALS[Number(e.target.value)].ms)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-black bg-gray-200"
              />

              <div className="flex justify-between mt-2">
                {REFRESH_INTERVALS.map((r, i) => (
                  <span
                    key={r.label}
                    className={`text-[10px] font-mono transition-colors ${i === sliderIndex ? 'text-black font-bold' : 'text-gray-400'}`}
                  >
                    {r.label === 'Off' ? 'Off' : r.label.replace(' ', '')}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
