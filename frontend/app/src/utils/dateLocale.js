import i18n from '../i18n';

const INTL_LOCALE_MAP = {
  en: 'en-US',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  kn: 'kn-IN',
};

export function getActiveLangCode(langOverride) {
  const raw = langOverride || i18n.resolvedLanguage || i18n.language || 'en';
  return String(raw).split('-')[0].toLowerCase();
}

export function getIntlLocale(langOverride) {
  const code = getActiveLangCode(langOverride);
  return INTL_LOCALE_MAP[code] || 'en-US';
}

export function formatLocalizedDate(value, options = {}, langOverride) {
  if (typeof options === 'string') {
    langOverride = options;
    options = {};
  }
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const locale = getIntlLocale(langOverride);
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      ...options,
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export function formatLocalizedDateTime(value, langOverride) {
  const code = getActiveLangCode(langOverride);
  return formatLocalizedDate(
    value,
    {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...(code !== 'en' ? { hour12: false } : {}),
    },
    langOverride
  );
}

export function formatLocalizedTime(value, langOverride) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const locale = getIntlLocale(langOverride);
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

export function formatLocalizedRelativeTime(value, fallback = '', langOverride) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const locale = getIntlLocale(langOverride);

  try {
    if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      if (absSeconds < 60) return rtf.format(diffSeconds, 'second');
      const diffMinutes = Math.round(diffSeconds / 60);
      if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
      const diffHours = Math.round(diffMinutes / 60);
      if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
      const diffDays = Math.round(diffHours / 24);
      if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day');
      const diffMonths = Math.round(diffDays / 30);
      if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month');
      const diffYears = Math.round(diffDays / 365);
      return rtf.format(diffYears, 'year');
    }
  } catch {
    // Fallback below if Intl.RelativeTimeFormat is unavailable
  }

  return formatLocalizedDate(date, {}, langOverride) || fallback;
}
