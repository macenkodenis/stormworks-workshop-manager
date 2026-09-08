import React, { useState } from 'react';
import { X, ShieldAlert, Trash2, PowerOff, FileText, HardDrive, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function DryRunModal({
  plan,
  onClose,
  onExecuteUnsubscribe,
  onExecuteDisable,
  isExecuting = false,
  steamMode = 'hybrid',
  steamStatus = null
}) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'list'

  if (!plan) return null;

  const isModeAActive = steamMode === 'mode_a' || (steamMode === 'hybrid' && steamStatus?.cef_debugging);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#171d25] border border-[#2d4358] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#233547] flex items-center justify-between bg-[#121820]">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#66c0f4]" />
            <h2 className="text-base font-bold text-white">
              Керування виділеними модами ({plan.selected_count})
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white p-1 rounded transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode & Status Indicator Banner */}
        <div className="bg-[#1a2432] border-b border-[#24374b] px-6 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Цільовий API:</span>
            {isModeAActive ? (
              <span className="flex items-center gap-1.5 font-semibold text-[#a4d053] bg-[#14281a] px-2 py-0.5 rounded border border-[#275330]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Режим А (SteamClient RPC API) — нативне керування
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-[#e5a93c] bg-[#2d2215] px-2 py-0.5 rounded border border-[#543e1d]">
                <AlertCircle className="w-3.5 h-3.5" />
                Режим Б (Файловий VDF & Очищення диску)
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#788e9e]">
            {isModeAActive ? 'Чекбокси та підписки змінюються прямо в клієнті Steam' : 'Видалення файлів на диску + зміна subscriptions.vdf'}
          </span>
        </div>

        {/* Metrics Summary */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-[#233547] bg-[#141b24]">
          <div className="bg-[#192330] p-3.5 rounded border border-[#26374a]">
            <span className="text-xs text-[#8f98a0]">Вибрано для обробки</span>
            <div className="text-xl font-bold text-white mt-1">
              {plan.selected_count} <span className="text-xs font-normal text-gray-400">модів</span>
            </div>
          </div>

          <div className="bg-[#192330] p-3.5 rounded border border-[#26374a]">
            <span className="text-xs text-[#8f98a0]">Звільниться на диску</span>
            <div className="text-xl font-bold text-[#a4d053] mt-1 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4" />
              <span>{plan.total_reclaimable_mb} MB</span>
            </div>
          </div>

          <div className="bg-[#192330] p-3.5 rounded border border-[#26374a] col-span-2 sm:col-span-1">
            <span className="text-xs text-[#8f98a0]">Статус кешу та метаданих</span>
            <div className="text-sm font-semibold text-[#66c0f4] mt-1.5">
              ✓ Збережено в локальній базі
            </div>
          </div>
        </div>

        {/* Items List Content */}
        <div className="p-6 flex-1 overflow-y-auto max-h-[360px]">
          <div className="space-y-2">
            <div className="flex justify-between items-center pb-2">
              <span className="text-xs text-gray-400">Список виділених модів:</span>
              <span className="text-xs text-[#66c0f4] font-mono">{plan.items.length} елементів</span>
            </div>
            <div className="space-y-1.5">
              {plan.items.map(item => (
                <div
                  key={item.published_file_id}
                  className="bg-[#192330] p-2.5 rounded border border-[#233547] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-gray-500 text-[11px] shrink-0">#{item.published_file_id}</span>
                    <span className="text-white font-medium truncate" title={item.title}>{item.title}</span>
                  </div>
                  <span className="text-[#a4d053] font-mono shrink-0">
                    {(item.size_bytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer with Direct API Action Buttons */}
        <div className="px-6 py-4 bg-[#121820] border-t border-[#233547] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 rounded text-xs font-semibold bg-[#202e3d] hover:bg-[#2b3e52] text-gray-300 hover:text-white transition disabled:opacity-50"
          >
            Скасувати
          </button>

          <div className="flex items-center gap-2.5">
            {/* Option 1: Disable without unsubscribing */}
            {onExecuteDisable && (
              <button
                onClick={onExecuteDisable}
                disabled={isExecuting}
                className="flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold bg-[#243447] hover:bg-[#2f445e] active:bg-[#1c2938] text-[#8ec8f6] border border-[#3b5573] transition disabled:opacity-50 shadow"
                title="Відключити моди локально через Steam та звільнити місце, зберігаючи підписку"
              >
                {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PowerOff className="w-3.5 h-3.5" />}
                <span>Вимкнути без відписки ({plan.total_reclaimable_mb} MB)</span>
              </button>
            )}

            {/* Option 2: Full unsubscribe via API */}
            {onExecuteUnsubscribe && (
              <button
                onClick={onExecuteUnsubscribe}
                disabled={isExecuting}
                className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold bg-[#a82a2a] hover:bg-[#c03333] active:bg-[#852121] text-white shadow-lg transition duration-150 disabled:opacity-50"
                title="Повністю відписатися в Steam та видалити файли з диска"
              >
                {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Відписатися через Steam API</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
