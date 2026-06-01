const controlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const unsafeUrl = /^(javascript|data|vbscript):/i;

export const safeText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).replace(controlChars, '').trim() || fallback;
};

export const safeUrl = (value, fallback = '#') => {
  const normalized = safeText(value);
  if (!normalized || unsafeUrl.test(normalized)) return fallback;
  try {
    const url = new URL(normalized, window.location.href);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return fallback;
    return url.href;
  } catch {
    return fallback;
  }
};

export const compactForReceipt = (value) => {
  const text = safeText(value);
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
};

