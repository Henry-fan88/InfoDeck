import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, ChevronUp, ChevronDown, Save, Globe, Cpu, TrendingUp, Briefcase, Heart, Music, Video, Star, Zap, Coffee, Book, Monitor, AlertTriangle, Check } from 'lucide-react';
import { SectionConfig, AVAILABLE_COLORS } from '../types';

export const AVAILABLE_ICONS: Record<string, React.ElementType> = {
  Globe, Cpu, TrendingUp, Briefcase, Heart, Music, Video, Star, Zap, Coffee, Book, Monitor
};

type CustomizeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sections: SectionConfig[];
  onSave: (sections: SectionConfig[]) => void;
  feedErrors?: Record<string, string>; // feedUrl → error message (empty = ok)
};

export function CustomizeModal({ isOpen, onClose, sections, onSave, feedErrors = {} }: CustomizeModalProps) {
  const [localSections, setLocalSections] = useState<SectionConfig[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLocalSections(JSON.parse(JSON.stringify(sections)));
    }
  }, [isOpen, sections]);

  if (!isOpen) return null;

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSections = [...localSections];
    [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    setLocalSections(newSections);
  };

  const handleMoveDown = (index: number) => {
    if (index === localSections.length - 1) return;
    const newSections = [...localSections];
    [newSections[index + 1], newSections[index]] = [newSections[index], newSections[index + 1]];
    setLocalSections(newSections);
  };

  const handleRemove = (index: number) => {
    const newSections = [...localSections];
    newSections.splice(index, 1);
    setLocalSections(newSections);
  };

  const handleAdd = () => {
    setLocalSections([
      ...localSections,
      {
        id: `section-${Date.now()}`,
        name: 'New Section',
        icon: 'Star',
        color: 'sky',
        feeds: []
      }
    ]);
  };

  const updateSection = (index: number, field: keyof SectionConfig, value: any) => {
    const newSections = [...localSections];
    newSections[index] = { ...newSections[index], [field]: value };
    setLocalSections(newSections);
  };

  const updateFeed = (sectionIndex: number, feedIndex: number, value: string) => {
    const newSections = [...localSections];
    newSections[sectionIndex].feeds[feedIndex] = value;
    setLocalSections(newSections);
  };

  const addFeed = (sectionIndex: number) => {
    const newSections = [...localSections];
    newSections[sectionIndex].feeds.push('');
    setLocalSections(newSections);
  };

  const removeFeed = (sectionIndex: number, feedIndex: number) => {
    const newSections = [...localSections];
    newSections[sectionIndex].feeds.splice(feedIndex, 1);
    setLocalSections(newSections);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>Customize Sections</h2>
            <p className="text-sm text-gray-500 mt-1">Reorder, rename, and configure RSS feeds for your dashboard.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {localSections.map((section, index) => (
            <div key={section.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex flex-col gap-1 mt-1">
                  <button onClick={() => handleMoveUp(index)} disabled={index === 0} className="p-1 text-gray-400 hover:text-black disabled:opacity-30 disabled:hover:text-gray-400 transition-colors">
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleMoveDown(index)} disabled={index === localSections.length - 1} className="p-1 text-gray-400 hover:text-black disabled:opacity-30 disabled:hover:text-gray-400 transition-colors">
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Section Name</label>
                      <input 
                        type="text" 
                        value={section.name} 
                        onChange={(e) => updateSection(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400 transition-all text-sm font-medium"
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Icon</label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(AVAILABLE_ICONS).map(([iconName, IconComponent]) => (
                          <button
                            key={iconName}
                            onClick={() => updateSection(index, 'icon', iconName)}
                            className={`p-2 rounded-lg border transition-all ${
                              section.icon === iconName 
                                ? 'border-gray-900 bg-gray-900 text-white' 
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-900'
                            }`}
                            title={iconName}
                          >
                            <IconComponent className="w-4 h-4" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Color</label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_COLORS.map(c => (
                          <button
                            key={c.name}
                            onClick={() => updateSection(index, 'color', c.name)}
                            className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${c.bg} ${c.text} ${
                              section.color === c.name ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-110'
                            }`}
                            title={c.name}
                          >
                            {section.color === c.name && <div className="w-2 h-2 rounded-full bg-current" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">RSS Feeds</label>
                    <div className="space-y-2">
                      {section.feeds.map((feed, fIndex) => {
                        const errMsg = feed ? feedErrors[feed] : undefined;
                        // undefined = not fetched yet, '' = ok, non-empty string = error
                        const hasError = errMsg !== undefined && errMsg !== '';
                        const isOk = errMsg === '';
                        return (
                          <div key={fIndex}>
                            <div className="flex gap-2 items-center">
                              <div className="relative flex-1">
                                <input
                                  type="url"
                                  value={feed}
                                  placeholder="https://example.com/feed.xml"
                                  onChange={(e) => updateFeed(index, fIndex, e.target.value)}
                                  className={`w-full px-3 py-2 pr-9 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400 transition-all text-sm font-mono ${
                                    hasError ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                                  }`}
                                />
                                {feed && (isOk || hasError) && (
                                  <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${hasError ? 'text-red-500' : 'text-emerald-500'}`} title={hasError ? errMsg : 'Feed loaded successfully'}>
                                    {hasError ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                  </span>
                                )}
                              </div>
                              <button onClick={() => removeFeed(index, fIndex)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            {hasError && (
                              <p className="mt-1 ml-0.5 text-xs text-red-500">{errMsg}</p>
                            )}
                          </div>
                        );
                      })}
                      <button 
                        onClick={() => addFeed(index)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black transition-colors py-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Feed URL
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={() => handleRemove(index)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-6">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          <button 
            onClick={handleAdd}
            className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 font-semibold hover:border-gray-400 hover:text-black transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add New Section
          </button>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-black transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => { onSave(localSections); onClose(); }}
            className="px-6 py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}
