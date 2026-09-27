import React, { useState, useEffect } from 'react';
import { X, Sliders, Moon, Globe, RotateCcw, MousePointerClick, RefreshCw, CheckCircle2, AlertCircle, Languages, Palette, FolderOpen, Check } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import { SUPPORTED_LANGUAGES } from '../i18n/languages';
import { UI_TRANSLATIONS } from '../i18n/translations';

export function SettingsModal({
  isOpen,
  onClose,
  showControlHints = true,
  onToggleShowControlHints,
  steamStatus = null,
  steamMode = 'hybrid',
  onSetSteamMode,
  onRestartSteam,
  isRestartingSteam = false,
  onZoomChange,
  onFullSync,
  onQuickSync,
  isScanning = false,
  onOpenClassifierRules,
  stormworksSavePath = '',
  onSaveStormworksSavePath,
  ingameFoldersStatus = null,
  foldersMode = 'single',
  onSetFoldersMode
}) {
  const { lang, setLang, translateTags, setTranslateTags, t } = useI18n();
  const { theme, setTheme, isHighContrast, toggleHighContrast, themes } = useTheme();

  // Pending language switch state for confirmation dialog
  const [pendingSyncLang, setPendingSyncLang] = useState(null);

  // Stormworks save.xml path configuration
  const [customSavePathInput, setCustomSavePathInput] = useState(stormworksSavePath || '');
  const [savePathValidation, setSavePathValidation] = useState(null);
  const [isValidatingPath, setIsValidatingPath] = useState(false);

  useEffect(() => {
    setCustomSavePathInput(stormworksSavePath || '');
    setSavePathValidation(null);
  }, [stormworksSavePath, isOpen]);

  const handleValidateAndSavePath = async () => {
    const candidate = customSavePathInput.trim();
    if (!candidate) {
      handleResetPathToAuto();
      return;
    }
    setIsValidatingPath(true);
    try {
      const res = await fetch('/api/ingame-folders/validate-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: candidate })
      });
      const data = await res.json();
      setSavePathValidation(data);
      if (data.valid && onSaveStormworksSavePath) {
        onSaveStormworksSavePath(candidate);
      }
    } catch (err) {
      setSavePathValidation({ valid: false, error: err.message });
    } finally {
      setIsValidatingPath(false);
    }
  };

  const handleResetPathToAuto = () => {
    setCustomSavePathInput('');
    setSavePathValidation(null);
    if (onSaveStormworksSavePath) {
      onSaveStormworksSavePath('');
    }
  };

  // Zoom state: 75% to 125%, default 100%
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem('sw_ui_zoom');
    return saved ? Number(saved) : 100;
  });

  useEffect(() => {
    // Apply zoom to document.documentElement
    document.documentElement.style.zoom = `${zoom}%`;
    localStorage.setItem('sw_ui_zoom', String(zoom));
    if (onZoomChange) onZoomChange(zoom);
  }, [zoom]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (pendingSyncLang) {
          setPendingSyncLang(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, pendingSyncLang]);

  const handleLanguageChange = (newLang) => {
    if (newLang === lang) return;
    setLang(newLang);
    // Show confirmation modal to optionally resync mod descriptions in the new language
    setPendingSyncLang(newLang);
  };

  const handleConfirmSync = () => {
    const targetLang = pendingSyncLang || lang;
    setPendingSyncLang(null);
    if (onQuickSync) {
      onQuickSync(targetLang);
    } else if (onFullSync) {
      onFullSync(targetLang);
    }
  };

  const handleDismissSync = () => {
    setPendingSyncLang(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-[#1b2838] border border-[#2a475e] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#c7d5e0] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Pinned */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#171d25] border-b border-[#2a475e] shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#66c0f4]" />
            <h2 className="text-sm sm:text-base font-semibold text-white">{t('settings.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#2a475e] transition cursor-pointer"
            title="Esc"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-3.5 sm:p-4 flex-1 overflow-y-auto min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
            
            {/* Left Column: Interface & Localization */}
            <div className="space-y-3.5 flex flex-col">
              
              {/* Card 1: Interface & Appearance */}
              <div className="bg-[#121923] border border-[#233547] rounded-xl p-3 sm:p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#1c2a38]">
                  <Sliders className="w-4 h-4 text-[#66c0f4]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    {t('settings.catInterface')}
                  </h3>
                </div>

                {/* UI Zoom */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="zoom-range" className="font-medium text-gray-200">
                      {t('settings.zoom')}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono font-semibold text-[#66c0f4] bg-[#0c1219] px-2 py-0.5 rounded border border-[#1f2d3d]">
                        {zoom}%
                      </span>
                      {zoom !== 100 && (
                        <button
                          onClick={() => setZoom(100)}
                          title={t('settings.resetZoom')}
                          className="text-gray-400 hover:text-white p-0.5 hover:bg-[#1f2d3d] rounded transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-mono">75%</span>
                    <input
                      id="zoom-range"
                      type="range"
                      min="75"
                      max="125"
                      step="5"
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#0c1219] rounded-lg appearance-none cursor-pointer accent-[#66c0f4]"
                    />
                    <span className="text-[10px] text-gray-500 font-mono">125%</span>
                  </div>

                  {/* Preset buttons */}
                  <div className="flex items-center gap-1">
                    {[75, 90, 100, 110, 125].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setZoom(preset)}
                        className={`flex-1 py-1 rounded text-[11px] font-mono font-medium transition cursor-pointer border ${
                          zoom === preset
                            ? 'bg-[#2a475e] text-[#66c0f4] border-[#66c0f4] shadow'
                            : 'bg-[#0c1219] text-gray-400 border-[#1f2d3d] hover:bg-[#16222f] hover:text-white'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                  <p className="text-[10.5px] text-gray-400 leading-tight">
                    {t('settings.zoomDesc')}
                  </p>
                </div>

                <div className="h-px bg-[#1c2a38]" />

                {/* Control Hints Overlay */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <MousePointerClick className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                      <span className="text-xs font-medium text-white">{t('settings.controlHints')}</span>
                    </div>
                    <p className="text-[10.5px] text-gray-400 leading-tight">
                      {t('settings.controlHintsDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showControlHints}
                    onClick={() => onToggleShowControlHints && onToggleShowControlHints(!showControlHints)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      showControlHints ? 'bg-[#66c0f4]' : 'bg-[#1f2d3d]'
                    }`}
                    title={showControlHints ? t('settings.controlHintsOff') : t('settings.controlHintsOn')}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        showControlHints ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="h-px bg-[#1c2a38]" />

                {/* Theme Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-200 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-[#66c0f4]" />
                      {t('settings.theme')}
                    </span>
                  </div>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full bg-[#0c1219] border border-[#1f2d3d] text-gray-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#66c0f4] cursor-pointer"
                  >
                    {themes.map(th => (
                      <option key={th.id} value={th.id}>
                        {th.nameKey ? t(th.nameKey) : (th.name || th.id)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="h-px bg-[#1c2a38]" />

                {/* High Contrast Toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Moon className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                      <span className="text-xs font-medium text-white">{t('settings.highContrast')}</span>
                    </div>
                    <p className="text-[10.5px] text-gray-400 leading-tight">
                      {t('settings.highContrastDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isHighContrast}
                    onClick={() => toggleHighContrast()}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isHighContrast ? 'bg-[#66c0f4]' : 'bg-[#1f2d3d]'
                    }`}
                    title={isHighContrast ? t('settings.highContrastOff') : t('settings.highContrastOn')}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isHighContrast ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Card 2: Language & Localization */}
              <div className="bg-[#121923] border border-[#233547] rounded-xl p-3 sm:p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#1c2a38]">
                  <Globe className="w-4 h-4 text-[#66c0f4]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    {t('settings.catLocalization')}
                  </h3>
                </div>

                {/* Language Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-200">{t('settings.language')}</span>
                    <span className="text-[10px] text-gray-400 font-mono uppercase bg-[#0c1219] px-1.5 py-0.5 rounded border border-[#1f2d3d]">
                      {lang}
                    </span>
                  </div>
                  <select
                    value={lang}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="w-full bg-[#0c1219] border border-[#1f2d3d] text-gray-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#66c0f4] cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map(sl => (
                      <option key={sl.code} value={sl.code}>
                        {sl.name} ({sl.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10.5px] text-gray-400 leading-tight">
                    {t('settings.languageDesc')}
                  </p>
                </div>

                <div className="h-px bg-[#1c2a38]" />

                {/* Translate Tags */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                      <span className="text-xs font-medium text-white">{t('settings.translateTags')}</span>
                    </div>
                    <p className="text-[10.5px] text-gray-400 leading-tight">
                      {t('settings.translateTagsDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={translateTags}
                    onClick={() => setTranslateTags(!translateTags)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      translateTags ? 'bg-[#66c0f4]' : 'bg-[#1f2d3d]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        translateTags ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

            </div>

            {/* Right Column: Steam & Data Tools */}
            <div className="space-y-3.5 flex flex-col">

              {/* Card 3: Steam Integration */}
              <div className="bg-[#121923] border border-[#233547] rounded-xl p-3 sm:p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#1c2a38]">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[#66c0f4]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      {t('settings.catSteam')}
                    </h3>
                  </div>
                  {steamStatus?.cef_debugging ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[#172e1e] text-[#a4d053] border border-[#2b5936] rounded">
                      <CheckCircle2 className="w-3 h-3" />
                      {t('settings.modeAActive')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[#2b2216] text-[#e5a93c] border border-[#523e1f] rounded">
                      <AlertCircle className="w-3 h-3" />
                      {t('settings.modeBActive')}
                    </span>
                  )}
                </div>

                <p className="text-[10.5px] text-gray-400 leading-tight">
                  {t('settings.steamDesc')}
                </p>

                {/* Mode Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-300 font-medium">{t('settings.steamMode')}</label>
                  <select
                    value={steamMode}
                    onChange={(e) => onSetSteamMode && onSetSteamMode(e.target.value)}
                    className="w-full bg-[#0c1219] border border-[#1f2d3d] text-gray-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#66c0f4] cursor-pointer"
                  >
                    <option value="hybrid">{t('settings.modeHybrid')}</option>
                    <option value="mode_a">{t('settings.modeA')}</option>
                    <option value="mode_b">{t('settings.modeB')}</option>
                  </select>
                </div>

                {/* Status & Restart Steam Button */}
                <div className="p-2.5 rounded-lg bg-[#0c1219] border border-[#1f2d3d] space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">{t('settings.steamStatus')}</span>
                    <span className="font-semibold text-white">
                      {steamStatus?.cef_debugging
                        ? t('settings.steamStatusCef')
                        : steamStatus?.is_running
                        ? t('settings.steamStatusRunning')
                        : t('settings.steamStatusClosed')}
                    </span>
                  </div>

                  {!steamStatus?.cef_debugging && (
                    <button
                      type="button"
                      disabled={isRestartingSteam}
                      onClick={onRestartSteam}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#1c2d3f] hover:bg-[#253b52] active:bg-[#162534] text-xs font-semibold text-[#66c0f4] border border-[#2b4460] transition disabled:opacity-50 disabled:cursor-not-allowed shadow cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRestartingSteam ? 'animate-spin' : ''}`} />
                      <span>
                        {isRestartingSteam
                          ? t('settings.restartingSteam')
                          : t('settings.restartSteam')}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Card 4: Data & Classifier */}
              <div className="bg-[#121923] border border-[#233547] rounded-xl p-3 sm:p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#1c2a38]">
                  <Sliders className="w-4 h-4 text-[#b388ff]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    {t('settings.catData')}
                  </h3>
                </div>

                {/* Full Sync */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-white">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-[#66c0f4]" />
                      {t('settings.fullSync')}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-gray-400 leading-tight">
                    {t('settings.fullSyncDesc')}
                  </p>
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={onFullSync}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition shadow border ${
                      isScanning
                        ? 'bg-[#15212d] border-[#1f2d3d] text-gray-500 cursor-not-allowed'
                        : 'bg-[#2a475e] hover:bg-[#3d6585] active:bg-[#1f374a] border-[#385b77] cursor-pointer'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[#66c0f4]' : ''}`} />
                    <span>{isScanning ? t('settings.fullSyncing') : t('settings.fullSyncBtn')}</span>
                  </button>
                </div>

                <div className="h-px bg-[#1c2a38]" />

                {/* Classifier Rules */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-white">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#b388ff]" />
                      {t('settings.rulesTitle')}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-gray-400 leading-tight">
                    {t('settings.rulesDesc')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenClassifierRules) onOpenClassifierRules();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#221736] hover:bg-[#332252] border border-[#523382] hover:border-[#7347b8] transition shadow cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#b388ff]" />
                    <span>{t('settings.rulesBtn')}</span>
                  </button>
                </div>
              </div>

              {/* Card 5: Stormworks save.xml Profile */}
              <div className="bg-[#121923] border border-[#233547] rounded-xl p-3 sm:p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#1c2a38]">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-[#66c0f4]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      {t('settings.stormworksSavePath')}
                    </h3>
                  </div>
                  {ingameFoldersStatus?.exists ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[#172e1e] text-[#a4d053] border border-[#2b5936] rounded">
                      <CheckCircle2 className="w-3 h-3" />
                      OK
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[#2b2216] text-[#e5a93c] border border-[#523e1f] rounded">
                      <AlertCircle className="w-3 h-3" />
                      404
                    </span>
                  )}
                </div>

                <p className="text-[10.5px] text-gray-400 leading-tight">
                  {t('settings.stormworksSavePathDesc')}
                </p>

                {/* Detected / Current Path Display */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={customSavePathInput}
                      onChange={(e) => {
                        setCustomSavePathInput(e.target.value);
                        setSavePathValidation(null);
                      }}
                      placeholder={ingameFoldersStatus?.save_path || '%APPDATA%/Stormworks/save.xml'}
                      className="flex-1 bg-[#0c1219] border border-[#1f2d3d] text-gray-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#66c0f4] font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      disabled={isValidatingPath}
                      onClick={handleValidateAndSavePath}
                      className="px-2.5 py-1.5 bg-[#1f3b26] hover:bg-[#285033] text-[#a4d053] border border-[#2d5c3a] rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
                      title={t('settings.checkPath')}
                    >
                      {isValidatingPath ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : t('settings.checkPath')}
                    </button>
                    {stormworksSavePath && (
                      <button
                        type="button"
                        onClick={handleResetPathToAuto}
                        className="px-2 py-1.5 bg-[#16222f] hover:bg-[#1f2d3d] text-gray-400 hover:text-white border border-[#233547] rounded text-xs transition cursor-pointer"
                        title={t('settings.resetPath')}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Validation Feedback */}
                  {savePathValidation && (
                    <div className={`text-[10.5px] px-1 font-medium ${savePathValidation.valid ? 'text-[#a4d053]' : 'text-[#ff6b6b]'}`}>
                      {savePathValidation.valid ? '✓ save.xml знайдено та збережено!' : `✗ ${savePathValidation.error || 'Помилка валідації'}`}
                    </div>
                  )}

                  {/* Auto-detected path footnote */}
                  {ingameFoldersStatus?.save_path && !stormworksSavePath && (
                    <div className="text-[10px] text-gray-500 font-mono truncate px-1" title={ingameFoldersStatus.save_path}>
                      Автовизначено: {ingameFoldersStatus.save_path}
                    </div>
                  )}
                </div>

                <div className="h-px bg-[#1c2a38] my-1" />

                {/* Mode Selector: Single vs Multi (Segmented Switch) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-gray-300 font-medium block">
                    {t('folders.modeTitle')}
                  </label>
                  <div className="flex bg-[#0c1219] border border-[#1f2d3d] rounded-lg p-0.5 gap-1">
                    <button
                      type="button"
                      onClick={() => onSetFoldersMode && onSetFoldersMode('single')}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition cursor-pointer text-center ${
                        foldersMode === 'single'
                          ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                          : 'text-gray-400 hover:text-white hover:bg-[#16222f]'
                      }`}
                    >
                      {t('folders.modeSingle')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetFoldersMode && onSetFoldersMode('multi')}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition cursor-pointer text-center ${
                        foldersMode === 'multi'
                          ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                          : 'text-gray-400 hover:text-white hover:bg-[#16222f]'
                      }`}
                    >
                      {t('folders.modeMulti')}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    {foldersMode === 'multi' ? t('folders.modeMultiDesc') : t('folders.modeSingleDesc')}
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Footer - Pinned */}
        <div className="px-5 py-2.5 bg-[#171d25] border-t border-[#2a475e] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-500 font-mono hidden sm:inline">Stormworks Workshop Manager</span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-[#2a475e] hover:bg-[#3d6585] active:bg-[#1f374a] text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer ml-auto"
          >
            {t('settings.done')}
          </button>
        </div>

      </div>

      {/* Confirmation Dialog for Mod Descriptions Sync in the newly selected language */}
      {pendingSyncLang && (() => {
        const targetDict = UI_TRANSLATIONS[pendingSyncLang] || UI_TRANSLATIONS.ua || {};
        const fallbackDict = UI_TRANSLATIONS.en || UI_TRANSLATIONS.ua || {};
        const getNewLangText = (k) => targetDict[k] || fallbackDict[k] || k;

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-[#16202c] border border-[#3b5979] rounded-xl shadow-2xl p-5 space-y-4 text-[#c7d5e0]">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#2a475e]/40 text-[#66c0f4] rounded-lg shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {getNewLangText('settings.syncDescriptionsPrompt')}
                  </h3>
                  <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                    {getNewLangText('settings.syncDescriptionsDesc')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#233547]">
                <button
                  type="button"
                  onClick={handleDismissSync}
                  className="px-4 py-1.5 bg-[#1b2838] hover:bg-[#26384d] text-gray-300 hover:text-white rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  {getNewLangText('settings.syncLater')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSync}
                  className="px-4 py-1.5 bg-[#66c0f4] hover:bg-[#78ccff] text-[#0d141b] rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{getNewLangText('settings.syncNow')}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
