const {
  analyzeTextAuthenticity,
  analyzeTextAuthenticityBlended,
  CATEGORY_KEYWORDS,
} = require('../../services/TextAuthenticityService');

describe('analyzeTextAuthenticity (rule-based)', () => {
  test('a substantive, on-topic description scores high and is not flagged', () => {
    const result = analyzeTextAuthenticity({
      text: 'There is a large pothole near the bus stop causing damage to vehicle tyres and wheels.',
      category: 'pothole',
    });
    expect(result.authenticityScore).toBeGreaterThan(0.6);
    expect(result.flagged).toBe(false);
    expect(result.mismatchDetected).toBe(false);
  });

  test('detects a clear category/description mismatch and suggests the right category', () => {
    const result = analyzeTextAuthenticity({
      text: 'There is garbage and trash piling up with a terrible smell near our street, please clean the dump.',
      category: 'pothole',
    });
    expect(result.mismatchDetected).toBe(true);
    expect(result.suggestedCategory).toBe('garbage_dumping');
    expect(result.authenticityScore).toBeLessThan(0.6);
  });

  test('flags keyboard-mash / gibberish text (no recognizable English function words) as low-quality', () => {
    const result = analyzeTextAuthenticity({ text: 'asdkj qwpoxz vnmqw zzxcv', category: 'pothole' });
    expect(result.qualityIssues.some((i) => /gibberish/.test(i))).toBe(true);
  });

  test('flags repeated-character spam ("aaaaaaaa")', () => {
    const result = analyzeTextAuthenticity({ text: 'aaaaaaaaaaaaaaaaaaaaaaaa', category: 'pothole' });
    expect(result.qualityIssues.some((i) => /repeated characters/.test(i))).toBe(true);
  });

  test('flags text that is far too short to convey a real issue (boundary case)', () => {
    const result = analyzeTextAuthenticity({ text: 'bad', category: 'pothole' });
    expect(result.qualityIssues.some((i) => /too short/.test(i))).toBe(true);
  });

  test('handles an empty/missing text without throwing (boundary case)', () => {
    expect(() => analyzeTextAuthenticity({ text: undefined, category: 'pothole' })).not.toThrow();
    const result = analyzeTextAuthenticity({ category: 'pothole' });
    expect(result.authenticityScore).toBeGreaterThanOrEqual(0);
    expect(result.authenticityScore).toBeLessThanOrEqual(1);
    expect(result.qualityIssues.some((i) => /too short/.test(i))).toBe(true);
  });

  test('an unrecognized/"others" category skips the keyword-match restriction entirely', () => {
    const result = analyzeTextAuthenticity({
      text: 'The community park bench has been broken for a long time and nobody has fixed it yet.',
      category: 'others',
    });
    expect(result.mismatchDetected).toBe(false);
  });

  test('cross-checks against a conflicting image-detected class', () => {
    const result = analyzeTextAuthenticity({
      text: 'There is a large pothole near the bus stop causing damage to vehicle tyres and wheels.',
      category: 'pothole',
      imagePrimaryClass: 'fallen_tree',
    });
    expect(result.mismatchDetected).toBe(true);
    expect(result.reasons.some((r) => /detected as/.test(r))).toBe(true);
  });

  test('every CATEGORY_KEYWORDS entry (except "others") is non-empty', () => {
    Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
      if (category === 'others') return;
      expect(keywords.length).toBeGreaterThan(0);
    });
  });
});

describe('analyzeTextAuthenticityBlended (rule-based + optional model)', () => {
  // No HUGGING_FACE_API_KEY is set in the test environment, so
  // ModelAuthenticityService.analyzeWithModel() resolves to
  // `{ available: false }` immediately (no network call) and this falls
  // back to a pure function of the rule-based score.
  test('falls back to the rule-based score when the model is unavailable', async () => {
    const result = await analyzeTextAuthenticityBlended({
      text: 'There is a large pothole near the bus stop causing damage to vehicle tyres.',
      category: 'pothole',
    });
    expect(result.source).toBe('rule-based-fallback');
    expect(result.blendedScore).toBe(result.ruleBasedScore);
    expect(result.modelScore).toBeNull();
  });

  test('hard-blocks a submission that both mismatches its declared category and fails text-quality checks', async () => {
    // Strongly matches garbage_dumping (4 distinct keyword hits, 0 for the
    // declared "pothole" -> categoryMatchScore floors at 0.1) AND fails two
    // independent quality checks at once: no recognizable English function
    // word among >=4 tokens (gibberish, -0.5) and a 6+ run of "!" (repeated-
    // character spam, -0.4) -> low enough on both signals to cross the 0.25
    // hard-block threshold, not just the softer 0.45 flag-for-review one.
    const result = await analyzeTextAuthenticityBlended({
      text: 'garbage trash smell stink!!!!!!',
      category: 'pothole',
    });
    expect(result.ruleBasedScore).toBeLessThan(0.25);
    expect(result.hardBlocked).toBe(true);
  });

  test('does not hard-block or flag a clear, genuine complaint', async () => {
    const result = await analyzeTextAuthenticityBlended({
      text: 'A large fallen tree is blocking the entire road after last night\'s storm, please send a crew urgently.',
      category: 'fallen_tree',
    });
    expect(result.hardBlocked).toBe(false);
    expect(result.flagged).toBe(false);
  });
});
