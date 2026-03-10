import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Save } from 'lucide-react';
import { SectionConfig } from '../types';

type AddFeedModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sections: SectionConfig[];
  onSave: (sections: SectionConfig[]) => void;
};

export function AddFeedModal({ isOpen, onClose, sections, onSave }: AddFeedModalProps) {
  const [feedUrl, setFeedUrl] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id || '');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!feedUrl.trim()) return;
    
    const newSections = sections.map(sec => {
      if (sec.id === selectedSectionId) {
        return { ...sec, feeds: [...sec.feeds, feedUrl.trim()] };
      }
      return sec;
    });
    
    onSave(newSections);
    setFeedUrl('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>Add RSS Feed</h2>
            <p className="text-sm text-gray-500 mt-1">Quickly add a new feed to an existing section.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">RSS Feed URL</label>
            <input 
              type="url" 
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400 transition-all text-sm font-mono"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Add to Section</label>
            <select 
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400 transition-all text-sm font-medium appearance-none"
            >
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-black transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!feedUrl.trim()}
            className="px-6 py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-black transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Feed
          </button>
        </div>
      </motion.div>
    </div>
  );
}
