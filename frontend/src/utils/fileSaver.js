/**
 * Prompts user where to save a file, supporting:
 * 1. Desktop PyWebView native save dialog (if running inside desktop app)
 * 2. Modern Browser File System Access API (showSaveFilePicker)
 * 3. Backend native OS dialog (Zenity/Kdialog on Linux)
 * 4. Fallback: browser anchor download
 */
export async function saveFileWithPrompt(filename, content, mimeType = 'application/json') {
  // 1. PyWebView desktop app native dialog
  if (window.pywebview?.api?.save_file_dialog) {
    try {
      const res = await window.pywebview.api.save_file_dialog(filename, content);
      if (res?.status === 'ok') return { success: true, path: res.path };
      if (res?.status === 'cancelled') return { success: false, cancelled: true };
    } catch (e) {
      console.warn('PyWebView save dialog error:', e);
    }
  }

  // 2. Modern browser showSaveFilePicker (Chrome, Brave, Edge, Chromium)
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Stormworks Tag Pack (*.swtags.json)',
          accept: { [mimeType]: ['.swtags.json', '.json'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return { success: true };
    } catch (err) {
      if (err.name === 'AbortError') {
        // User explicitly cancelled the save dialog
        return { success: false, cancelled: true };
      }
      console.warn('showSaveFilePicker error, falling back:', err);
    }
  }

  // 3. Backend native OS file selection (Zenity/Kdialog on Linux)
  try {
    const res = await fetch('/api/data/save-file-dialog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggested_filename: filename, content: content })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok') {
        return { success: true, path: data.path };
      }
      if (data.status === 'cancelled') {
        return { success: false, cancelled: true };
      }
    }
  } catch (e) {
    console.warn('Backend save-file-dialog error:', e);
  }

  // 4. Fallback: browser anchor download
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { success: true };
}
