import React, { useMemo, useState } from 'react';
import {
  X,
  ClipboardList,
  PowerOff,
  Power,
  Trash2,
  CheckCircle2,
  HardDrive,
  AlertCircle,
  Loader2,
  Check,
  RotateCcw
} from 'lucide-react';

export function ActionPlanModal({
  isOpen,
  onClose,
  onClearPlan,
  onExecutePlan,
  isExecuting = false,
  pendingActions = {},
  items = [],
  onRemoveFromPlan,
  steamMode = 'hybrid',
  steamStatus = null
}) {
  const [filterAction, setFilterAction] = useState('all'); // 'all' | 'disable' | 'enable' | 'unsubscribe' | 'subscribe'

  const itemsMap = useMemo(() => {
    const map = new Map();
    items.forEach(it => map.set(it.published_file_id, it));
    return map;
  }, [items]);

  const planList = useMemo(() => {
    return Object.entries(pendingActions).map(([id, action]) => {
      const item = itemsMap.get(id) || { published_file_id: id, title: `Мод #${id}`, local_size_bytes: 0 };
      return {
        id,
        action,
        item
      };
    });
  }, [pendingActions, itemsMap]);

  const stats = useMemo(() => {
    let toDisable = 0;
    let toEnable = 0;
    let toUnsubscribe = 0;
    let toSubscribe = 0;
    let reclaimableBytes = 0;

    planList.forEach(({ action, item }) => {
      const size = item.local_size_bytes || item.api_file_size || 0;
      if (action === 'disable') {
        toDisable++;
        reclaimableBytes += size;
      } else if (action === 'enable') {
        toEnable++;
      } else if (action === 'unsubscribe') {
        toUnsubscribe++;
        reclaimableBytes += size;
      } else if (action === 'subscribe') {
        toSubscribe++;
      }
    });

    return {
      total: planList.length,
      toDisable,
      toEnable,
      toUnsubscribe,
      toSubscribe,
      reclaimableMb: (reclaimableBytes / (1024 * 1024)).toFixed(2)
    };
  }, [planList]);

  const filteredPlanList = useMemo(() => {
    if (filterAction === 'all') return planList;
    return planList.filter(p => p.action === filterAction);
  }, [planList, filterAction]);

  if (!isOpen) return null;

  const isModeAActive = steamMode === 'mode_a' || (steamMode === 'hybrid' && steamStatus?.cef_debugging);

  const getActionBadge = (action) => {
    switch (action) {
      case 'disable':
        return (
          <span className="flex items-center gap-1 text-[#f49e42] bg-[#241a10] border border-[#4d3215] px-2 py-0.5 rounded text-[11px] font-semibold">
            <PowerOff className="w-3 h-3" />
            Вимкнути
          </span>
        );
      case 'enable':
        return (
          <span className="flex items-center gap-1 text-[#a4d053] bg-[#142618] border border-[#264d2e] px-2 py-0.5 rounded text-[11px] font-semibold">
            <Power className="w-3 h-3" />
            Увімкнути
          </span>
        );
      case 'unsubscribe':
        return (
          <span className="flex items-center gap-1 text-[#ff6b6b] bg-[#261215] border border-[#4d1f25] px-2 py-0.5 rounded text-[11px] font-semibold">
            <Trash2 className="w-3 h-3" />
            Відписатися
          </span>
        );
      case 'subscribe':
        return (
          <span className="flex items-center gap-1 text-[#66c0f4] bg-[#112233] border border-[#234566] px-2 py-0.5 rounded text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            Підписатися
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#171d25] border border-[#2d4358] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#c7d5e0]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#233547] flex items-center justify-between bg-[#121820]">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-[#66c0f4]" />
            <h2 className="text-base font-bold text-white">
              План дій з модами ({stats.total})
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white p-1 rounded transition disabled:opacity-50 cursor-pointer"
            title="Повернутися в головне меню"
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
                Режим А (SteamClient RPC API) — пряме виконання в клієнті
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-[#e5a93c] bg-[#2d2215] px-2 py-0.5 rounded border border-[#543e1d]">
                <AlertCircle className="w-3.5 h-3.5" />
                Режим Б (Файловий VDF & Очищення диску)
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#788e9e]">
            {isModeAActive ? 'Чекбокси та підписки зміняться в Steam' : 'Видалення файлів на диску + зміна subscriptions.vdf'}
          </span>
        </div>

        {/* Metrics Summary */}
        <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 border-b border-[#233547] bg-[#141b24]">
          <div className="bg-[#192330] p-3 rounded border border-[#26374a]">
            <span className="text-[11px] text-[#8f98a0] block">Всього в плані</span>
            <div className="text-lg font-bold text-white mt-0.5">
              {stats.total} <span className="text-xs font-normal text-gray-400">модів</span>
            </div>
          </div>

          <div className="bg-[#192330] p-3 rounded border border-[#26374a]">
            <span className="text-[11px] text-[#8f98a0] block">Звільниться на SSD</span>
            <div className="text-lg font-bold text-[#a4d053] mt-0.5 flex items-center gap-1 font-mono">
              <HardDrive className="w-3.5 h-3.5" />
              <span>{stats.reclaimableMb} MB</span>
            </div>
          </div>

          <div className="bg-[#192330] p-3 rounded border border-[#26374a] col-span-2 sm:col-span-2 flex items-center justify-around gap-2 text-xs">
            <div className="text-center">
              <span className="text-[10px] text-gray-400 block">Вимкнути</span>
              <span className="font-bold text-[#f49e42] font-mono text-sm">{stats.toDisable}</span>
            </div>
            <div className="w-px h-6 bg-[#26374a]" />
            <div className="text-center">
              <span className="text-[10px] text-gray-400 block">Увімкнути</span>
              <span className="font-bold text-[#a4d053] font-mono text-sm">{stats.toEnable}</span>
            </div>
            <div className="w-px h-6 bg-[#26374a]" />
            <div className="text-center">
              <span className="text-[10px] text-gray-400 block">Відписатися</span>
              <span className="font-bold text-[#ff6b6b] font-mono text-sm">{stats.toUnsubscribe}</span>
            </div>
            <div className="w-px h-6 bg-[#26374a]" />
            <div className="text-center">
              <span className="text-[10px] text-gray-400 block">Підписатися</span>
              <span className="font-bold text-[#66c0f4] font-mono text-sm">{stats.toSubscribe}</span>
            </div>
          </div>
        </div>

        {/* Action Filter Pills */}
        <div className="px-6 py-2 bg-[#121922] border-b border-[#233547] flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-[11px] text-gray-400 mr-1 shrink-0">Фільтр:</span>
          <button
            type="button"
            onClick={() => setFilterAction('all')}
            className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
              filterAction === 'all'
                ? 'bg-[#2a475e] text-white font-medium'
                : 'bg-[#182330] text-gray-400 hover:text-white'
            }`}
          >
            Всі ({stats.total})
          </button>
          {stats.toDisable > 0 && (
            <button
              type="button"
              onClick={() => setFilterAction('disable')}
              className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 ${
                filterAction === 'disable'
                  ? 'bg-[#f49e42] text-black font-semibold'
                  : 'bg-[#241a10] text-[#f49e42] hover:bg-[#332415]'
              }`}
            >
              <PowerOff className="w-3 h-3" />
              Вимкнення ({stats.toDisable})
            </button>
          )}
          {stats.toEnable > 0 && (
            <button
              type="button"
              onClick={() => setFilterAction('enable')}
              className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 ${
                filterAction === 'enable'
                  ? 'bg-[#a4d053] text-black font-semibold'
                  : 'bg-[#142618] text-[#a4d053] hover:bg-[#1f3b25]'
              }`}
            >
              <Power className="w-3 h-3" />
              Увімкнення ({stats.toEnable})
            </button>
          )}
          {stats.toUnsubscribe > 0 && (
            <button
              type="button"
              onClick={() => setFilterAction('unsubscribe')}
              className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 ${
                filterAction === 'unsubscribe'
                  ? 'bg-[#ff6b6b] text-black font-semibold'
                  : 'bg-[#261215] text-[#ff6b6b] hover:bg-[#3b191e]'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              Відписка ({stats.toUnsubscribe})
            </button>
          )}
          {stats.toSubscribe > 0 && (
            <button
              type="button"
              onClick={() => setFilterAction('subscribe')}
              className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 ${
                filterAction === 'subscribe'
                  ? 'bg-[#66c0f4] text-black font-semibold'
                  : 'bg-[#112233] text-[#66c0f4] hover:bg-[#1a334d]'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Підписка ({stats.toSubscribe})
            </button>
          )}
        </div>

        {/* Items List Content */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto max-h-[360px]">
          {filteredPlanList.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              У цьому фільтрі немає елементів
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredPlanList.map(({ id, action, item }) => {
                const sizeBytes = item.local_size_bytes || item.api_file_size || 0;
                const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);

                return (
                  <div
                    key={id}
                    className="bg-[#192330] p-2.5 rounded border border-[#233547] hover:border-[#2f465e] flex items-center justify-between gap-3 text-xs transition group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {getActionBadge(action)}
                      <span className="font-mono text-gray-500 text-[11px] shrink-0">#{id}</span>
                      <span className="text-white font-medium truncate" title={item.title}>
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-gray-400 font-mono text-[11px]">
                        {sizeMb} MB
                      </span>
                      {onRemoveFromPlan && (
                        <button
                          type="button"
                          onClick={() => onRemoveFromPlan(id)}
                          disabled={isExecuting}
                          className="text-gray-500 hover:text-[#ff6b6b] p-1 rounded transition hover:bg-[#261215] cursor-pointer"
                          title="Видалити цю дію з плану"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#121820] border-t border-[#233547] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isExecuting}
              className="px-4 py-2 rounded text-xs font-semibold bg-[#202e3d] hover:bg-[#2b3e52] text-gray-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
              title="Повернутися в головне меню (план збережеться)"
            >
              Повернутися
            </button>

            {onClearPlan && (
              <button
                onClick={onClearPlan}
                disabled={isExecuting || stats.total === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium text-gray-400 hover:text-[#ff6b6b] hover:bg-[#261215] transition disabled:opacity-50 cursor-pointer"
                title="Очистити весь план і закрити вікно"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Очистити план</span>
              </button>
            )}
          </div>

          <button
            onClick={onExecutePlan}
            disabled={isExecuting || stats.total === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-[#1e5a2e] hover:bg-[#27753c] active:bg-[#174624] text-white border border-[#3b8c4c] shadow-lg shadow-green-950/40 transition duration-150 disabled:opacity-50 cursor-pointer"
            title="Підтвердити та виконати план"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#a4d053]" />
                <span>Виконується...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-[#a4d053]" />
                <span>Підтвердити та виконати ({stats.total})</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
