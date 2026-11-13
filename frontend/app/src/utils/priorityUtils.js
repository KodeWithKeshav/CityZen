export function normalizePriorityScore(raw) {
  if (raw === null || raw === undefined || typeof raw === 'boolean') return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;

  if (num > 0 && num <= 1.0) return Math.round(num * 100);
  if (num > 1.0 && num <= 10.0) return Math.round(num * 10);
  return Math.min(100, Math.max(0, Math.round(num)));
}

export function getRawPriority(complaint) {
  if (!complaint || typeof complaint !== 'object') return null;
  const candidates = [complaint.priorityScore, complaint.priority_score, complaint.priority];
  for (const val of candidates) {
    if (normalizePriorityScore(val) !== null) return val;
  }
  return null;
}

export function getPriorityTier(scoreOrComplaint, t) {
  const raw =
    typeof scoreOrComplaint === 'object' && scoreOrComplaint !== null
      ? getRawPriority(scoreOrComplaint)
      : scoreOrComplaint;

  const score = normalizePriorityScore(raw);
  const tr = (key, fallback) => (typeof t === 'function' ? t(key, fallback) : fallback);

  if (score === null) {
    return {
      level: 'STANDARD',
      score: null,
      labelKey: 'common:priority.na',
      label: tr('common:priority.na', 'N/A'),
      displayScore: '—',
      color: '#4B5563',
      bgColor: '#F3F4F6',
      borderColor: '#D1D5DB',
    };
  }

  if (score >= 80) {
    return {
      level: 'CRITICAL',
      score,
      labelKey: 'common:priority.critical',
      label: tr('common:priority.critical', 'CRITICAL'),
      displayScore: `${score}`,
      color: '#991B1B',
      bgColor: '#FEE2E2',
      borderColor: '#FCA5A5',
    };
  }

  if (score >= 60) {
    return {
      level: 'HIGH',
      score,
      labelKey: 'common:priority.elevated',
      label: tr('common:priority.elevated', 'ELEVATED'),
      displayScore: `${score}`,
      color: '#9A3412',
      bgColor: '#FFEDD5',
      borderColor: '#FDBA74',
    };
  }

  if (score >= 40) {
    return {
      level: 'MEDIUM',
      score,
      labelKey: 'common:priority.moderate',
      label: tr('common:priority.moderate', 'MODERATE'),
      displayScore: `${score}`,
      color: '#92400E',
      bgColor: '#FEF3C7',
      borderColor: '#FDE68A',
    };
  }

  return {
    level: 'LOW',
    score,
    labelKey: 'common:priority.routine',
    label: tr('common:priority.routine', 'ROUTINE'),
    displayScore: `${score}`,
    color: '#065F46',
    bgColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  };
}

export function getCategoryLabel(category, t) {
  if (!category) return '';
  const slug = String(category).trim().toLowerCase();
  const fallback = slug.replace(/_/g, ' ');
  if (typeof t !== 'function') return fallback;
  return t(`complaint:categories.${slug}.label`, fallback);
}

export function getStatusLabel(status, t) {
  const normalized = String(status || 'pending').trim().toLowerCase().replace(/-/g, '_');
  const fallback = normalized.replace(/_/g, ' ').toUpperCase();
  if (typeof t !== 'function') return fallback;
  return t(`common:statusFilters.${normalized}`, fallback);
}

