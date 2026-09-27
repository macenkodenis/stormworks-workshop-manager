/**
 * Formats a byte size into a human-readable string (B, KB, MB, GB).
 *
 * @param {number|null|undefined} bytes
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  const formattedVal = decimals > 0 ? parseFloat(val.toFixed(decimals)) : Math.round(val);
  return `${formattedVal} ${sizes[i]}`;
}

/**
 * Formats a Unix timestamp (seconds) into DD.MM.YY.
 *
 * @param {number|null|undefined} unixTs
 * @returns {string}
 */
export function formatDate(unixTs, includeTime = false) {
  if (!unixTs) return '';
  const d = new Date(unixTs * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  if (includeTime) {
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${min} ${dd}.${mm}.${year}`;
  }
  return `${dd}.${mm}.${year}`;
}
