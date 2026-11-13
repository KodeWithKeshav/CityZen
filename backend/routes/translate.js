const express = require('express');
const router = express.Router();
const TranslationService = require('../services/TranslationService');

const MAX_ITEMS_PER_REQUEST = 80;

/**
 * POST /api/translate/batch
 * Body: { texts: string[], targetLang: string }
 * Returns: { success: true, translations: string[], targetLang, cachedCount, translatedCount, provider }
 */
router.post('/batch', async (req, res) => {
  try {
    const { texts, targetLang = 'en' } = req.body || {};

    if (!Array.isArray(texts) || texts.some((t) => typeof t !== 'string')) {
      return res.status(400).json({
        success: false,
        error: 'texts must be an array of strings',
      });
    }

    if (texts.length > MAX_ITEMS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_ITEMS_PER_REQUEST} items allowed per batch`,
      });
    }

    const result = await TranslationService.translateBatch(texts, targetLang);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Batch translation error:', error);
    res.status(500).json({
      success: false,
      error: 'Translation service error',
    });
  }
});

/**
 * POST /api/translate/text
 * Body: { text: string, targetLang: string }
 */
router.post('/text', async (req, res) => {
  try {
    const { text = '', targetLang = 'en' } = req.body || {};
    if (typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text must be a string' });
    }
    const translatedText = await TranslationService.translateText(text, targetLang);
    res.json({
      success: true,
      translatedText,
      targetLang: TranslationService.normalizeLang(targetLang),
    });
  } catch (error) {
    console.error('❌ Text translation error:', error);
    res.status(500).json({ success: false, error: 'Translation service error' });
  }
});

module.exports = router;

