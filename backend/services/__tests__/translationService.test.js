const axios = require('axios');
const TranslationService = require('../TranslationService');

jest.mock('axios');

describe('TranslationService', () => {
  const origGroqKey = process.env.GROQ_API_KEY;
  const origSarvamKey = process.env.SARVAM_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    TranslationService.clearCache();
    process.env.GROQ_API_KEY = 'test-groq-key';
    delete process.env.SARVAM_API_KEY;
  });

  afterAll(() => {
    if (origGroqKey !== undefined) process.env.GROQ_API_KEY = origGroqKey;
    else delete process.env.GROQ_API_KEY;
    if (origSarvamKey !== undefined) process.env.SARVAM_API_KEY = origSarvamKey;
    else delete process.env.SARVAM_API_KEY;
  });

  test('normalizes language codes cleanly', () => {
    expect(TranslationService.normalizeLang('hi-IN')).toBe('hi');
    expect(TranslationService.normalizeLang('ta')).toBe('ta');
    expect(TranslationService.normalizeLang('fr')).toBe('en');
    expect(TranslationService.normalizeLang(null)).toBe('en');
  });

  test('batches, deduplicates, and caches translations via Groq', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: ['सड़क पर बड़ा गड्ढा है', 'सड़क ठीक करें'],
              }),
            },
          },
        ],
      },
    });

    const input = [
      'Large pothole on the road',
      '12345', // non-translatable number
      'Large pothole on the road', // duplicate
      'Fix the road',
    ];

    const first = await TranslationService.translateBatch(input, 'hi');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(first.translations).toEqual([
      'सड़क पर बड़ा गड्ढा है',
      '12345',
      'सड़क पर बड़ा गड्ढा है',
      'सड़क ठीक करें',
    ]);
    expect(first.provider).toBe('groq');

    // Second call should hit cache completely without calling axios
    const second = await TranslationService.translateBatch(['Large pothole on the road', 'Fix the road'], 'hi');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(second.translations).toEqual(['सड़क पर बड़ा गड्ढा है', 'सड़क ठीक करें']);
    expect(second.provider).toBe('cache');
  });

  test('falls back to Sarvam AI when Groq fails', async () => {
    process.env.SARVAM_API_KEY = 'test-sarvam-key';
    axios.post
      .mockRejectedValueOnce(new Error('Groq primary down'))
      .mockRejectedValueOnce(new Error('Groq fallback down'))
      .mockResolvedValueOnce({ data: { translated_text: 'சாலை குழி' } });

    const res = await TranslationService.translateBatch(['Road pothole'], 'ta');
    expect(res.provider).toBe('sarvam');
    expect(res.translations).toEqual(['சாலை குழி']);
  });

  test('gracefully returns original text if all providers fail', async () => {
    axios.post.mockRejectedValue(new Error('Network down'));

    const res = await TranslationService.translateBatch(['Broken streetlight'], 'kn');
    expect(res.provider).toBe('passthrough');
    expect(res.translatedCount).toBe(0);
    expect(res.translations).toEqual(['Broken streetlight']);
  });

  test('does not poison cache when Groq returns invalid slots', async () => {
    axios.post
      .mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: JSON.stringify({ translations: ['टूटी स्ट्रीटलाइट', null] }) } }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: JSON.stringify({ translations: ['बंद नाली'] }) } }],
        },
      });

    const first = await TranslationService.translateBatch(['Broken streetlight', 'Clogged drain'], 'hi');
    expect(first.translations).toEqual(['टूटी स्ट्रीटलाइट', 'Clogged drain']);
    expect(first.translatedCount).toBe(1);

    // Because null slot was not cached, only 'Clogged drain' hits Groq on the next call
    const second = await TranslationService.translateBatch(['Broken streetlight', 'Clogged drain'], 'hi');
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(second.translations).toEqual(['टूटी स्ट्रीटलाइट', 'बंद नाली']);
  });
});

