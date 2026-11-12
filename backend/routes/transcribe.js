const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const SttProviderService = require('../services/stt/SttProviderService');

const ALLOWED_AUDIO_MIMETYPES = new Set([
  'video/webm',
  'video/mp4',
  'application/ogg'
]);

const uploadsDir = path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const baseName = path.basename(file.originalname || 'audio').replace(/[^a-zA-Z0-9._-]/g, '_');
    const suffix = Math.random().toString(36).slice(2, 8);
    cb(null, `${Date.now()}-${suffix}-${baseName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (mime.startsWith('audio/') || ALLOWED_AUDIO_MIMETYPES.has(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

const handleAudioUpload = (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (!err) return next();
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      success: false,
      message: err.message || 'Invalid audio upload'
    });
  });
};

/**
 * POST /api/transcribe/audio
 * Transcribes an uploaded audio clip in the requested language and returns
 * the transcript as spoken (no translation step — the rest of the app
 * renders/stores content in the citizen's chosen language directly).
 */
router.post('/audio', handleAudioUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No audio file uploaded' });
  }

  const language = typeof req.body?.language === 'string' && req.body.language.trim()
    ? req.body.language.trim()
    : 'en';
  const audioFilePath = req.file.path;

  try {
    const { transcript, languageUsed } = await SttProviderService.transcribe({
      audioPath: audioFilePath,
      language,
    });

    return res.json({
      success: true,
      transcript,
      language: languageUsed,
    });
  } catch (error) {
    console.error('Transcription error:', error.message);
    return res.status(502).json({
      success: false,
      message: 'Speech recognition failed. Please try again or type your complaint.',
      error: error.message,
    });
  } finally {
    try {
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }
    } catch (cleanupErr) {
      console.error('Error cleaning up uploaded audio file:', cleanupErr);
    }
  }
});

module.exports = router;
