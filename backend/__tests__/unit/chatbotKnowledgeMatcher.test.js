const { ChatbotKnowledgeMatcher, CIVIC_KNOWLEDGE_BASE } = require('../../services/ChatbotKnowledgeBase');

describe('ChatbotKnowledgeMatcher.findBestMatch', () => {
  let matcher;
  beforeEach(() => { matcher = new ChatbotKnowledgeMatcher(); });

  // Note: findBestMatch's returned `category` is the *response's own*
  // category label (e.g. "pothole_guide"), not the outer knowledge-base key
  // ("pothole_reporting") - the response object's `category` field is
  // spread in after the outer one and wins.
  test('matches a clear pothole-reporting question to the pothole guide', () => {
    const result = matcher.findBestMatch('there is a road hole causing street damage and pavement damage');
    expect(result.category).toBe('pothole_guide');
    expect(result.matchScore).toBeGreaterThan(0);
    expect(typeof result.text).toBe('string');
  });

  test('matches an app-overview question (multiple keyword hits) to the app_overview category', () => {
    const result = matcher.findBestMatch('can I get an app overview of the main features available');
    expect(result.category).toBe('app_overview');
  });

  test('a bare greeting with no topical keywords returns the generic greeting response', () => {
    const result = matcher.findBestMatch('hello');
    expect(result.category).toBe('greeting');
    expect(result.confidence).toBeCloseTo(0.8);
  });

  test('a completely unrelated message falls back to generic help, not a false-positive match', () => {
    const result = matcher.findBestMatch('what is the weather like on mars today');
    expect(result.category).toBe('generic_help');
  });

  test('is case-insensitive', () => {
    const lower = matcher.findBestMatch('how do i vote on a complaint');
    const upper = matcher.findBestMatch('HOW DO I VOTE ON A COMPLAINT');
    expect(upper.category).toBe(lower.category);
  });

  test('handles an empty message without throwing (boundary case)', () => {
    expect(() => matcher.findBestMatch('')).not.toThrow();
    const result = matcher.findBestMatch('');
    expect(result.category).toBe('generic_help');
  });

  test('every knowledge-base entry has at least one keyword and one response', () => {
    Object.entries(CIVIC_KNOWLEDGE_BASE).forEach(([category, data]) => {
      expect(data.keywords.length).toBeGreaterThan(0);
      expect(data.responses.length).toBeGreaterThan(0);
      expect(typeof data.responses[0].text).toBe('string');
    });
  });
});

describe('ChatbotKnowledgeMatcher.calculateMatchScore', () => {
  let matcher;
  beforeEach(() => { matcher = new ChatbotKnowledgeMatcher(); });

  test('matching an extra keyword in the same message scores higher (multi-match bonus)', () => {
    // Same message both times (so per-keyword length/message-length ratios
    // are directly comparable) - the only difference is whether the second
    // keyword list gives the algorithm a second term to match plus its
    // matchCount > 1 bonus.
    const message = 'pothole and road damage reported';
    const singleKeywordMatch = matcher.calculateMatchScore(message, ['pothole']);
    const multiKeywordMatch = matcher.calculateMatchScore(message, ['pothole', 'road damage']);
    expect(multiKeywordMatch).toBeGreaterThan(singleKeywordMatch);
  });

  test('never exceeds a score of 1.0 (clamped)', () => {
    const score = matcher.calculateMatchScore('a', ['a']);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  test('no matching keywords scores 0', () => {
    expect(matcher.calculateMatchScore('xyz', ['pothole', 'garbage'])).toBe(0);
  });
});
