import React, { useState } from 'react';
import { X, ShieldAlert, Copy, Check, FileText, Code2, HardDrive, ExternalLink } from 'lucide-react';

export function DryRunModal({ plan, onClose, onCopyScript, scriptText }) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'script' | 'list'
  const [copied, setCopied] = useState(false);

  if (!plan) return null;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const idList = plan.items.map(i => i.published_file_id).join('\n');

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#171d25] border border-[#2d4358] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#233547] flex items-center justify-between bg-[#121820]">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#66c0f4]" />
            <h2 className="text-base font-bold text-white">
              План масової відписки (Dry-run)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Banner */}
        <div className="bg-[#1e2a38] border-b border-[#293d52] px-6 py-2.5 text-xs text-[#8ea7be] flex items-center gap-2">
          <span className="font-semibold text-white">Режим безпеки:</span>
          <span>Жоден локальний файл не буде видалено автоматично без вашого явного вибору.</span>
        </div>

        {/* Metrics Summary */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-[#233547] bg-[#141b24]">
          <div className="bg-[#192330] p-3.5 rounded border border-[#26374a]">
            <span className="text-xs text-[#8f98a0]">Вибрано для відписки</span>
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
            <span className="text-xs text-[#8f98a0]">Статус кешу</span>
            <div className="text-sm font-semibold text-[#66c0f4] mt-1.5">
              ✓ Метадані збережено в SQLite
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#233547] px-6 bg-[#121820]">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'summary'
                ? 'border-[#66c0f4] text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Список предметів ({plan.items.length})
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'script'
                ? 'border-[#66c0f4] text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Безпечний скрипт для браузера
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 flex-1 overflow-y-auto max-h-[360px]">
          {activeTab === 'summary' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center pb-2">
                <span className="text-xs text-[#8f98a0]">Предмети, обрані для відписки:</span>
                <button
                  onClick={() => handleCopy(idList)}
                  className="text-xs text-[#66c0f4] hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Копіювати тільки список ID
                </button>
              </div>
              <div className="divide-y divide-[#202e3d] border border-[#233547] rounded-lg overflow-hidden bg-[#121922]">
                {plan.items.map((it) => (
                  <div key={it.published_file_id} className="p-2.5 flex items-center justify-between text-xs hover:bg-[#1a2532]">
                    <div className="flex items-center gap-2 truncate pr-4">
                      <span className="font-mono text-gray-400 text-[11px]">{it.published_file_id}</span>
                      <span className="text-white font-medium truncate">{it.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[#a4d053] font-mono text-[11px]">
                        {(it.size_bytes / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      <a
                        href={it.workshop_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:text-[#66c0f4]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'script' && (
            <div>
              <p className="text-xs text-[#8f98a0] mb-3">
                Цей JavaScript-код можна вставити в консоль браузера (F12) на вашій сторінці підписок Steam Community. Він знайде кнопки відписки тільки для обраних предметів і натисне їх:
              </p>
              <div className="relative">
                <pre className="bg-[#0c1219] p-4 rounded-lg text-xs font-mono text-[#a4d053] overflow-x-auto border border-[#233547]">
                  {scriptText}
                </pre>
                <button
                  onClick={() => handleCopy(scriptText)}
                  className="absolute top-2.5 right-2.5 bg-[#202e3d] hover:bg-[#2c3f54] text-white px-3 py-1.5 rounded text-xs flex items-center gap-1.5 border border-[#31485e]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопійовано!' : 'Копіювати скрипт'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#121820] border-t border-[#233547] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs font-semibold bg-[#2a475e] hover:bg-[#385c7a] text-white transition"
          >
            Закрити
          </button>
        </div>

      </div>
    </div>
  );
}
