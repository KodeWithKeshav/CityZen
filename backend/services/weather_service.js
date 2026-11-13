const axios = require('axios');

// Per-coordinate in-memory cache (bounded to avoid unbounded growth)
const weatherCache = {
  entries: new Map(),
  CACHE_DURATION: 15 * 60 * 1000, // 15 minutes
  MAX_ENTRIES: 100
};

const mapWeatherCodeToDescription = (code) => {
  const codes = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return codes[code] || 'Unknown';
};

const isHeavyRainCode = (code) => {
  const heavyCodes = [63, 65, 67, 81, 82, 95, 96, 99];
  return heavyCodes.includes(code);
};

const getWeather = async (lat = 13.0827, lon = 80.2707) => {
  const numLat = Number(lat);
  const numLon = Number(lon);
  if (!Number.isFinite(numLat) || numLat < -90 || numLat > 90 || !Number.isFinite(numLon) || numLon < -180 || numLon > 180) {
    throw new Error('Invalid latitude or longitude');
  }

  const cacheKey = `${numLat.toFixed(2)},${numLon.toFixed(2)}`;
  const cachedEntry = weatherCache.entries.get(cacheKey);
  
  if (cachedEntry && (Date.now() - cachedEntry.timestamp < weatherCache.CACHE_DURATION)) {
    console.log('Returning cached weather data for', cacheKey);
    return cachedEntry.data;
  }

  try {
    console.log(`Fetching live weather data for lat=${numLat}, lon=${numLon}...`);
    // Using Open-Meteo free API as requested
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${numLat}&longitude=${numLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;
    if (!data || !data.current || !data.daily || !Array.isArray(data.daily.time)) {
      throw new Error('Invalid weather API response');
    }

    // Sanitize dry thunderstorms (Open-Meteo often predicts WMO 95 but with 0% rain in tropical areas)
    const sanitizeCode = (code, rainProb, precipitation = 0) => {
      if ((code === 95 || code === 96 || code === 99) && rainProb < 20 && precipitation === 0) {
        return 1; // Return 'Mainly clear' instead of Thunderstorm
      }
      return code;
    };

    const precipProbs = Array.isArray(data.daily.precipitation_probability_max) ? data.daily.precipitation_probability_max : [];
    const weatherCodes = Array.isArray(data.daily.weather_code) ? data.daily.weather_code : [];
    const minTemps = Array.isArray(data.daily.temperature_2m_min) ? data.daily.temperature_2m_min : [];
    const maxTemps = Array.isArray(data.daily.temperature_2m_max) ? data.daily.temperature_2m_max : [];

    const todayRainProb = precipProbs[0] ?? 0;
    const sanitizedCurrentCode = sanitizeCode(data.current.weather_code, todayRainProb, data.current.precipitation ?? 0);

    // Process current weather
    const current = {
      temp: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      condition: mapWeatherCodeToDescription(sanitizedCurrentCode),
      weatherCode: sanitizedCurrentCode,
      isDay: data.current.is_day,
      precipitation: data.current.precipitation
    };

    // Process 7-day forecast
    const forecast = data.daily.time.map((time, index) => {
      const rainProb = precipProbs[index] ?? 0;
      const rawCode = weatherCodes[index];
      const safeCode = sanitizeCode(rawCode, rainProb, 0);

      return {
        date: time,
        minTemp: minTemps[index],
        maxTemp: maxTemps[index],
        condition: mapWeatherCodeToDescription(safeCode),
        weatherCode: safeCode,
        rainProbability: rainProb
      };
    });

    // Check if heavy rain is expected in the next 48 hours (today or tomorrow)
    const todayCode = forecast[0]?.weatherCode;
    const tomorrowCode = forecast[1]?.weatherCode;
    const tomorrowRainProb = precipProbs[1] ?? 0;

    // Smarter logic: Don't just rely on WMO code (sometimes it predicts dry thunderstorms).
    // Require a significant chance of rain (>40%) alongside the code, or a very high probability (>70%).
    const isHeavyRainExpected = 
      (isHeavyRainCode(todayCode) && todayRainProb > 40) || 
      (isHeavyRainCode(tomorrowCode) && tomorrowRainProb > 40) || 
      todayRainProb > 70 || 
      tomorrowRainProb > 70;

    let alertMessage = null;
    if (isHeavyRainExpected) {
      alertMessage = "Heavy rainfall expected. Higher chance of waterlogging and drain complaints. Stay safe!";
    }

    const isDefaultChennai = Math.abs(numLat - 13.0827) < 0.05 && Math.abs(numLon - 80.2707) < 0.05;
    const processedData = {
      current,
      forecast,
      isHeavyRainExpected,
      alertMessage,
      location: isDefaultChennai ? "Chennai" : `${numLat.toFixed(2)}, ${numLon.toFixed(2)}`
    };

    // Cache the data per coordinate key (evict oldest if at capacity)
    if (weatherCache.entries.size >= weatherCache.MAX_ENTRIES && !weatherCache.entries.has(cacheKey)) {
      weatherCache.entries.delete(weatherCache.entries.keys().next().value);
    }
    weatherCache.entries.set(cacheKey, {
      data: processedData,
      timestamp: Date.now()
    });

    return processedData;
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    // If API fails, return stale cached data for this location if available
    if (cachedEntry?.data) {
      return cachedEntry.data;
    }
    throw new Error('Failed to fetch weather data');
  }
};

module.exports = {
  getWeather,
  mapWeatherCodeToDescription
};
