/**
 * Universal clipboard utility supporting PyWebView Qt desktop and web browser.
 */

export async function copyToClipboard(text) {
  const str = String(text ?? '');
  let success = false;

  // 1. Native desktop PyWebView Qt clipboard
  if (window.pywebview?.api?.copy_to_clipboard) {
    try {
      const res = await window.pywebview.api.copy_to_clipboard(str);
      if (res?.status === 'ok') {
        success = true;
      }
    } catch (e) {
      // Fall through
    }
  }

  // 2. Browser navigator.clipboard
  if (!success && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(str);
      success = true;
    } catch (e) {
      // Fall through
    }
  }

  // 3. Fallback execCommand('copy')
  if (!success) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = str;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      success = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (e) {
      // Fall through
    }
  }

  return success;
}

export async function readClipboardText() {
  // 1. Native desktop PyWebView Qt clipboard
  if (window.pywebview?.api?.get_clipboard_text) {
    try {
      const res = await window.pywebview.api.get_clipboard_text();
      if (res?.status === 'ok') {
        return res.text ?? '';
      }
    } catch (e) {
      // Fall through
    }
  }

  // 2. Browser navigator.clipboard
  if (navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      return text ?? '';
    } catch (e) {
      // Fall through
    }
  }

  return '';
}
