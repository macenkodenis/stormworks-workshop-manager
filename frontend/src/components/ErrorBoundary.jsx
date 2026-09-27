import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { I18nContext } from '../i18n/I18nContext';

export class ErrorBoundary extends React.Component {
  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

const FALLBACK_STRINGS = {
  'error.displayError': 'Помилка відображення',
  'error.unexpectedModalError': 'Виникла неочікувана помилка під час відкриття вікна. Робота інтерфейсу не порушена.',
  'error.close': 'Закрити'
};

      const t = (k) => {
        if (this.context?.t) {
          const res = this.context.t(k);
          if (res !== k) return res;
        }
        return FALLBACK_STRINGS[k] || k;
      };

      return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#121822] border border-[#ff4444]/40 rounded-xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#ff5555]">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-sm">{t('error.displayError')}</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              {t('error.unexpectedModalError')}
            </p>
            {this.state.error && (
              <pre className="bg-[#0b0f14] p-3 rounded text-[11px] text-gray-400 font-mono overflow-x-auto max-h-32 border border-[#1b2531]">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-[#2a475e] hover:bg-[#385c7a] text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('error.close')}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
