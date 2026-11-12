const express = require('express');
const router = express.Router();
const { emotionService } = require('../services/EmotionAnalysisService');

/**
 * Multilingual emotion/sentiment analysis API for CivicStack.
 * The analysis logic itself lives in services/EmotionAnalysisService.js so
 * it can also be reused directly by routes/complaints.js during submission.
 */

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
