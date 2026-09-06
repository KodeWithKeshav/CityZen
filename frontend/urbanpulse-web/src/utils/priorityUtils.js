/**
 * Priority Score and Tier Utilities for CityZen
 * 
 * In the database and engine, priority scores can be stored on different scales:
 * - 0.00 to 1.00 float (standard engine output)
 * - 0.0 to 10.0 rating
 * - 0 to 100 percentage integer
 * 
 * These utilities normalize all scores into a consistent 0-100 scale and provide
 * consistent architectural classification tiers across feeds, queues, maps, and detail views.
 */

/**
 * Normalizes any raw priority score into a 0-100 integer.
 * Returns null if the value cannot be parsed or is null/undefined.
 */
export function normalizePriorityScore(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(raw);
  if (isNaN(num)) return null;

  // 0.0 to 1.0 decimal scale (e.g. 0.85 -> 85)
  if (num > 0 && num <= 1.0) {
    return Math.round(num * 100);
  }

  // 1.0 to 10.0 scale (e.g. 8.5 -> 85)
  if (num > 1.0 && num <= 10.0) {
    return Math.round(num * 10);
  }

  // Already 0 to 100 scale
  return Math.min(100, Math.max(0, Math.round(num)));
}

/**
 * Resolves the raw priority value from a complaint object across common key variants.
 */
export function getRawPriority(complaint) {
  if (!complaint || typeof complaint !== 'object') return null;
  if (complaint.priorityScore !== undefined && complaint.priorityScore !== null) {
    return complaint.priorityScore;
  }
  if (complaint.priority_score !== undefined && complaint.priority_score !== null) {
    return complaint.priority_score;
  }
  if (typeof complaint.priority === 'number') {
    return complaint.priority;
  }
  return null;
}

/**
 * Returns the normalized score and civic urgency tier:
 * - CRITICAL: 80 - 100
 * - ELEVATED: 60 - 79
 * - MODERATE: 40 - 59
 * - ROUTINE: 0 - 39
 */
export function getPriorityTier(scoreOrComplaint) {
  const raw = typeof scoreOrComplaint === 'object' && scoreOrComplaint !== null
    ? getRawPriority(scoreOrComplaint)
    : scoreOrComplaint;

  const score = normalizePriorityScore(raw);

  if (score === null) {
    return {
      level: 'STANDARD',
      score: null,
      label: 'N/A',
      displayScore: '—',
      bg: 'bg-neutral-100 text-neutral-700 border-neutral-300',
      badgeClass: 'border border-neutral-300 bg-neutral-50 text-neutral-600',
    };
  }

  if (score >= 80) {
    return {
      level: 'CRITICAL',
      score,
      label: 'CRITICAL',
      displayScore: `${score}`,
      bg: 'bg-neutral-900 text-white border-black',
      badgeClass: 'border border-black bg-neutral-900 text-white font-bold',
    };
  }

  if (score >= 60) {
    return {
      level: 'HIGH',
      score,
      label: 'ELEVATED',
      displayScore: `${score}`,
      bg: 'bg-neutral-800 text-neutral-100 border-neutral-900',
      badgeClass: 'border border-neutral-700 bg-neutral-800 text-neutral-100',
    };
  }

  if (score >= 40) {
    return {
      level: 'MEDIUM',
      score,
      label: 'MODERATE',
      displayScore: `${score}`,
      bg: 'bg-neutral-200 text-neutral-900 border-neutral-400',
      badgeClass: 'border border-neutral-300 bg-neutral-100 text-neutral-800',
    };
  }

  return {
    level: 'LOW',
    score,
    label: 'ROUTINE',
    displayScore: `${score}`,
    bg: 'bg-neutral-100 text-neutral-700 border-neutral-300',
    badgeClass: 'border border-neutral-200 bg-neutral-50 text-neutral-600',
  };
}
