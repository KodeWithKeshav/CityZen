const { EmotionAnalysisService } = require('../../services/EmotionAnalysisService');

describe('EmotionAnalysisService.detectLanguage', () => {
  let service;
  beforeEach(() => { service = new EmotionAnalysisService(); });

  test('detects English by default', async () => {
    expect(await service.detectLanguage('There is a huge pothole on my street')).toBe('en');
  });

  test('detects Hindi from Devanagari script', async () => {
    expect(await service.detectLanguage('सड़क पर बड़ा गड्ढा है')).toBe('hi');
  });

  test('detects Tamil script', async () => {
    expect(await service.detectLanguage('சாலையில் பெரிய குழி உள்ளது')).toBe('ta');
  });
});

describe('EmotionAnalysisService keyword scoring (pure, no network)', () => {
  let service;
  beforeEach(() => { service = new EmotionAnalysisService(); });

  test('an urgent, emergency-worded English complaint scores high urgency', () => {
    const emotions = service.analyzeWithEnhancedKeywords(
      'This is an emergency, dangerous live wire, risk of electrocution, please help immediately',
      'en'
    );
    expect(emotions.urgency).toBeGreaterThan(0.5);
  });

  test('a calm, neutral description scores low across all emotions', () => {
    const emotions = service.analyzeWithEnhancedKeywords('Could someone look into this when convenient', 'en');
    expect(emotions.anger).toBeLessThan(0.3);
    expect(emotions.urgency).toBeLessThan(0.3);
  });

  test('every emotion sub-score stays within [0, 1] (boundary invariant)', () => {
    const emotions = service.analyzeWithEnhancedKeywords(
      'urgent urgent emergency emergency dangerous dangerous critical critical accident accident fire fire',
      'en'
    );
    Object.values(emotions).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  test('handles empty text without throwing (boundary case)', () => {
    expect(() => service.analyzeWithKeywords('', 'en')).not.toThrow();
    const emotions = service.analyzeWithKeywords('', 'en');
    expect(emotions).toEqual({ anger: 0, urgency: 0, frustration: 0, concern: 0 });
  });

  test('calculateEmotionScore produces a single score in [0, 1] from sub-emotions', () => {
    const score = service.calculateEmotionScore({ anger: 0.8, urgency: 0.9, frustration: 0.5, concern: 0.6 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('applyCategoryAdjustments boosts a life-threatening category more than a civic one', () => {
    const base = 0.5;
    const lifeThreatening = service.applyCategoryAdjustments(base, 'gas_leak');
    const civic = service.applyCategoryAdjustments(base, 'park_maintenance');
    expect(lifeThreatening).toBeGreaterThan(civic);
    expect(lifeThreatening).toBeLessThanOrEqual(1.0);
  });

  test('detectIssueCategory auto-detects garbage-related text', () => {
    expect(service.detectIssueCategory('There is garbage and waste everywhere, needs cleaning')).toBe('garbage_collection');
  });
});

describe('EmotionAnalysisService.analyzeEmotion (Tamil/Hindi path - no network call)', () => {
  // The ta/hi branch of analyzeEmotion() never calls checkLocalModel()/the
  // Hugging Face API, so this exercises the full async method end-to-end
  // deterministically without any external dependency.
  let service;
  beforeEach(() => { service = new EmotionAnalysisService(); });

  test('a Tamil complaint describing danger produces a high emotion score', async () => {
    const result = await service.analyzeEmotion(
      'சாலையில் ஆபத்தான குழிகள் உள்ளன, விபத்து ஏற்படலாம். நான் மிகவும் கவலையாக இருக்கிறேன்.',
      'pothole'
    );
    expect(result.success).toBe(true);
    expect(result.language).toBe('ta');
    expect(result.emotionScore).toBeGreaterThan(0.3);
    expect(result.analysisMethod).toMatch(/enhanced-keywords-tamil/);
  });

  test('a Hindi complaint merges in an English translation\'s emotion signal when provided', async () => {
    const result = await service.analyzeEmotion(
      'गड्ढा है',
      'pothole',
      'This is an extremely dangerous emergency pothole causing fatal accidents'
    );
    expect(result.success).toBe(true);
    expect(result.analysisMethod).toContain('+translation');
    expect(result.emotionScore).toBeGreaterThan(0);
  });

  test('never throws and always returns a well-formed result, even for nonsense input (boundary case)', async () => {
    const result = await service.analyzeEmotion('asdkj zcvbn qwerty', 'others');
    expect(result).toHaveProperty('emotionScore');
    expect(result).toHaveProperty('emotions');
    expect(typeof result.emotionScore).toBe('number');
  });
});
