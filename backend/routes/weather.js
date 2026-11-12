const express = require('express');
const router = express.Router();
const weatherService = require('../services/weather_service');

// @route   GET /api/weather
// @desc    Get live weather and forecast (defaults to Chennai)
// @access  Public (or protected based on auth later)
router.get('/', async (req, res) => {
  try {
    // Optional: allow passing lat/lon via query params
    let lat = 13.0827; // Chennai Default
    let lon = 80.2707; // Chennai Default

    if (req.query.lat !== undefined && req.query.lat !== '') {
      lat = Number(req.query.lat);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({
          success: false,
          message: 'Invalid latitude'
        });
      }
    }

    if (req.query.lon !== undefined && req.query.lon !== '') {
      lon = Number(req.query.lon);
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        return res.status(400).json({
          success: false,
          message: 'Invalid longitude'
        });
      }
    }

    const weatherData = await weatherService.getWeather(lat, lon);
    
    res.status(200).json({
      success: true,
      data: weatherData
    });
  } catch (error) {
    console.error('Weather Route Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weather data',
      error: error.message
    });
  }
});

module.exports = router;
