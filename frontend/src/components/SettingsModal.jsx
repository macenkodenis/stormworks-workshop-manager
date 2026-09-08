import React, { useState, useEffect } from 'react';
import { X, Sliders, Moon, Globe, RotateCcw, MousePointerClick, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export function SettingsModal({
  isOpen,
  onClose,
  showControlHints = true,
  onToggleShowControlHints,
  steamStatus = null,
  steamMode = 'hybrid',
  onSetSteamMode,
  onRestartSteam,
  isRestartingSteam = false
}) {
  // Zoom state: 75% to 125%, default 100%
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem('sw_ui_zoom');
    return saved ? Number(saved) : 100;
  });

  // Stubs for future functionality
  const [highContrast, setHighContrast] = useState(false);
  const [language, setLanguage] = useState('uk');

  useEffect(() => {
    // Apply zoom to document.documentElement
    document.documentElement.style.zoom = `${zoom}%`;
    localStorage.setItem('sw_ui_zoom', String(zoom));
  }, [zoom]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg max-h-full bg-[#1b2838] border border-[#2a475e] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#c7d5e0] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Pinned */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#171d25] border-b border-[#2a475e] shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#66c0f4]" />
            <h2 className="text-base font-semibold text-white">Налаштування</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#2a475e] transition cursor-pointer"
            title="Закрити (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 space-y-6 flex-1 overflow-y-auto min-h-0">
          
          {/* Setting 1: UI Zoom */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="zoom-range" className="font-medium text-white flex items-center gap-2">
                Масштаб інтерфейсу
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-[#66c0f4] bg-[#101822] px-2 py-0.5 rounded border border-[#233547]">
                  {zoom}%
                </span>
                {zoom !== 100 && (
                  <button
                    onClick={() => setZoom(100)}
                    title="Скинути до 100%"
                    className="text-gray-400 hover:text-white p-1 hover:bg-[#223344] rounded transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-mono">75%</span>
              <input
                id="zoom-range"
                type="range"
                min="75"
                max="125"
                step="5"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-[#101822] rounded-lg appearance-none cursor-pointer accent-[#66c0f4]"
              />
              <span className="text-xs text-gray-400 font-mono">125%</span>
            </div>

            {/* Quick Zoom Preset Buttons */}
            <div className="flex items-center gap-1.5 pt-1">
              {[75, 90, 100, 110, 125].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setZoom(preset)}
                  className={`flex-1 py-1 rounded text-xs font-mono font-medium transition cursor-pointer border ${
                    zoom === preset
                      ? 'bg-[#2a475e] text-[#66c0f4] border-[#66c0f4] shadow'
                      : 'bg-[#101822] text-gray-400 border-[#233547] hover:bg-[#1a2636] hover:text-white'
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>

            <p className="text-[11px] text-gray-400">
              Налаштування розміру елементів додатку та тексту. Бічні панелі залишаються закріпленими по краях екрана.
            </p>
          </div>

          <div className="h-px bg-[#223242]" />

          {/* Setting 2: Control Hints Overlay Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-[#66c0f4]" />
                <span className="text-sm font-medium text-white">Підказки по керуванню</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Відображати плаваюче вікно гарячих клавіш у зоні карток модів
              </p>
            </div>

            {/* Toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={showControlHints}
              onClick={() => onToggleShowControlHints && onToggleShowControlHints(!showControlHints)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                showControlHints ? 'bg-[#66c0f4]' : 'bg-[#22303e]'
              }`}
              title={showControlHints ? 'Вимкнути підказки' : 'Увімкнути підказки'}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  showControlHints ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-[#223242]" />

          {/* Setting: Steam Integration & Execution Mode */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">Інтеграція зі Steam</span>
                  {steamStatus?.cef_debugging ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[#172e1e] text-[#a4d053] border border-[#2b5936] rounded">
                      <CheckCircle2 className="w-3 h-3" />
                      Режим А активний
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[#2b2216] text-[#e5a93c] border border-[#523e1f] rounded">
                      <AlertCircle className="w-3 h-3" />
                      Режим Б (Файловий)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Керування підписками та відключенням модів через Steam API
                </p>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="space-y-1">
              <label className="text-[11px] text-gray-300 font-medium">Режим виконання:</label>
              <select
                value={steamMode}
                onChange={(e) => onSetSteamMode && onSetSteamMode(e.target.value)}
                className="w-full bg-[#101822] border border-[#233547] text-gray-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#66c0f4]"
              >
                <option value="hybrid">Автоматичний (Гібридний) — пріоритет SteamClient RPC</option>
                <option value="mode_a">Примусово: Режим А (SteamClient RPC WebSocket)</option>
                <option value="mode_b">Примусово: Режим Б (Direct VDF & Filesystem)</option>
              </select>
            </div>

            {/* Status & Restart Steam Button */}
            <div className="p-2.5 rounded-md bg-[#101822] border border-[#233547] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400">Статус клієнта Steam:</span>
                <span className="font-semibold text-white">
                  {steamStatus?.cef_debugging
                    ? '● Підключено з відлагодженням (порт 8080)'
                    : steamStatus?.is_running
                    ? '○ Працює у звичайному режимі'
                    : '✕ Клієнт Steam не виявлено'}
                </span>
              </div>

              {!steamStatus?.cef_debugging && (
                <button
                  type="button"
                  disabled={isRestartingSteam}
                  onClick={onRestartSteam}
                  className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[#203245] hover:bg-[#2c4560] active:bg-[#182635] text-xs font-semibold text-[#66c0f4] border border-[#314b66] transition disabled:opacity-50 disabled:cursor-not-allowed shadow"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRestartingSteam ? 'animate-spin' : ''}`} />
                  <span>
                    {isRestartingSteam
                      ? 'Перезапуск Steam з прапорцем...'
                      : 'Перезапустити Steam з прапорцем відлагодження'}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-[#223242]" />

          {/* Setting 2: High Contrast (Stub) */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-white">Висока контрастність</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.2 bg-[#2a475e] text-[#66c0f4] rounded">
                  Скоро
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Підвищена чіткість меж, рамок та акцентів інтерфейсу
              </p>
            </div>

            {/* Toggle switch (Stub) */}
            <button
              type="button"
              disabled
              onClick={() => setHighContrast(!highContrast)}
              className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-[#22303e] opacity-60 transition-colors duration-200 ease-in-out focus:outline-none"
              title="Функція в розробці"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-gray-400 shadow-lg ring-0 transition duration-200 ease-in-out ${
                  highContrast ? 'translate-x-4 bg-[#66c0f4]' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-[#223242]" />

          {/* Setting 3: Language Selector (Stub) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-white">Мова інтерфейсу</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.2 bg-[#2a475e] text-[#66c0f4] rounded">
                  Скоро
                </span>
              </div>
            </div>

            <select
              value={language}
              disabled
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-[#101822] border border-[#233547] text-gray-300 rounded px-3 py-1.5 text-xs focus:outline-none opacity-60 cursor-not-allowed"
              title="Функція в розробці"
            >
              <option value="uk">Українська</option>
              <option value="en">English</option>
            </select>
            <p className="text-[11px] text-gray-400">
              Локалізація та переклад пунктів керування
            </p>
          </div>

        </div>

        {/* Footer - Pinned */}
        <div className="px-5 py-3 bg-[#171d25] border-t border-[#2a475e] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-500 font-mono hidden sm:inline">Stormworks Workshop Manager</span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-[#2a475e] hover:bg-[#3d6585] active:bg-[#1f374a] text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer ml-auto"
          >
            Готово
          </button>
        </div>

      </div>
    </div>
  );
}
