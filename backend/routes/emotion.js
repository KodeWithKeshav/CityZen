const express = require('express');
const router = express.Router();
const { emotionService } = require('../services/EmotionAnalysisService');
const { authorizeUserType } = require('../middleware/auth');

/**
 * Multilingual emotion/sentiment analysis API for CivicStack.
 * The analysis logic itself lives in services/EmotionAnalysisService.js so
 * it can also be reused directly by routes/complaints.js during submission.
 */

const MAX_EXPLAIN_CHARS = 2000;
const EXPLAIN_TARGETS = ['NEGATIVE', 'POSITIVE'];

// API Routes
router.post('/analyze', async (req, res) => {
  try {
    const { text, category, translation } = req.body || {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text is required for emotion analysis'
      });
    }

    const safeCategory = typeof category === 'string' && category.trim() ? category.trim() : null;
    const safeTranslation = typeof translation === 'string' && translation.trim() ? translation.trim() : null;

    if (safeTranslation) {
      console.log('🌐 Received English translation for emotion analysis:', safeTranslation.substring(0, 80));
    }

    const result = await emotionService.analyzeEmotion(text, safeCategory, safeTranslation);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Emotion analysis failed',
      error: error.message
    });
  }
});

/**
 * POST /api/emotion/explain   (admin only)
 * SHAP word-level explanation of the local DistilBERT sentiment prediction:
 * which words pushed the complaint towards (positive SHAP value) or away from
 * (negative value) the `target` label. English text only -- the model is an
 * English SST-2 classifier. Admin-only because each call costs real CPU time.
 */
router.post('/explain', authorizeUserType(['admin']), async (req, res) => {
  try {
    const { text, target, maxEvals, topK } = req.body || {};

    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Text is required for explanation' });
    }
    if (text.length > MAX_EXPLAIN_CHARS) {
      return res.status(400).json({ success: false, message: `Text is too long (max ${MAX_EXPLAIN_CHARS} characters)` });
    }

    let safeTarget = 'NEGATIVE';
    if (target !== undefined && target !== null && target !== '') {
      const upper = String(target).toUpperCase();
      if (!EXPLAIN_TARGETS.includes(upper)) {
        return res.status(400).json({ success: false, message: `target must be one of ${EXPLAIN_TARGETS.join(', ')}` });
      }
      safeTarget = upper;
    }

    const explanation = await emotionService.explainWithLocalModel(text.trim(), {
      target: safeTarget,
      maxEvals: Number.isFinite(Number(maxEvals)) ? Number(maxEvals) : undefined,
      topK: Number.isFinite(Number(topK)) ? Number(topK) : undefined,
    });

    res.json({ success: true, data: explanation, timestamp: new Date().toISOString() });
  } catch (error) {
    const status = error.status || 500;
    if (status === 503) console.warn('⚠️ Emotion explain unavailable:', error.message);
    else if (status >= 500) console.error('❌ Emotion explain error:', error.message);
    res.status(status).json({
      success: false,
      message: status === 503
        ? 'The local DistilBERT service is not running or has no local model available'
        : (error.message || 'Emotion explanation failed'),
      detail: error.detail || undefined,
    });
  }
});

/**
 * GET /api/emotion/model-status   (admin only)
 * Which DistilBERT backend is live (local / hf / none), on which device, whether
 * SHAP is installed, and the reason when the local model could not start.
 */
router.get('/model-status', authorizeUserType(['admin']), async (req, res) => {
  try {
    const status = await emotionService.getLocalModelStatus();
    res.json({ success: true, data: status, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not read model status' });
  }
});

router.get('/test', async (req, res) => {
  try {
    const testCases = [
      { text: "The road has dangerous potholes and children fall down. Very worried about safety.", category: "pothole", language: "en" },
      { text: "इस गड्ढे के कारण कई दुर्घटनाएं और मौतें हुई हैं कृपया इसे ठीक करें", category: "pothole", language: "hi" },
      { text: "சாலையில் ஆபத்தான குழிகள் உள்ளன. நான் மிகவும் கவலையாக இருக்கிறேன்.", category: "pothole", language: "ta" }
    ];

    const results = await Promise.all(
      testCases.map(async (testCase) => {
        try {
          const result = await emotionService.analyzeEmotion(testCase.text, testCase.category);
          return { input: testCase, output: result, status: 'success' };
        } catch (error) {
          return { input: testCase, error: error.message, status: 'failed' };
        }
      })
    );

    res.json({
      success: true,
      testResults: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Emotion test error:', error);
    res.status(500).json({
      success: false,
      message: 'Emotion test failed',
      error: error.message
    });
  }
});

module.exports = router;
