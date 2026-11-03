const priorityConfig = require('../../services/priorityConfig');
const {
  getCategoryTier,
  getCategoryMultiplier,
  getCategoryImportanceLabel,
  getFallbackPriorityScore,
  getPriorityLevel,
  exponentialDistanceScore,
  tierMultiplier,
  CATEGORY_TIER_SCORES,
} = priorityConfig;

describe('getCategoryTier', () => {
  test('maps a known life-threatening category correctly', () => {
    expect(getCategoryTier('fallen_electric_pole')).toBe('lifeThreatening');
    expect(getCategoryTier('gas_leak')).toBe('lifeThreatening');
  });

  test('maps the app\'s 8-class image taxonomy to the documented tiers', () => {
    expect(getCategoryTier('pothole')).toBe('infrastructureIntegrity');
    expect(getCategoryTier('fallen_tree')).toBe('infrastructureIntegrity');
    expect(getCategoryTier('garbage_dumping')).toBe('basicServices');
    expect(getCategoryTier('stray_cattle')).toBe('basicServices');
    expect(getCategoryTier('concrete_structure_damage')).toBe('infrastructureIntegrity');
    expect(getCategoryTier('road_waterlogging')).toBe('infrastructureIntegrity');
  });

  test('falls back to civicAdministrative for an unrecognized category (boundary case)', () => {
    expect(getCategoryTier('totally_made_up_category')).toBe('civicAdministrative');
    expect(getCategoryTier(undefined)).toBe('civicAdministrative');
    expect(getCategoryTier('')).toBe('civicAdministrative');
  });
});

describe('tierMultiplier / getCategoryMultiplier', () => {
  test('a tier score of 9 produces the maximum 1.90x multiplier', () => {
    expect(tierMultiplier(9)).toBeCloseTo(1.9, 6);
  });

  test('a tier score of 1 produces the minimum 1.10x multiplier', () => {
    expect(tierMultiplier(1)).toBeCloseTo(1.1, 6);
  });

  test('every multiplier produced by getCategoryMultiplier stays within the documented [1.10, 1.90] span', () => {
    const categories = Object.keys(priorityConfig.CATEGORY_TIER_MAP);
    categories.forEach((category) => {
      const multiplier = getCategoryMultiplier(category);
      expect(multiplier).toBeGreaterThanOrEqual(1.10 - 1e-9);
      expect(multiplier).toBeLessThanOrEqual(1.90 + 1e-9);
    });
  });

  test('a life-threatening category multiplies more than a civic/administrative one', () => {
    expect(getCategoryMultiplier('gas_leak')).toBeGreaterThan(getCategoryMultiplier('park_maintenance'));
  });
});

describe('getCategoryImportanceLabel', () => {
  test('returns a human-readable label for every tier', () => {
    expect(getCategoryImportanceLabel('fallen_electric_pole')).toMatch(/life-threatening/);
    expect(getCategoryImportanceLabel('pothole')).toMatch(/infrastructure/);
    expect(getCategoryImportanceLabel('park_maintenance')).toBe('standard');
  });
});

describe('getFallbackPriorityScore', () => {
  test('stays within the documented [0.278, 0.9] range for every known category', () => {
    Object.keys(priorityConfig.CATEGORY_TIER_MAP).forEach((category) => {
      const score = getFallbackPriorityScore(category);
      expect(score).toBeGreaterThanOrEqual(0.277);
      expect(score).toBeLessThanOrEqual(0.9);
    });
  });

  test('a higher-tier category always gets a higher fallback score than a lower one', () => {
    expect(getFallbackPriorityScore('gas_leak')).toBeGreaterThan(getFallbackPriorityScore('park_maintenance'));
  });
});

describe('getPriorityLevel (equal-interval banding)', () => {
  test.each([
    [1.0, 'CRITICAL'],
    [0.8, 'CRITICAL'],   // lower-bound inclusive
    [0.79999, 'HIGH'],
    [0.6, 'HIGH'],       // lower-bound inclusive
    [0.59999, 'MEDIUM'],
    [0.4, 'MEDIUM'],     // lower-bound inclusive
    [0.39999, 'LOW'],
    [0.2, 'LOW'],        // lower-bound inclusive
    [0.19999, 'MINIMAL'],
    [0, 'MINIMAL'],
  ])('score %p -> %p', (score, expected) => {
    expect(getPriorityLevel(score)).toBe(expected);
  });

  test('negative scores (should never occur, but must not throw) resolve to MINIMAL', () => {
    expect(getPriorityLevel(-1)).toBe('MINIMAL');
  });
});

describe('exponentialDistanceScore (negative-exponential proximity decay)', () => {
  test('zero distance always scores 1 (maximum proximity)', () => {
    expect(exponentialDistanceScore(0, 500)).toBeCloseTo(1, 10);
  });

  test('distance equal to the half-value distance scores exactly 0.5', () => {
    expect(exponentialDistanceScore(500, 500)).toBeCloseTo(0.5, 6);
  });

  test('score decreases monotonically as distance increases', () => {
    const near = exponentialDistanceScore(100, 500);
    const mid = exponentialDistanceScore(500, 500);
    const far = exponentialDistanceScore(2000, 500);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  test('decays gracefully (not to an artificial hard zero) well past the search radius, unlike a linear ramp', () => {
    // 10x the half-value distance -> 2^-10, still representable and > 0;
    // only becomes exactly 0 far beyond any distance this app ever computes
    // with, once the exponent underflows double-precision float range.
    expect(exponentialDistanceScore(5000, 500)).toBeGreaterThan(0);
    expect(exponentialDistanceScore(5000, 500)).toBeCloseTo(Math.pow(2, -10), 6);
  });

  test('invalid inputs (non-positive halfDistance, negative distance) return 0 instead of NaN/Infinity', () => {
    expect(exponentialDistanceScore(100, 0)).toBe(0);
    expect(exponentialDistanceScore(100, -50)).toBe(0);
    expect(exponentialDistanceScore(-10, 500)).toBe(0);
  });
});

describe('CATEGORY_TIER_SCORES sanity', () => {
  test('every documented tier score is on Saaty\'s 1-9 scale', () => {
    Object.values(CATEGORY_TIER_SCORES).forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(9);
    });
  });
});
