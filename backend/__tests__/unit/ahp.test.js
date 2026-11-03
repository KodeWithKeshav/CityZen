const { buildRatioMatrix, computeAHPWeights, ahpFromScores, RANDOM_INDEX } = require('../../services/ahp');
const priorityConfig = require('../../services/priorityConfig');

describe('ahp.buildRatioMatrix', () => {
  test('builds a reciprocal matrix (a_ij = 1 / a_ji)', () => {
    const { keys, matrix } = buildRatioMatrix({ a: 9, b: 3, c: 1 });
    expect(keys).toEqual(['a', 'b', 'c']);
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix.length; j++) {
        expect(matrix[i][j]).toBeCloseTo(1 / matrix[j][i], 10);
      }
    }
  });

  test('the diagonal is always 1 (an item compared to itself)', () => {
    const { matrix } = buildRatioMatrix({ a: 9, b: 3, c: 1 });
    matrix.forEach((row, i) => expect(row[i]).toBe(1));
  });
});

describe('ahp.computeAHPWeights', () => {
  test('weights are normalized (sum to 1)', () => {
    const { keys, matrix } = buildRatioMatrix({ a: 9, b: 7, c: 3, d: 2 });
    const { weights } = computeAHPWeights(keys, matrix);
    const sum = Object.values(weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  test('a higher input score always yields a higher weight', () => {
    const { keys, matrix } = buildRatioMatrix({ a: 9, b: 5, c: 1 });
    const { weights } = computeAHPWeights(keys, matrix);
    expect(weights.a).toBeGreaterThan(weights.b);
    expect(weights.b).toBeGreaterThan(weights.c);
  });

  test('a ratio-matrix built directly from scores is always perfectly consistent (CR = 0)', () => {
    // By construction (a_ij = score_i / score_j) this matrix is rank-1 and
    // therefore mathematically guaranteed consistent - this is a property
    // of the construction method, not a claim about the scores themselves.
    const { keys, matrix } = buildRatioMatrix({ a: 9, b: 7, c: 6, d: 4, e: 3, f: 1 });
    const result = computeAHPWeights(keys, matrix);
    expect(result.consistencyRatio).toBeCloseTo(0, 6);
    expect(result.consistent).toBe(true);
  });

  test('equal scores produce equal weights', () => {
    const { keys, matrix } = buildRatioMatrix({ a: 5, b: 5, c: 5 });
    const { weights } = computeAHPWeights(keys, matrix);
    expect(weights.a).toBeCloseTo(weights.b, 10);
    expect(weights.b).toBeCloseTo(weights.c, 10);
    expect(weights.a).toBeCloseTo(1 / 3, 10);
  });

  test('a 1x1 and 2x2 matrix do not divide by a zero Random Index', () => {
    const one = computeAHPWeights(['a'], [[1]]);
    expect(one.consistencyRatio).toBe(0);
    expect(RANDOM_INDEX[1]).toBe(0);

    const two = computeAHPWeights(['a', 'b'], [[1, 4], [0.25, 1]]);
    expect(Number.isFinite(two.consistencyRatio)).toBe(true);
    expect(two.weights.a + two.weights.b).toBeCloseTo(1, 10);
  });
});

describe('ahp.ahpFromScores (convenience wrapper)', () => {
  test('returns weights, the matrix, and the original scores', () => {
    const result = ahpFromScores({ hospital: 9, bank: 2 });
    expect(result.scores).toEqual({ hospital: 9, bank: 2 });
    expect(result.keys).toEqual(['hospital', 'bank']);
    expect(result.weights.hospital).toBeGreaterThan(result.weights.bank);
  });
});

describe("priorityConfig's real criticality tables pass Saaty's CR <= 0.10 acceptability threshold", () => {
  // These are a direct ratio-matrix construction (buildRatioMatrix), so this
  // is really re-confirming the construction method is consistent for the
  // live, documented scores actually shipped in priorityConfig.js - not a
  // claim about whether those 1-9 judgments are themselves "correct".
  test.each([
    ['FACILITY_AHP', 'FACILITY_CRITICALITY_SCORES'],
    ['SIGNAL_AHP', 'SIGNAL_CRITICALITY_SCORES'],
    ['EMOTION_AHP', 'EMOTION_CRITICALITY_SCORES'],
    ['AUTHENTICITY_AHP', 'AUTHENTICITY_CRITICALITY_SCORES'],
    ['MODEL_VS_RULE_AHP', 'MODEL_VS_RULE_CRITICALITY_SCORES'],
  ])('%s is consistent', (ahpKey) => {
    const ahp = priorityConfig[ahpKey];
    expect(ahp.consistent).toBe(true);
    expect(ahp.consistencyRatio).toBeLessThanOrEqual(0.10);
  });

  test('FACILITY_WEIGHTS sums to 1 and ranks hospital/fire_station highest', () => {
    const weights = priorityConfig.FACILITY_WEIGHTS;
    const sum = Object.values(weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(weights.hospital).toBeGreaterThanOrEqual(weights.bank);
    expect(weights.fire_station).toBeGreaterThanOrEqual(weights.bank);
  });

  test('TOP_LEVEL_WEIGHTS sums to 1 and weights image evidence highest, votes lowest', () => {
    const weights = priorityConfig.TOP_LEVEL_WEIGHTS;
    const sum = Object.values(weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 6);
    const maxWeight = Math.max(...Object.values(weights));
    expect(weights.imageValidationScore).toBeCloseTo(maxWeight, 6);
    expect(weights.voteScore).toBeLessThan(weights.imageValidationScore);
    expect(weights.voteScore).toBeLessThan(weights.infrastructureScore);
  });
});
