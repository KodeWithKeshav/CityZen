jest.mock('../../services/TranslationService', () => ({
  LANGUAGE_NAMES: {
    en: 'English',
    hi: 'Hindi',
    ta: 'Tamil',
    te: 'Telugu',
    ml: 'Malayalam',
    kn: 'Kannada',
  },
  normalizeLang: jest.fn((lang) => (lang ? String(lang).split('-')[0].toLowerCase() : 'en')),
  alreadyInTargetScript: jest.fn((text, targetLang) => targetLang === 'en' && /^[a-zA-Z0-9\s?!.,]+$/.test(text)),
  translateBatch: jest.fn(async (texts, targetLang) => ({
    translations: texts.map((t) => `[${targetLang}] ${t}`),
    targetLang,
    cachedCount: 0,
    translatedCount: texts.length,
    provider: 'mock',
  })),
  translateText: jest.fn(async (text, targetLang) => `[${targetLang}] ${text}`),
}));

const translateRouter = require('../translate');
const chatbotRouter = require('../chatbot');
const TranslationService = require('../../services/TranslationService');

function getRouteHandler(router, method, routePath) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods[method]
  );
  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
  }
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('translate routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /batch rejects non-array texts', async () => {
    const handler = getRouteHandler(translateRouter, 'post', '/batch');
    const req = { body: { texts: 'hello', targetLang: 'hi' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /batch rejects arrays containing non-string elements', async () => {
    const handler = getRouteHandler(translateRouter, 'post', '/batch');
    const req = { body: { texts: ['hello', { bad: true }], targetLang: 'hi' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /batch rejects more than 80 items', async () => {
    const handler = getRouteHandler(translateRouter, 'post', '/batch');
    const req = { body: { texts: new Array(81).fill('hi'), targetLang: 'hi' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /batch returns translated array for valid payload', async () => {
    const handler = getRouteHandler(translateRouter, 'post', '/batch');
    const req = { body: { texts: ['Pothole on Main St', 'Broken streetlight'], targetLang: 'ta' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.translations).toEqual(['[ta] Pothole on Main St', '[ta] Broken streetlight']);
    expect(TranslationService.translateBatch).toHaveBeenCalledWith(
      ['Pothole on Main St', 'Broken streetlight'],
      'ta'
    );
  });

  test('POST /text translates single string', async () => {
    const handler = getRouteHandler(translateRouter, 'post', '/text');
    const req = { body: { text: 'Road repair', targetLang: 'kn' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      translatedText: '[kn] Road repair',
      targetLang: 'kn',
    });
  });
});

describe('chatbot route language handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /message rejects empty messages', async () => {
    const handler = getRouteHandler(chatbotRouter, 'post', '/message');
    const req = { body: { message: '   ', language: 'hi' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /message localizes KB hit and follow-up suggestions when language != en', async () => {
    const handler = getRouteHandler(chatbotRouter, 'post', '/message');
    const req = {
      body: {
        message: 'How do I submit a complaint?',
        userId: 'test-lang-user',
        language: 'hi',
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.language).toBe('hi');
    expect(res.body.reply.startsWith('[hi] ')).toBe(true);
    expect(TranslationService.translateBatch).toHaveBeenCalled();
  });
});

