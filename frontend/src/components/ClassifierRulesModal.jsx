import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Sliders,
  Search,
  Plus,
  Trash2,
  Sparkles,
  Check,
  RotateCcw,
  Loader2,
  Tag,
  Hash,
  AlertCircle,
  Languages,
  Edit2
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { TAG_TRANSLATIONS } from '../i18n/translations';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n/languages';
import { matchesTagSearch } from '../utils/tagUtils';

export function ClassifierRulesModal({
  isOpen,
  onClose,
  tagStructure = []
}) {
  const { t, tTag, lang, setCustomTagTranslations, customTagTranslations } = useI18n();
  const [rules, setRules] = useState({});
  const [selectedTag, setSelectedTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const mouseDownTargetRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Synonyms suggestion state
  const [synonymInput, setSynonymInput] = useState('');
  const [negInput, setNegInput] = useState('');
  const [suggestedSynonyms, setSuggestedSynonyms] = useState([]);
  const [isLoadingSynonyms, setIsLoadingSynonyms] = useState(false);

  // Tag translation entry state
  const [newTransLang, setNewTransLang] = useState(DEFAULT_LANGUAGE);
  const [newTransValue, setNewTransValue] = useState('');

  // Extract all tag names from tagStructure
  const allTagNames = useMemo(() => {
    const set = new Set();
    const traverse = (nodes) => {
      nodes.forEach(n => {
        const val = n.tag || n.name || n.id;
        if (val && !val.startsWith('tag-')) set.add(val);
        if (n.children && n.children.length) traverse(n.children);
      });
    };
    if (tagStructure && Array.isArray(tagStructure)) {
      traverse(tagStructure);
    }
    // Also include any custom rule keys that might not be in the tree
    Object.keys(rules).forEach(k => set.add(k));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tagStructure, rules]);

  // Load rules from API
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetch('/api/classifier/rules')
      .then(res => res.json())
      .then(data => {
        const loadedRules = data || {};
        const merged = { ...loadedRules };

        // Automatically populate default translations from TAG_TRANSLATIONS
        // for any tag rule that does not have custom translations defined yet
        Object.entries(TAG_TRANSLATIONS).forEach(([tagKey, transObj]) => {
          const cur = merged[tagKey] || {
            is_mandatory_branch: false,
            exclusions: {},
            keywords: [],
            negative_keywords: [],
            numeric_ranges: []
          };
          if (cur.translations === undefined) {
            cur.translations = { ...transObj };
          }
          merged[tagKey] = cur;
        });

        setRules(merged);
        if (!selectedTag && allTagNames.length > 0) {
          setSelectedTag(allTagNames[0]);
        }
      })
      .catch(err => console.error('Failed to load rules:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  // Select first tag if none selected
  useEffect(() => {
    if (!selectedTag && allTagNames.length > 0) {
      setSelectedTag(allTagNames[0]);
    }
  }, [allTagNames, selectedTag]);

  if (!isOpen) return null;

  const pruneParentsEnabled = rules._settings?.prune_parents_enabled ?? true;

  const currentRule = rules[selectedTag] || {
    is_mandatory_branch: false,
    exclusions: {},
    keywords: [],
    negative_keywords: [],
    numeric_ranges: []
  };

  const filteredTagNames = allTagNames.filter(tName =>
    matchesTagSearch(tName, searchQuery, {
      customTranslations: customTagTranslations,
      systemTranslations: TAG_TRANSLATIONS
    })
  );

  const handleTogglePruneParents = () => {
    setRules(prev => ({
      ...prev,
      _settings: {
        ...(prev._settings || {}),
        prune_parents_enabled: !pruneParentsEnabled
      }
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/classifier/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules })
      });

      // Synchronize updated translations with global I18nContext
      if (setCustomTagTranslations) {
        const extracted = {};
        Object.entries(rules).forEach(([k, r]) => {
          if (r && typeof r === 'object' && r.translations) {
            extracted[k] = r.translations;
          }
        });
        setCustomTagTranslations(extracted);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to save rules:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSelectedRule = (updater) => {
    setRules(prev => {
      const existing = prev[selectedTag] || {
        is_mandatory_branch: false,
        exclusions: {},
        keywords: [],
        negative_keywords: [],
        numeric_ranges: []
      };
      const updated = updater(existing);
      return {
        ...prev,
        [selectedTag]: updated
      };
    });
  };

  // Symmetric exclusion helpers
  const mirrorPriority = {
    win: 'lose',
    lose: 'win',
    equal: 'equal'
  };

  const getExclusionInfo = (val) => {
    if (typeof val === 'string') {
      return { priority: val, cascade: false };
    }
    if (typeof val === 'object' && val !== null) {
      return { priority: val.priority || 'win', cascade: Boolean(val.cascade) };
    }
    return { priority: 'win', cascade: false };
  };

  const addExclusion = (otherTag) => {
    if (!otherTag || otherTag === selectedTag) return;
    setRules(prev => {
      const cur = prev[selectedTag] || { is_mandatory_branch: false, exclusions: {}, keywords: [], negative_keywords: [], numeric_ranges: [] };
      const oth = prev[otherTag] || { is_mandatory_branch: false, exclusions: {}, keywords: [], negative_keywords: [], numeric_ranges: [] };
      
      const curExclusions = { ...(cur.exclusions || {}), [otherTag]: { priority: 'win', cascade: false } };
      const othExclusions = { ...(oth.exclusions || {}), [selectedTag]: { priority: 'lose', cascade: false } };

      return {
        ...prev,
        [selectedTag]: { ...cur, exclusions: curExclusions },
        [otherTag]: { ...oth, exclusions: othExclusions }
      };
    });
  };

  const updateExclusionPriority = (otherTag, priority) => {
    setRules(prev => {
      const cur = prev[selectedTag] || { is_mandatory_branch: false, exclusions: {}, keywords: [], negative_keywords: [], numeric_ranges: [] };
      const oth = prev[otherTag] || { is_mandatory_branch: false, exclusions: {}, keywords: [], negative_keywords: [], numeric_ranges: [] };

      const curInfo = getExclusionInfo((cur.exclusions || {})[otherTag]);
      const othInfo = getExclusionInfo((oth.exclusions || {})[selectedTag]);

      const curExclusions = { ...(cur.exclusions || {}), [otherTag]: { ...curInfo, priority } };
      const othExclusions = { ...(oth.exclusions || {}), [selectedTag]: { ...othInfo, priority: mirrorPriority[priority] || 'equal' } };

      return {
        ...prev,
        [selectedTag]: { ...cur, exclusions: curExclusions },
        [otherTag]: { ...oth, exclusions: othExclusions }
      };
    });
  };

  const toggleExclusionCascade = (otherTag, cascade) => {
    setRules(prev => {
      const cur = prev[selectedTag] || { is_mandatory_branch: false, exclusions: {}, keywords: [], negative_keywords: [], numeric_ranges: [] };
      const oth = prev[otherTag] || { is_mandatory_branch: false, exclusions: {}, keywords: [], negative_keywords: [], numeric_ranges: [] };

      const curInfo = getExclusionInfo((cur.exclusions || {})[otherTag]);
      const othInfo = getExclusionInfo((oth.exclusions || {})[selectedTag]);

      const curExclusions = { ...(cur.exclusions || {}), [otherTag]: { ...curInfo, cascade } };
      const othExclusions = { ...(oth.exclusions || {}), [selectedTag]: { ...othInfo, cascade } };

      return {
        ...prev,
        [selectedTag]: { ...cur, exclusions: curExclusions },
        [otherTag]: { ...oth, exclusions: othExclusions }
      };
    });
  };

  const removeExclusion = (otherTag) => {
    setRules(prev => {
      const cur = { ...(prev[selectedTag] || {}) };
      const oth = { ...(prev[otherTag] || {}) };

      if (cur.exclusions) {
        const nextCur = { ...cur.exclusions };
        delete nextCur[otherTag];
        cur.exclusions = nextCur;
      }
      if (oth.exclusions) {
        const nextOth = { ...oth.exclusions };
        delete nextOth[selectedTag];
        oth.exclusions = nextOth;
      }

      return {
        ...prev,
        [selectedTag]: cur,
        [otherTag]: oth
      };
    });
  };

  // Keywords management
  const addKeyword = (kw) => {
    const val = kw.trim().toLowerCase();
    if (!val) return;
    updateSelectedRule(rule => {
      const list = rule.keywords || [];
      if (list.includes(val)) return rule;
      return { ...rule, keywords: [...list, val] };
    });
    setSynonymInput('');
  };

  const removeKeyword = (kw) => {
    updateSelectedRule(rule => ({
      ...rule,
      keywords: (rule.keywords || []).filter(k => k !== kw)
    }));
  };

  // Negative keywords management
  const addNegativeKeyword = (kw) => {
    const val = kw.trim().toLowerCase();
    if (!val) return;
    updateSelectedRule(rule => {
      const list = rule.negative_keywords || [];
      if (list.includes(val)) return rule;
      return { ...rule, negative_keywords: [...list, val] };
    });
    setNegInput('');
  };

  const removeNegativeKeyword = (kw) => {
    updateSelectedRule(rule => ({
      ...rule,
      negative_keywords: (rule.negative_keywords || []).filter(k => k !== kw)
    }));
  };

  // Numeric ranges management
  const addNumericRange = () => {
    updateSelectedRule(rule => ({
      ...rule,
      numeric_ranges: [
        ...(rule.numeric_ranges || []),
        { metric: 'length', min: 0, max: 50, unit: 'm' }
      ]
    }));
  };

  const updateNumericRange = (idx, field, value) => {
    updateSelectedRule(rule => {
      const ranges = [...(rule.numeric_ranges || [])];
      ranges[idx] = { ...ranges[idx], [field]: value };
      return { ...rule, numeric_ranges: ranges };
    });
  };

  const removeNumericRange = (idx) => {
    updateSelectedRule(rule => ({
      ...rule,
      numeric_ranges: (rule.numeric_ranges || []).filter((_, i) => i !== idx)
    }));
  };

  // Translations management (tag name localized variants)
  const addTagTranslation = (targetLang, val) => {
    const cleanVal = val.trim();
    if (!cleanVal) return;
    updateSelectedRule(rule => ({
      ...rule,
      translations: {
        ...(rule.translations || {}),
        [targetLang]: cleanVal
      }
    }));
    setNewTransValue('');
  };

  const updateTagTranslation = (targetLang, val) => {
    const cleanVal = val.trim();
    updateSelectedRule(rule => {
      const next = { ...(rule.translations || {}) };
      if (!cleanVal) {
        delete next[targetLang];
      } else {
        next[targetLang] = cleanVal;
      }
      return { ...rule, translations: next };
    });
  };

  const removeTagTranslation = (targetLang) => {
    updateSelectedRule(rule => {
      const next = { ...(rule.translations || {}) };
      delete next[targetLang];
      return { ...rule, translations: next };
    });
  };

  // Suggest synonyms via API
  const handleSuggestSynonyms = async () => {
    if (!selectedTag) return;
    setIsLoadingSynonyms(true);
    setSuggestedSynonyms([]);
    try {
      const res = await fetch(`/api/classifier/suggest-synonyms?word=${encodeURIComponent(selectedTag)}`);
      const data = await res.json();
      if (data && data.synonyms) {
        setSuggestedSynonyms(data.synonyms);
      }
    } catch (err) {
      console.error('Failed to suggest synonyms:', err);
    } finally {
      setIsLoadingSynonyms(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto"
      onMouseDown={(e) => {
        mouseDownTargetRef.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-[#171d25] border border-[#2d4358] rounded-xl w-full max-w-4xl max-h-[calc(100%-2rem)] flex flex-col shadow-2xl overflow-hidden text-[#c7d5e0] my-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#233547] flex items-center justify-between bg-[#121820] shrink-0">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#b388ff]" />
            <div>
              <h2 className="text-base font-bold text-white">{t('rules.title')}</h2>
              <p className="text-[11px] text-gray-400">{t('rules.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Rule Banner: Pruning parents */}
        <div className="px-6 py-2.5 bg-[#141b24] border-b border-[#233547] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="toggle-prune-parents"
              checked={pruneParentsEnabled}
              onChange={handleTogglePruneParents}
              className="rounded border-[#3b4f66] bg-[#1a2330] text-[#b388ff] focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
            />
            <label htmlFor="toggle-prune-parents" className="text-xs text-gray-200 cursor-pointer select-none">
              <span className="font-semibold text-white">{t('rules.pruneParents')}</span>
              <span className="text-gray-400 ml-1.5">{t('rules.pruneParentsDesc')}</span>
            </label>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium ${pruneParentsEnabled ? 'bg-[#233524] text-[#a4d053] border border-[#3b593d]' : 'bg-[#2a1719] text-[#ff8e8e] border border-[#59262b]'}`}>
            {pruneParentsEnabled ? t('rules.enabled') : t('rules.disabled')}
          </span>
        </div>

        {/* Content Body: Left Column (Tags) + Right Column (Rules) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left Column: Tags list with search */}
          <div className="w-64 border-r border-[#233547] bg-[#131922] flex flex-col">
            <div className="p-3 border-b border-[#233547]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('rules.searchTags')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1b2533] border border-[#2c3d52] rounded pl-8 pr-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#b388ff]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {filteredTagNames.map(tagName => {
                const tagRule = rules[tagName];
                const hasRule = Boolean(tagRule && (
                  (tagRule.keywords && tagRule.keywords.length > 0) ||
                  (tagRule.numeric_ranges && tagRule.numeric_ranges.length > 0) ||
                  (tagRule.exclusions && Object.keys(tagRule.exclusions).length > 0) ||
                  tagRule.is_mandatory_branch
                ));
                const isMandatory = Boolean(tagRule?.is_mandatory_branch);
                const isSelected = selectedTag === tagName;

                return (
                  <button
                    key={tagName}
                    type="button"
                    onClick={() => {
                      setSelectedTag(tagName);
                      setSuggestedSynonyms([]);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded text-xs flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#32234e] text-[#e0b0ff] font-semibold border border-[#6b45a6]'
                        : 'text-gray-300 hover:bg-[#1a2330] hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate">{tTag(tagName)}</span>
                      {tTag(tagName) !== tagName && (
                        <span className="text-[10px] text-gray-500 font-mono truncate">{tagName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isMandatory && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#a4d053]" title={t('rules.mandatoryBranchTitle')} />
                      )}
                      {hasRule && !isMandatory && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#b388ff]" title={t('rules.hasRulesTooltip')} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Rule Editor */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#161c24] flex flex-col gap-5">
            {selectedTag ? (
              <>
                {/* Tag Header */}
                <div className="flex items-center justify-between border-b border-[#233547] pb-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#b388ff]" />
                    <h3 className="text-base font-bold text-white">{tTag(selectedTag)}</h3>
                    {tTag(selectedTag) !== selectedTag && (
                      <span className="text-xs text-gray-400 font-mono">({selectedTag})</span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {t('rules.synonymsCount', { synCount: currentRule.keywords?.length || 0, exCount: Object.keys(currentRule.exclusions || {}).length })}
                  </span>
                </div>

                {/* Section: Mandatory Branch Checkbox */}
                <div className="bg-[#121822] border border-[#26374a] rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="mandatory-branch-checkbox"
                      checked={Boolean(currentRule.is_mandatory_branch)}
                      onChange={(e) => updateSelectedRule(r => ({ ...r, is_mandatory_branch: e.target.checked }))}
                      className="rounded border-[#3b4f66] bg-[#1a2330] text-[#a4d053] focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                    />
                    <label htmlFor="mandatory-branch-checkbox" className="text-xs text-gray-200 cursor-pointer select-none">
                      <span className="font-semibold text-white">{t('rules.mandatoryBranchTitle')}</span>
                      <span className="text-gray-400 block text-[11px]">
                        {t('rules.mandatoryBranchDesc')}
                      </span>
                    </label>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${currentRule.is_mandatory_branch ? 'bg-[#1b2b1e] text-[#a4d053] border border-[#2a472f]' : 'bg-[#1a212c] text-gray-500 border border-[#2a3747]'}`}>
                    {currentRule.is_mandatory_branch ? t('rules.mandatoryBadge') : t('rules.optionalBadge')}
                  </span>
                </div>

                {/* Section: Mutually Exclusive Tags (Exclusions) */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>{t('rules.exclusionsTitle')}</span>
                      </label>
                      <p className="text-[11px] text-gray-400">
                        {t('rules.exclusionsDesc')}
                      </p>
                    </div>

                    {/* Add exclusion selector */}
                    <div className="flex items-center gap-1.5">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            addExclusion(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="bg-[#1a2330] text-xs text-gray-200 border border-[#37495e] rounded px-2.5 py-1 focus:outline-none focus:border-[#b388ff] cursor-pointer"
                      >
                        <option value="" disabled>{t('rules.addExclusionPlaceholder')}</option>
                        {allTagNames
                          .filter(t => t !== selectedTag && !Boolean(currentRule.exclusions && currentRule.exclusions[t]))
                          .map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>

                  {/* Exclusions List */}
                  {(!currentRule.exclusions || Object.keys(currentRule.exclusions).length === 0) ? (
                    <div className="bg-[#121720] border border-[#233547] rounded-lg p-3 text-center text-xs text-gray-500 italic">
                      {t('rules.noExclusions')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(currentRule.exclusions).map(([otherTag, rawEx]) => {
                        const { priority, cascade } = getExclusionInfo(rawEx);
                        return (
                          <div
                            key={otherTag}
                            className="bg-[#121720] border border-[#2a3c50] rounded-lg p-3 flex flex-col gap-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-semibold">{selectedTag}</span>
                                <span className="text-gray-500 text-xs">{t('rules.conflictsWith')}</span>
                                <span className="text-[#b388ff] font-semibold bg-[#231a33] px-2 py-0.5 rounded border border-[#48306e]">
                                  {otherTag}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-[11px]">{t('rules.conflictAction')}</span>
                                <select
                                  value={priority}
                                  onChange={(e) => updateExclusionPriority(otherTag, e.target.value)}
                                  className={`rounded px-2 py-1 text-xs font-semibold focus:outline-none border cursor-pointer ${
                                    priority === 'win'
                                      ? 'bg-[#1b2b1e] text-[#a4d053] border-[#2d4d33]'
                                      : priority === 'lose'
                                      ? 'bg-[#2b191c] text-[#ff8e8e] border-[#57272e]'
                                      : 'bg-[#2b2416] text-[#ffd166] border-[#594622]'
                                  }`}
                                >
                                  <option value="win">{t('rules.winActionTag', { tag: selectedTag })}</option>
                                  <option value="lose">{t('rules.loseActionTag', { tag: otherTag })}</option>
                                  <option value="equal">{t('rules.equalAction')}</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={() => removeExclusion(otherTag)}
                                  className="text-gray-500 hover:text-[#ff6b6b] p-1 rounded hover:bg-[#261215] transition cursor-pointer"
                                  title={t('rules.deleteExclusion')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Checkbox for Cascading to Child Tags */}
                            <div className="flex items-center gap-2 pt-2 border-t border-[#1e2a38] text-[11px]">
                              <input
                                type="checkbox"
                                id={`cascade-${selectedTag}-${otherTag}`}
                                checked={cascade}
                                onChange={(e) => toggleExclusionCascade(otherTag, e.target.checked)}
                                className="rounded border-[#3b4f66] bg-[#1a2330] text-[#a4d053] focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                              />
                              <label htmlFor={`cascade-${selectedTag}-${otherTag}`} className="text-gray-300 cursor-pointer select-none flex items-center gap-1.5">
                                <span>{t('rules.cascade')}</span>
                                {cascade && (
                                  <span className="text-[10px] bg-[#1a2736] text-[#70b1ff] px-1.5 py-0.2 rounded border border-[#2b425b]">
                                    {t('rules.includesChildren')}
                                  </span>
                                )}
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section 1: Keywords / Synonyms */}
                <div className="flex flex-col gap-2 pt-2 border-t border-[#233547]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span>{t('rules.keywordsTitle')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSuggestSynonyms}
                      disabled={isLoadingSynonyms}
                      className="text-xs font-medium text-[#b388ff] hover:text-[#d3adff] bg-[#241738] hover:bg-[#321f4e] border border-[#523282] px-2.5 py-1 rounded flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingSynonyms ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>{t('rules.fetchOnline')}</span>
                    </button>
                  </div>

                  {/* Synonyms Tag Cloud / Input */}
                  <div className="bg-[#121720] border border-[#233547] rounded-lg p-3 min-h-[70px] flex flex-wrap gap-1.5 items-center">
                    {(currentRule.keywords || []).map(kw => (
                      <span
                        key={kw}
                        className="bg-[#241c38] text-[#e0b0ff] border border-[#4d3475] text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => removeKeyword(kw)}
                          className="text-gray-400 hover:text-[#ff6b6b] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder={t('rules.addSynonym')}
                        value={synonymInput}
                        onChange={(e) => setSynonymInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addKeyword(synonymInput);
                          }
                        }}
                        className="bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none px-2 py-1 w-32"
                      />
                      {synonymInput.trim() && (
                        <button
                          type="button"
                          onClick={() => addKeyword(synonymInput)}
                          className="text-[#a4d053] hover:text-white text-xs cursor-pointer px-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Online Suggestions Pills */}
                  {suggestedSynonyms.length > 0 && (
                    <div className="p-2.5 bg-[#1a1426] border border-[#3e2761] rounded text-xs flex flex-col gap-1.5">
                      <span className="text-gray-400 text-[11px]">{t('rules.foundInDatabase')}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestedSynonyms.map(syn => {
                          const alreadyAdded = (currentRule.keywords || []).includes(syn);
                          if (alreadyAdded) return null;
                          return (
                            <button
                              key={syn}
                              type="button"
                              onClick={() => addKeyword(syn)}
                              className="text-[11px] bg-[#2b1e42] hover:bg-[#3f2963] text-[#cfb0ff] border border-[#523382] px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>{syn}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Negative Keywords (Exceptions) */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-white">
                    {t('rules.negativeKeywords')}
                  </label>
                  <p className="text-[11px] text-gray-400 -mt-1">
                    {t('rules.negativeKeywordsDesc')}
                  </p>
                  <div className="bg-[#121720] border border-[#233547] rounded-lg p-3 min-h-[50px] flex flex-wrap gap-1.5 items-center">
                    {(currentRule.negative_keywords || []).map(kw => (
                      <span
                        key={kw}
                        className="bg-[#2a1719] text-[#ff8e8e] border border-[#59262b] text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => removeNegativeKeyword(kw)}
                          className="text-gray-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder={t('rules.addNegative')}
                        value={negInput}
                        onChange={(e) => setNegInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addNegativeKeyword(negInput);
                          }
                        }}
                        className="bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none px-2 py-1 w-36"
                      />
                      {negInput.trim() && (
                        <button
                          type="button"
                          onClick={() => addNegativeKeyword(negInput)}
                          className="text-[#ff6b6b] hover:text-white text-xs cursor-pointer px-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Dynamic Numeric Ranges («від — до») */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-[#233547]">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>{t('rules.numericTitle')}</span>
                      </label>
                      <p className="text-[11px] text-gray-400">
                        {t('rules.numericDesc')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addNumericRange}
                      className="text-xs font-semibold text-[#a4d053] hover:text-white bg-[#142618] hover:bg-[#1f3b25] border border-[#264d2e] px-2.5 py-1 rounded flex items-center gap-1 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('rules.addRangeBtn')}</span>
                    </button>
                  </div>

                  {(!currentRule.numeric_ranges || currentRule.numeric_ranges.length === 0) ? (
                    <div className="bg-[#121720] border border-[#233547] rounded-lg p-4 text-center text-xs text-gray-500 italic">
                      {t('rules.noNumeric')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentRule.numeric_ranges.map((range, idx) => (
                        <div
                          key={idx}
                          className="bg-[#121720] border border-[#2a3c50] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{t('rules.param')}</span>
                            <select
                              value={range.metric}
                              onChange={(e) => updateNumericRange(idx, 'metric', e.target.value)}
                              className="bg-[#1a2330] text-white border border-[#3b4f66] rounded px-2 py-1 text-xs focus:outline-none"
                            >
                              <option value="length">{t('rules.paramLength')}</option>
                              <option value="mass">{t('rules.paramMass')}</option>
                              <option value="capacity">{t('rules.paramCapacity')}</option>
                              <option value="speed">{t('rules.paramSpeed')}</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{t('rules.from')}</span>
                            <input
                              type="number"
                              value={range.min}
                              onChange={(e) => updateNumericRange(idx, 'min', Number(e.target.value))}
                              className="bg-[#1a2330] text-white border border-[#3b4f66] rounded px-2 py-1 w-20 text-xs font-mono"
                            />

                            <span className="text-gray-400">{t('rules.to')}</span>
                            <input
                              type="number"
                              value={range.max}
                              onChange={(e) => updateNumericRange(idx, 'max', Number(e.target.value))}
                              className="bg-[#1a2330] text-white border border-[#3b4f66] rounded px-2 py-1 w-20 text-xs font-mono"
                            />

                            <span className="text-gray-500 text-[11px] font-mono">
                              {range.metric === 'length' ? t('rules.unitM') : range.metric === 'mass' ? t('rules.unitKg') : range.metric === 'capacity' ? t('rules.unitSeats') : t('rules.unitKmh')}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeNumericRange(idx)}
                            className="text-gray-500 hover:text-[#ff6b6b] p-1 rounded hover:bg-[#261215] transition cursor-pointer"
                            title={t('rules.deleteCriteria')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 4: Tag Name Translations (Localized Variants) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-[#233547]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Languages className="w-4 h-4 text-[#66c0f4]" />
                      <span>{t('rules.translationsTitle')}</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-400 -mt-1">
                    {t('rules.translationsDesc')}
                  </p>

                  {/* Add New Translation Row */}
                  <div className="flex items-center gap-2 bg-[#121720] border border-[#233547] rounded-lg p-2.5">
                    <select
                      value={newTransLang}
                      onChange={(e) => setNewTransLang(e.target.value)}
                      className="bg-[#1a2330] text-white border border-[#3b4f66] rounded px-2 py-1 text-xs focus:outline-none cursor-pointer"
                    >
                      {SUPPORTED_LANGUAGES.map(sl => (
                        <option key={sl.code} value={sl.code}>
                          {sl.name} ({sl.code})
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder={t('rules.enterTranslationPlaceholder')}
                      value={newTransValue}
                      onChange={(e) => setNewTransValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTagTranslation(newTransLang, newTransValue);
                        }
                      }}
                      className="flex-1 bg-[#1a2330] text-white border border-[#3b4f66] rounded px-2.5 py-1 text-xs focus:outline-none focus:border-[#66c0f4]"
                    />

                    <button
                      type="button"
                      disabled={!newTransValue.trim()}
                      onClick={() => addTagTranslation(newTransLang, newTransValue)}
                      className="px-3 py-1 bg-[#1e344d] hover:bg-[#2c4e75] text-[#66c0f4] hover:text-white border border-[#335680] rounded text-xs font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('rules.addTranslation')}</span>
                    </button>
                  </div>

                  {/* List of current translations */}
                  {(!currentRule.translations || Object.keys(currentRule.translations).length === 0) ? (
                    <div className="bg-[#121720] border border-[#233547] rounded-lg p-3 text-center text-xs text-gray-500 italic">
                      {t('rules.noTranslations')}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.entries(currentRule.translations).map(([langKey, transVal]) => (
                        <div
                          key={langKey}
                          className="bg-[#121720] border border-[#233547] rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs uppercase px-2 py-0.5 rounded bg-[#1f2d3d] text-[#66c0f4] border border-[#2b425b]">
                              {langKey}
                            </span>
                            <input
                              type="text"
                              value={transVal}
                              onChange={(e) => updateTagTranslation(langKey, e.target.value)}
                              className="bg-[#1a2330] text-white border border-[#3b4f66] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#66c0f4] min-w-[200px]"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeTagTranslation(langKey)}
                            className="text-gray-500 hover:text-[#ff6b6b] p-1 rounded hover:bg-[#261215] transition cursor-pointer"
                            title={t('rules.deleteTranslation')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-500 text-xs">
                {t('rules.selectTag')}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#121820] border-t border-[#233547] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs">
            {saveSuccess && (
              <span className="text-[#a4d053] flex items-center gap-1 font-semibold animate-in fade-in">
                <Check className="w-4 h-4" />
                {t('rules.allSaved')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-semibold bg-[#202e3d] hover:bg-[#2b3e52] text-gray-300 hover:text-white transition cursor-pointer"
            >
              {t('rules.close')}
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-[#6035a6] hover:bg-[#7241c4] text-white border border-[#8651e6] shadow-lg shadow-purple-950/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('rules.saving')}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('rules.saveAll')}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
