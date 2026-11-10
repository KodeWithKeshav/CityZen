import { describe, it, expect } from 'vitest';
import { normalizePriorityScore, getRawPriority, getPriorityTier } from './priorityUtils';

describe('normalizePriorityScore', () => {
  it('scales a 0.0-1.0 engine score up to 0-100', () => {
    expect(normalizePriorityScore(0.85)).toBe(85);
    expect(normalizePriorityScore(0.5)).toBe(50);
  });

  it('scales a 1.0-10.0 rating up to 0-100', () => {
    expect(normalizePriorityScore(8.5)).toBe(85);
    expect(normalizePriorityScore(3)).toBe(30);
  });

  it('passes through an already-0-100 score, clamped to the range', () => {
    expect(normalizePriorityScore(72)).toBe(72);
    expect(normalizePriorityScore(150)).toBe(100);
  });

  it.each([null, undefined, '', 'not-a-number', NaN])('returns null for unparseable input: %p (boundary case)', (input) => {
    expect(normalizePriorityScore(input)).toBeNull();
  });

  it('treats exactly 0 as the 0-100 scale, not a parse failure (boundary case)', () => {
    expect(normalizePriorityScore(0)).toBe(0);
  });

  it('handles the ambiguous boundary values 1.0 and 10.0 without throwing', () => {
    expect(normalizePriorityScore(1.0)).toBe(100); // 0-1 branch: 1.0 * 100
    expect(normalizePriorityScore(10.0)).toBe(100); // 1-10 branch: 10.0 * 10
  });

  it('accepts a numeric string', () => {
    expect(normalizePriorityScore('0.42')).toBe(42);
  });
});

describe('getRawPriority', () => {
  it('prefers priorityScore over the other key variants', () => {
    expect(getRawPriority({ priorityScore: 0.9, priority_score: 0.1, priority: 1 })).toBe(0.9);
  });

  it('falls back to priority_score, then priority', () => {
    expect(getRawPriority({ priority_score: 0.7, priority: 1 })).toBe(0.7);
    expect(getRawPriority({ priority: 55 })).toBe(55);
  });

  it('returns null for a non-numeric legacy "priority" field (string label, not a score)', () => {
    expect(getRawPriority({ priority: 'HIGH' })).toBeNull();
  });

  it('handles null/non-object input without throwing (boundary case)', () => {
    expect(getRawPriority(null)).toBeNull();
    expect(getRawPriority(undefined)).toBeNull();
    expect(getRawPriority('not-an-object')).toBeNull();
  });

  it('returns null when the complaint has no recognizable priority field', () => {
    expect(getRawPriority({ title: 'Pothole' })).toBeNull();
  });
});

describe('getPriorityTier', () => {
  it.each([
    [0.85, 'CRITICAL'],
    [0.8, 'CRITICAL'],   // lower-bound inclusive
    [0.79, 'HIGH'],
    [0.6, 'HIGH'],       // lower-bound inclusive
    [0.59, 'MEDIUM'],
    [0.4, 'MEDIUM'],     // lower-bound inclusive
    [0.39, 'LOW'],
    [0, 'LOW'],
  ])('classifies a 0-1 score of %p as tier %p', (score, expectedLevel) => {
    expect(getPriorityTier(score).level).toBe(expectedLevel);
  });

  it('returns the STANDARD/N-A placeholder tier for an unparseable score (boundary case)', () => {
    const tier = getPriorityTier(null);
    expect(tier.level).toBe('STANDARD');
    expect(tier.score).toBeNull();
    expect(tier.displayScore).toBe('—');
  });

  it('accepts a full complaint object and resolves its priority field automatically', () => {
    const tier = getPriorityTier({ priorityScore: 0.92 });
    expect(tier.level).toBe('CRITICAL');
    expect(tier.score).toBe(92);
  });

  it('every tier includes display metadata (label, badgeClass) for the UI to consume', () => {
    const tier = getPriorityTier(0.5);
    expect(typeof tier.label).toBe('string');
    expect(typeof tier.badgeClass).toBe('string');
    expect(typeof tier.displayScore).toBe('string');
  });
});
