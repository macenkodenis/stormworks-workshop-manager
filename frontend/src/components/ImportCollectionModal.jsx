import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  DownloadCloud,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
  FolderPlus
} from 'lucide-react';
import { ContextMenu } from './ContextMenu';
import { useInputContextMenu } from '../hooks/useInputContextMenu';
import { useI18n } from '../i18n/I18nContext';

export function ImportCollectionModal({
  isOpen,
  onClose,
  onSuccess
}) {
  const { t } = useI18n();
  const [inputUrl, setInputUrl] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [customName, setCustomName] = useState('');
  const [autoSubscribe, setAutoSubscribe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const urlInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const { contextMenu, handleInputContextMenu, closeContextMenu } = useInputContextMenu();

  useEffect(() => {
    if (!isOpen) {
      setInputUrl('');
      setPreviewData(null);
      setCustomName('');
      setAutoSubscribe(false);
      setErrorMsg('');
      setIsLoadingPreview(false);
      setIsImporting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFetchPreview = async (e) => {
    e?.preventDefault();
    const val = inputUrl.trim();
    if (!val) {
      setErrorMsg(t('importCol.errEmptyUrl'));
      return;
    }

    setIsLoadingPreview(true);
    setErrorMsg('');
    setPreviewData(null);

    try {
      const resp = await fetch('/api/collections/steam-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_id: val })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || t('importCol.errFetchFailed'));
      }
      setPreviewData(data);
      setCustomName(data.title || '');
    } catch (err) {
      setErrorMsg(err.message || t('importCol.errLoadData'));
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!previewData) return;
    setIsImporting(true);
    setErrorMsg('');

    try {
      const resp = await fetch('/api/collections/import-steam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_id: previewData.steam_collection_id,
          auto_subscribe: autoSubscribe,
          name: customName.trim() || previewData.title
        })
      });
      const result = await resp.json();
      if (!resp.ok) {
        throw new Error(result.detail || t('importCol.errImportFailed'));
      }

      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || t('importCol.errImport'));
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div className="bg-[#171d25] border border-[#22303e] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#22303e] bg-[#121922]">
          <div className="flex items-center gap-2">
            <DownloadCloud className="w-5 h-5 text-[#66c0f4]" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              {t('importCol.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded transition cursor-pointer"
            title={t('importCol.closeEsc')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          
          {/* Input Form */}
          <form onSubmit={handleFetchPreview} className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-gray-300">
              {t('importCol.inputLabel')}
            </label>
            <div className="flex gap-2">
              <input
                ref={urlInputRef}
                type="text"
                autoFocus
                placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=3796823572"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                onContextMenu={(e) =>
                  handleInputContextMenu(e, urlInputRef, (val) => {
                    setInputUrl(val);
                    if (errorMsg) setErrorMsg('');
                  })
                }
                className="flex-1 bg-[#101822] border border-[#2a3c4f] focus:border-[#66c0f4] rounded px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition shadow-inner font-mono"
              />
              <button
                type="submit"
                disabled={isLoadingPreview || !inputUrl.trim()}
                className={`px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1.5 transition ${
                  isLoadingPreview || !inputUrl.trim()
                    ? 'bg-[#1e2a38] text-gray-500 cursor-not-allowed border border-[#233344]'
                    : 'bg-[#2a475e] hover:bg-[#385e80] text-white cursor-pointer border border-[#385e80]'
                }`}
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#66c0f4]" />
                    <span>{t('importCol.searching')}</span>
                  </>
                ) : (
                  <span>{t('importCol.getData')}</span>
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              {t('importCol.hint')}
            </p>
          </form>

          {/* Error message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded bg-[#2b1417] border border-[#662028] text-[#ff8080] text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Collection Preview Card */}
          {previewData && (
            <div className="bg-[#121922] border border-[#2a3c4f] rounded-lg p-3 space-y-3">
              <div className="flex gap-3">
                {previewData.preview_url ? (
                  <img
                    src={previewData.preview_url}
                    alt={previewData.title}
                    className="w-24 h-24 object-cover rounded border border-[#22303e] shrink-0 bg-[#0e141b]"
                  />
                ) : (
                  <div className="w-24 h-24 rounded border border-[#22303e] bg-[#0e141b] flex items-center justify-center shrink-0 text-gray-600">
                    <FolderPlus className="w-8 h-8" />
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="text-sm font-bold text-white leading-tight" title={previewData.title}>
                      {previewData.title}
                    </h3>
                    <a
                      href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${previewData.steam_collection_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#66c0f4] hover:underline p-0.5 shrink-0"
                      title={t('importCol.openSteam')}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {previewData.description && (
                    <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                      {previewData.description}
                    </p>
                  )}

                  {/* Stats Grid */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10.5px]">
                    <span className="px-2 py-0.5 rounded bg-[#1b2633] text-gray-300 border border-[#243447]">
                      {t('importCol.totalInCol')} <strong className="text-white">{previewData.total_items}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#15291b] text-[#a4d053] border border-[#24472d]">
                      {t('importCol.alreadyInstalled')} <strong>{previewData.installed_count}</strong>
                    </span>
                    {previewData.missing_count > 0 && (
                      <span className="px-2 py-0.5 rounded bg-[#2b1f14] text-[#f49e42] border border-[#4d3624]">
                        {t('importCol.missing')} <strong>{previewData.missing_count}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Rename input */}
              <div className="space-y-1 pt-2 border-t border-[#1e2a38]">
                <label className="block text-[11px] font-semibold text-gray-300">
                  {t('importCol.colNameInManager')}
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onContextMenu={(e) =>
                    handleInputContextMenu(e, nameInputRef, (val) => setCustomName(val))
                  }
                  className="w-full bg-[#101822] border border-[#2a3c4f] focus:border-[#66c0f4] rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Checkbox: Auto-subscribe */}
              <div className="pt-2 border-t border-[#1e2a38] space-y-1">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSubscribe}
                    onChange={(e) => setAutoSubscribe(e.target.checked)}
                    className="mt-0.5 rounded accent-[#66c0f4] cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-white block">
                      {t('importCol.autoSubscribe', { count: previewData.missing_count })}
                    </span>
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      {t('importCol.autoSubscribeHint')}
                    </span>
                  </div>
                </label>
              </div>

              {/* Items Preview List with Grayscale/Color Reactive Toggling */}
              {Array.isArray(previewData.items_details) && previewData.items_details.length > 0 && (
                <div className="pt-2 border-t border-[#1e2a38] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300">
                    <span>{t('importCol.structureTitle', { count: previewData.items_details.length })}</span>
                    <span className="text-[10px] text-gray-500 font-normal">
                      {autoSubscribe ? t('importCol.colorizedHint') : t('importCol.grayscaleHint')}
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-[#1c2734] rounded-md p-1.5 bg-[#0b1016]">
                    {previewData.items_details.map((it) => {
                      const isGrayed = !it.is_installed && !autoSubscribe;

                      return (
                        <div
                          key={it.published_file_id}
                          className={`flex items-center gap-2.5 p-1 pr-2.5 rounded-lg border transition-all duration-200 ${
                            isGrayed
                              ? 'bg-[#12161c] border-[#1d232c] grayscale opacity-60'
                              : 'bg-[#151e29] border-[#223345] grayscale-0 opacity-100 hover:border-[#354f6b]'
                          }`}
                        >
                          {/* Thumbnail */}
                          {it.preview_url ? (
                            <img
                              src={it.preview_url}
                              alt=""
                              className="w-16 h-12 object-cover rounded-md border border-[#243446] shrink-0 bg-[#0d131a]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-16 h-12 rounded-md border border-[#243446] bg-[#0d131a] flex items-center justify-center shrink-0 text-gray-600">
                              <FolderPlus className="w-5 h-5" />
                            </div>
                          )}

                          {/* Title & Published ID */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[11.5px] font-medium text-white truncate leading-tight" title={it.title}>
                              {it.title}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 mt-0.5">
                              <span>ID: {it.published_file_id}</span>
                              <a
                                href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${it.published_file_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#66c0f4] hover:underline inline-flex items-center gap-0.5"
                                title={t('importCol.openModInSteam')}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>Steam</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {it.is_installed ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#14291a] text-[#a4d053] border border-[#22472a]">
                                {t('importCol.statusInstalled')}
                              </span>
                            ) : autoSubscribe ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#13283a] text-[#66c0f4] border border-[#1e415f]">
                                {t('importCol.statusWillSubscribe')}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1e2229] text-gray-400 border border-[#2c323c]">
                                {t('importCol.statusNotSubscribed')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#22303e] bg-[#121922]">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-3 py-1.5 rounded text-xs font-medium text-gray-400 hover:text-white bg-[#19222c] hover:bg-[#202d3b] transition cursor-pointer border border-[#243342]"
          >
            {t('importCol.cancel')}
          </button>
          
          <button
            type="button"
            onClick={handleImportSubmit}
            disabled={!previewData || isImporting}
            className={`px-4 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 ${
              !previewData || isImporting
                ? 'bg-[#1a2530] text-gray-500 cursor-not-allowed border border-[#233342]'
                : 'bg-[#1b4e2b] hover:bg-[#236337] active:bg-[#153e22] text-white cursor-pointer border border-[#2d7d45] shadow-md'
            }`}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>{t('importCol.importing')}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#a4d053]" />
                <span>{t('importCol.importBtn')}</span>
              </>
            )}
          </button>
        </div>

      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
