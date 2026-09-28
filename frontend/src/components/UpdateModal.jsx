import React, { useState, useEffect, useRef } from 'react';
import { X, Download, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export function UpdateModal({ isOpen, onClose, updateData, onDone }) {
  const { t } = useI18n();
  const [status, setStatus] = useState('idle'); // idle | downloading | extracting | ready | error
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const mouseDownTargetRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && status !== 'restarting') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, status, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setProgress(0);
      return;
    }

    let interval = null;
    if (status === 'downloading' || status === 'extracting') {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/updater/progress').then(r => r.json());
          setProgress(res.progress || 0);
          setSpeed(res.speed_kbps || 0);
          if (res.status === 'ready_to_restart') {
            setStatus('ready');
          } else if (res.status === 'error') {
            setStatus('error');
            setErrorMsg(res.error || 'Download failed');
          } else if (res.status === 'extracting') {
            setStatus('extracting');
          }
        } catch (e) {
          console.error('Failed to poll update progress:', e);
        }
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, status]);

  if (!isOpen || !updateData) return null;

  const handleStartDownload = async () => {
    setStatus('downloading');
    setProgress(0);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/updater/start-download', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to start download');
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message);
    }
  };

  const handleApplyRestart = async () => {
    setStatus('restarting');
    try {
      await fetch('/api/updater/apply-and-restart', { method: 'POST' });
    } catch (e) {
      console.warn('Restart signal sent:', e);
    }
  };

  const asset = updateData.matching_asset;
  const assetSizeMb = asset?.size ? (asset.size / (1024 * 1024)).toFixed(1) : null;

  return (
    <div
      onMouseDown={(e) => {
        mouseDownTargetRef.current = e.target;
      }}
      onClick={(e) => {
        if (status !== 'restarting' && e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
    >
      <div 
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl bg-[#141b24] border border-[#233547] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100%-2rem)] my-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#202f40] bg-[#101720] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1c3e5e] border border-[#2d5885] flex items-center justify-center text-[#66c0f4]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                {t('updater.title')}
              </h2>
              <span className="text-[11px] text-[#66c0f4] font-medium">
                {t('updater.updateAvailable', { version: updateData.latest_version })}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded transition hover:bg-[#1a2533] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-gray-300">
          {/* Metadata pill */}
          <div className="flex items-center justify-between bg-[#0d131a] p-3 rounded-lg border border-[#1b2836]">
            <div>
              <span className="text-[11px] text-gray-400 block">
                {t('updater.editionDetected', { package: asset?.name || updateData.environment?.edition })}
              </span>
              {assetSizeMb && (
                <span className="text-[10px] text-gray-500 font-mono">
                  Download size: ~{assetSizeMb} MB
                </span>
              )}
            </div>
            {updateData.published_at && (
              <span className="text-[10px] text-gray-500 font-mono">
                {new Date(updateData.published_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Release Notes */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-gray-200 block">
              {t('updater.changelog')}
            </span>
            <div className="bg-[#0b1016] border border-[#1a2634] p-3.5 rounded-lg max-h-48 overflow-y-auto text-[11.5px] leading-relaxed text-gray-300 font-sans whitespace-pre-wrap select-text">
              {updateData.release_notes || 'Performance enhancements, bug fixes, and stability improvements.'}
            </div>
          </div>

          {/* Progress / Status display */}
          {status === 'downloading' && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-[11px] font-medium text-gray-300">
                <span>{t('updater.downloading', { progress })}</span>
                <span className="font-mono text-gray-400">{speed > 0 ? `${speed} KB/s` : ''}</span>
              </div>
              <div className="w-full h-2 bg-[#0c1218] rounded-full overflow-hidden border border-[#1c2c3d]">
                <div 
                  className="h-full bg-linear-to-r from-[#205282] to-[#66c0f4] transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'extracting' && (
            <div className="flex items-center gap-2 p-3 bg-[#11202e] border border-[#1b3b59] rounded-lg text-[#66c0f4] text-xs font-medium">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>{t('updater.extracting')}</span>
            </div>
          )}

          {status === 'ready' && (
            <div className="flex items-center gap-2 p-3 bg-[#132817] border border-[#275e31] rounded-lg text-[#a4d053] text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#a4d053]" />
              <span>Update is downloaded and unpacked. Click below to restart and apply.</span>
            </div>
          )}

          {status === 'restarting' && (
            <div className="flex items-center gap-2 p-3 bg-[#132817] border border-[#275e31] rounded-lg text-[#a4d053] text-xs font-medium">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>{t('updater.restarting')}</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-2 p-3 bg-[#2b1414] border border-[#5e2525] rounded-lg text-[#ff6b6b] text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('updater.failed', { error: errorMsg })}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-[#202f40] bg-[#101720] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-gray-400 hover:text-white rounded transition hover:bg-[#1a2636] cursor-pointer"
          >
            {t('updater.later')}
          </button>

          {status === 'idle' && (
            <button
              type="button"
              onClick={handleStartDownload}
              className="px-4 py-1.5 bg-[#205282] hover:bg-[#2b6ba8] active:bg-[#173e63] text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('updater.downloadBtn')}</span>
            </button>
          )}

          {status === 'ready' && (
            <button
              type="button"
              onClick={handleApplyRestart}
              className="px-4 py-1.5 bg-[#286835] hover:bg-[#328543] active:bg-[#1f532a] text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('updater.restartBtn')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
