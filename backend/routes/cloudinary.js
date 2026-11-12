const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const axios = require('axios');

// POST /cloudinary/delete-image
router.post('/delete-image', async (req, res) => {
  const { public_id } = req.body || {};
  if (typeof public_id !== 'string' || !public_id.trim()) {
    return res.status(400).json({ error: 'public_id required' });
  }

  const trimmedId = public_id.trim();
  if (trimmedId.length > 255 || /[?#\r\n]/.test(trimmedId)) {
    return res.status(400).json({ error: 'Invalid public_id' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Cloudinary credentials not configured' });
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signaturePayload = `public_id=${trimmedId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    const formBody = new URLSearchParams({
      public_id: trimmedId,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature,
    });

    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`;
    const response = await axios.post(url, formBody.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (err) {
    console.error('Cloudinary delete error:', err.response?.data || err.message);
    res.status(err.response?.status >= 400 && err.response?.status < 500 ? err.response.status : 500).json({
      error: err.message,
    });
  }
});

module.exports = router;
