const express = require('express');
const router = express.Router();
const LocationPriorityService = require('../services/LocationPriorityService');
const priorityConfig = require('../services/priorityConfig');

// Initialize the location priority service
const locationPriorityService = new LocationPriorityService();

// In-memory service metrics (since process start)
const serviceMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalDurationMs: 0,
  recentDurationsMs: [],
  priorityCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, MINIMAL: 0 },
  complaintTypeCounts: {},
  privacyLevelCounts: { exact: 0, street: 0, area: 0 },
};

function recordMetric({ success, durationMs, priorityLevel, complaintType, privacyLevel }) {
  serviceMetrics.totalRequests += 1;
  if (success) serviceMetrics.successfulRequests += 1;
  else serviceMetrics.failedRequests += 1;

  if (Number.isFinite(durationMs)) {
    serviceMetrics.totalDurationMs += durationMs;
    serviceMetrics.recentDurationsMs.push(durationMs);
    if (serviceMetrics.recentDurationsMs.length > 500) {
      serviceMetrics.recentDurationsMs.shift();
    }
  }
  if (priorityLevel && Object.prototype.hasOwnProperty.call(serviceMetrics.priorityCounts, priorityLevel)) {
    serviceMetrics.priorityCounts[priorityLevel] += 1;
  }
  if (complaintType) {
    serviceMetrics.complaintTypeCounts[complaintType] = (serviceMetrics.complaintTypeCounts[complaintType] || 0) + 1;
  }
  if (privacyLevel && Object.prototype.hasOwnProperty.call(serviceMetrics.privacyLevelCounts, privacyLevel)) {
    serviceMetrics.privacyLevelCounts[privacyLevel] += 1;
  }
}

function getPercentile(sortedValues, pct) {
  if (!sortedValues.length) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((pct / 100) * sortedValues.length) - 1));
  return sortedValues[idx];
}

function countFacilities(facilityAnalysis) {
  if (!facilityAnalysis || typeof facilityAnalysis !== 'object') return 0;
  return Object.values(facilityAnalysis).reduce((sum, f) => sum + (f?.count || 0), 0);
}

/**
 * Calculate location-based priority score for a complaint
 * POST /api/location-priority/calculate
 * 
 * Request Body:
 * {
 *   "latitude": number,
 *   "longitude": number, 
 *   "complaintType": string,
 *   "locationMeta": {
 *     "privacyLevel": "exact" | "street" | "area",
 *     "radiusM": number,
 *     "precision": string,
 *     "description": string
 *   }
 * }
 */
router.post('/calculate', async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('🔍 Location priority calculation request:', req.body);
    
    const body = req.body || {};
    const { latitude, longitude, complaintType, locationMeta } = body;
    
    // Input validation
    const validationResult = validateCalculationInput(body);
    if (!validationResult.isValid) {
      console.log('❌ Validation failed:', validationResult.error);
      recordMetric({ success: false, durationMs: Date.now() - startTime });
      return res.status(400).json({
        success: false,
        error: validationResult.error,
        code: validationResult.code,
        timestamp: new Date().toISOString()
      });
    }
    console.log('✅ Validation passed for complaint type:', complaintType);
    
    // Calculate location priority score
    let priorityResult;
    let processingTime;
    try {
      priorityResult = await locationPriorityService.calculateLocationPriority(
        latitude,
        longitude,
        complaintType,
        locationMeta
      );
      processingTime = Date.now() - startTime;
      console.log(`✅ Priority calculation completed in ${processingTime}ms`);
    } catch (calculationError) {
      console.error('❌ Priority calculation error:', calculationError);
      recordMetric({ success: false, durationMs: Date.now() - startTime, complaintType });
      return res.status(400).json({
        success: false,
        error: 'Priority calculation failed: ' + calculationError.message,
        code: 'CALCULATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
    
    // Determine priority level based on score
    const priorityLevel = determinePriorityLevel(priorityResult.priorityScore);
    const totalFacilities = countFacilities(priorityResult.facilityAnalysis);

    recordMetric({
      success: !priorityResult.error,
      durationMs: processingTime,
      priorityLevel,
      complaintType,
      privacyLevel: locationMeta?.privacyLevel,
    });
    
    // Format comprehensive response with corrected facility mapping
    const response = {
      success: true,
      priorityScore: priorityResult.priorityScore,
      priorityLevel: priorityLevel,
      reasoning: priorityResult.recommendationReason || priorityResult.fallbackReason || 'Priority calculated based on facility analysis',
      facilitiesNearby: {
        total: totalFacilities,
        breakdown: priorityResult.facilityAnalysis || {},
        topFacilities: priorityResult.criticalFacilities?.slice(0, 5) || [],
        densityBonus: priorityResult.densityBonus || 0,
        proximityScore: priorityResult.proximityScore || 0
      },
      locationDetails: {
        coordinates: { 
          latitude: parseFloat(latitude), 
          longitude: parseFloat(longitude) 
        },
        privacyLevel: priorityResult.locationMeta?.privacyLevel || locationMeta?.privacyLevel || 'unknown',
        accuracy: priorityResult.locationMeta?.accuracy || locationMeta?.radiusM || 'unknown',
        precision: priorityResult.locationMeta?.precision || locationMeta?.precision || 'unknown',
        complaintType: complaintType,
        description: locationMeta?.description || 'No description provided'
      },
      scoring: {
        baseScore: Number(((priorityResult.proximityScore || 0) + (priorityResult.densityBonus || 0)).toFixed(4)),
        facilityMultiplier: priorityResult.facilityMultiplier || 1,
        complaintMultiplier: priorityResult.complaintMultiplier || 1,
        privacyAdjustment: priorityResult.privacyAdjustment || 1,
        finalScore: priorityResult.priorityScore
      },
      metadata: {
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
        version: '2.1.0',
        apiVersion: 'v1',
        serviceStatus: priorityResult.error ? 'degraded' : 'operational'
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Location priority calculation error:', error);
    recordMetric({ success: false, durationMs: Date.now() - startTime });
    handleCalculationError(error, res);
  }
});

/**
 * Bulk calculate priority scores for multiple locations
 * POST /api/location-priority/calculate-bulk
 */
router.post('/calculate-bulk', async (req, res) => {
  try {
    const { locations } = req.body || {};
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Locations array is required',
        code: 'MISSING_LOCATIONS'
      });
    }
    
    if (locations.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 locations allowed per request',
        code: 'TOO_MANY_LOCATIONS'
      });
    }
    
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      const locationId = location?.id || `location_${i}`;

      const validation = validateCalculationInput(location);
      if (!validation.isValid) {
        results.push({
          index: i,
          success: false,
          error: validation.error,
          code: validation.code,
          locationId
        });
        continue;
      }
      
      try {
        const priorityResult = await locationPriorityService.calculateLocationPriority(
          location.latitude,
          location.longitude,
          location.complaintType,
          location.locationMeta
        );
        
        results.push({
          index: i,
          success: true,
          priorityScore: priorityResult.priorityScore,
          priorityLevel: determinePriorityLevel(priorityResult.priorityScore),
          locationId,
          coordinates: {
            latitude: location.latitude,
            longitude: location.longitude
          }
        });
        
        // Rate limiting - wait 1 second between external API calls
        if (i < locations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        results.push({
          index: i,
          success: false,
          error: error.message,
          locationId
        });
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      totalLocations: locations.length,
      successfulCalculations: results.filter(r => r.success).length,
      failedCalculations: results.filter(r => !r.success).length,
      results: results,
      metadata: {
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Bulk calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Bulk calculation failed',
      details: error.message
    });
  }
});

/**
 * Get location priority information and service capabilities
 * GET /api/location-priority/info
 */
router.get('/info', (req, res) => {
  res.json({
    service: {
      name: 'CivicStack Location Priority Assessment',
      version: '2.1.0',
      description: 'AI-powered location analysis for civic complaint prioritization',
      status: 'operational'
    },
    features: [
      'Privacy-aware location analysis with configurable accuracy levels',
      'Google Places API integration for infrastructure mapping',
      'Dynamic priority scoring based on nearby critical facilities',
      'Emergency response optimization for urgent complaint types',
      'Multi-level privacy protection (exact/street/area)',
      'Real-time facility density analysis',
      'Complaint type-specific priority multipliers'
    ],
    privacyLevels: {
      exact: {
        description: 'Level 1: Exact coordinates (±5-10m) for urgent infrastructure issues',
        accuracy: '5-10 meters',
        useCases: ['Fallen electric poles/lines', 'Structural damage', 'Road waterlogging'],
        recommended: ['fallen_electric_pole', 'concrete_structure_damage', 'road_waterlogging']
      },
      street: {
        description: 'Level 2: Street-level accuracy (±25m) for general civic complaints',
        accuracy: '20-30 meters',
        useCases: ['Potholes', 'Fallen trees', 'Garbage dumping', 'General infrastructure'],
        recommended: ['pothole', 'fallen_tree', 'garbage_dumping']
      },
      area: {
        description: 'Level 3: Neighborhood-level (±150m) for privacy-conscious reporting',
        accuracy: '100-200 meters',
        useCases: ['General area complaints', 'Privacy-sensitive reports'],
        recommended: ['stray_cattle', 'others']
      }
    },
    complaintTypes: {
      urgent: {
        types: ['fallen_electric_pole', 'road_waterlogging'],
        multiplier: 1.5,
        recommendedPrivacy: 'exact',
        description: 'Critical infrastructure issues requiring immediate response'
      },
      safety: {
        types: ['pothole', 'concrete_structure_damage', 'fallen_tree'],
        multiplier: 1.2,
        recommendedPrivacy: 'street',
        description: 'Safety-related issues affecting public welfare'
      },
      general: {
        types: ['garbage_dumping', 'stray_cattle', 'others'],
        multiplier: 1.0,
        recommendedPrivacy: 'street',
        description: 'General civic maintenance and quality of life issues'
      }
    },
    priorityLevels: {
      CRITICAL: {
        range: '0.8-1.0',
        description: 'Immediate attention required - Emergency response',
        responseTime: '< 2 hours',
        color: '#FF4444'
      },
      HIGH: {
        range: '0.6-0.8', 
        description: 'High priority response needed',
        responseTime: '< 24 hours',
        color: '#FF8800'
      },
      MEDIUM: {
        range: '0.4-0.6',
        description: 'Standard priority handling',
        responseTime: '< 72 hours', 
        color: '#FFAA00'
      },
      LOW: {
        range: '0.2-0.4',
        description: 'Lower priority - routine maintenance',
        responseTime: '< 1 week',
        color: '#888888'
      },
      MINIMAL: {
        range: '0.0-0.2',
        description: 'Minimal priority - schedule as resources permit',
        responseTime: 'best effort',
        color: '#CCCCCC'
      }
    },
    apiLimits: {
      maxBulkLocations: 10,
      rateLimitPerMinute: 60,
      maxRetries: 3
    },
    integration: {
      supportedRegions: ['India'],
      dataProviders: ['Google Places API'],
      facilityTypes: ['hospital', 'school', 'police', 'fire_station', 'government', 'bank', 'pharmacy', 'transit_station'],
      coordinates: {
        format: 'decimal degrees',
        datum: 'WGS84'
      }
    }
  });
});

/**
 * Health check endpoint with comprehensive diagnostics
 * GET /api/location-priority/health
 */
router.get('/health', async (req, res) => {
  const healthData = {
    status: 'unknown',
    service: 'Location Priority Service',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    checks: {}
  };
  
  try {
    // Test Google Places API connectivity
    console.log('🏥 Running health check...');
    const testStartTime = Date.now();
    
    const testResult = await locationPriorityService.calculateLocationPriority(
      28.6139, // New Delhi coordinates
      77.2090,
      'pothole',
      { privacyLevel: 'street', radiusM: 25, precision: 'street' }
    );
    
    const testDuration = Date.now() - testStartTime;
    const facilitiesFound = countFacilities(testResult.facilityAnalysis);

    if (testResult.error) {
      healthData.status = 'unhealthy';
      healthData.checks = {
        googlePlacesApi: {
          status: 'error',
          responseTime: `${testDuration}ms`,
          error: testResult.fallbackReason || testResult.error,
          lastChecked: new Date().toISOString()
        },
        locationService: {
          status: 'degraded',
          version: '2.1.0'
        }
      };
      return res.status(503).json(healthData);
    }
    
    healthData.status = 'healthy';
    healthData.checks = {
      googlePlacesApi: {
        status: 'connected',
        responseTime: `${testDuration}ms`,
        lastTestScore: testResult.priorityScore,
        facilitiesFound
      },
      locationService: {
        status: 'operational',
        version: '2.1.0'
      },
      database: {
        status: 'not_applicable',
        note: 'Service uses external APIs only'
      }
    };
    
    res.status(200).json(healthData);
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    healthData.status = 'unhealthy';
    healthData.checks = {
      googlePlacesApi: {
        status: 'error',
        error: error.message,
        lastChecked: new Date().toISOString()
      },
      locationService: {
        status: 'degraded',
        error: 'API connectivity issues'
      }
    };
    
    res.status(503).json(healthData);
  }
});

/**
 * Get service metrics and statistics
 * GET /api/location-priority/metrics
 */
router.get('/metrics', (req, res) => {
  const { totalRequests, successfulRequests, failedRequests, totalDurationMs, recentDurationsMs, priorityCounts, complaintTypeCounts, privacyLevelCounts } = serviceMetrics;
  const sorted = [...recentDurationsMs].sort((a, b) => a - b);
  const avgMs = totalRequests > 0 ? Math.round(totalDurationMs / totalRequests) : 0;
  const successRate = totalRequests > 0 ? ((successfulRequests / totalRequests) * 100).toFixed(1) : '100.0';
  const errorRate = totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(1) : '0.0';

  const topComplaintTypes = Object.entries(complaintTypeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalPrivacy = privacyLevelCounts.exact + privacyLevelCounts.street + privacyLevelCounts.area;
  const pct = (n) => totalPrivacy > 0 ? `${Math.round((n / totalPrivacy) * 100)}%` : '0%';

  res.json({
    service: 'Location Priority Metrics',
    period: 'since_startup',
    metrics: {
      totalRequests,
      averageResponseTime: `${avgMs}ms`,
      successRate: `${successRate}%`,
      criticalPriorityCount: priorityCounts.CRITICAL,
      highPriorityCount: priorityCounts.HIGH,
      mediumPriorityCount: priorityCounts.MEDIUM,
      lowPriorityCount: priorityCounts.LOW,
      minimalPriorityCount: priorityCounts.MINIMAL
    },
    performance: {
      p50ResponseTime: `${getPercentile(sorted, 50)}ms`,
      p95ResponseTime: `${getPercentile(sorted, 95)}ms`,
      p99ResponseTime: `${getPercentile(sorted, 99)}ms`,
      errorRate: `${errorRate}%`
    },
    usage: {
      topComplaintTypes,
      privacyLevelDistribution: {
        exact: pct(privacyLevelCounts.exact),
        street: pct(privacyLevelCounts.street),
        area: pct(privacyLevelCounts.area)
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Helper Functions

/**
 * Validate input for location priority calculation
 */
function validateCalculationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      isValid: false,
      error: 'Request payload must be a JSON object',
      code: 'INVALID_INPUT'
    };
  }

  console.log('🔍 Validating input:', JSON.stringify(input, null, 2));
  const { latitude, longitude, complaintType, locationMeta } = input;
  
  // Required fields validation (use explicit null/undefined checks so 0 is not treated as missing)
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    console.log('❌ Missing coordinates validation failed');
    return {
      isValid: false,
      error: 'Latitude and longitude are required',
      code: 'MISSING_COORDINATES'
    };
  }
  
  if (!complaintType || typeof complaintType !== 'string') {
    console.log('❌ Missing complaint type validation failed');
    return {
      isValid: false,
      error: 'Complaint type is required',
      code: 'MISSING_COMPLAINT_TYPE'
    };
  }
  
  // Coordinate validation
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    return {
      isValid: false,
      error: 'Coordinates must be numeric values',
      code: 'INVALID_COORDINATE_TYPE'
    };
  }
  
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return {
      isValid: false,
      error: 'Coordinates are outside valid range',
      code: 'INVALID_COORDINATE_RANGE'
    };
  }
  
  // India service area validation
  const indiaBounds = { north: 37.6, south: 6.4, east: 97.25, west: 68.1 };
  if (latitude < indiaBounds.south || latitude > indiaBounds.north ||
      longitude < indiaBounds.west || longitude > indiaBounds.east) {
    return {
      isValid: false,
      error: 'Location is outside service area (India)',
      code: 'OUTSIDE_SERVICE_AREA'
    };
  }
  
  // Complaint type validation - kept in sync with the civic issue classes the
  // CityZen SAM3 image workflow can detect (services/imageAnalysisService.js
  // CIVIC_ISSUE_LABELS on the backend).
  const validComplaintTypes = [
    'pothole', 'fallen_tree', 'garbage_dumping', 'stray_cattle',
    'fallen_electric_pole', 'concrete_structure_damage', 'road_waterlogging',
    'others'
  ];
  
  console.log('🔍 Checking complaint type:', complaintType, 'in valid types:', validComplaintTypes);
  if (!validComplaintTypes.includes(complaintType)) {
    console.log('❌ Invalid complaint type validation failed');
    return {
      isValid: false,
      error: `Invalid complaint type. Supported types: ${validComplaintTypes.join(', ')}`,
      code: 'INVALID_COMPLAINT_TYPE'
    };
  }
  
  // Location metadata validation
  if (locationMeta !== undefined && locationMeta !== null) {
    if (typeof locationMeta !== 'object' || Array.isArray(locationMeta)) {
      return {
        isValid: false,
        error: 'locationMeta must be an object',
        code: 'INVALID_LOCATION_META'
      };
    }

    const validPrivacyLevels = ['exact', 'street', 'area'];
    if (locationMeta.privacyLevel && !validPrivacyLevels.includes(locationMeta.privacyLevel)) {
      return {
        isValid: false,
        error: `Invalid privacy level. Supported levels: ${validPrivacyLevels.join(', ')}`,
        code: 'INVALID_PRIVACY_LEVEL'
      };
    }
    
    if (locationMeta.radiusM !== undefined && locationMeta.radiusM !== null &&
        (typeof locationMeta.radiusM !== 'number' || !Number.isFinite(locationMeta.radiusM) || locationMeta.radiusM < 0)) {
      return {
        isValid: false,
        error: 'Radius must be a non-negative number',
        code: 'INVALID_RADIUS'
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Determine priority level based on numerical score. Delegates to
 * services/priorityConfig.js so this file, LocationPriorityService, and
 * routes/complaints.js all use the exact same thresholds (previously this
 * used a different 4-band scale than LocationPriorityService's 5-band one).
 */
function determinePriorityLevel(score) {
  return priorityConfig.getPriorityLevel(score);
}

/**
 * Handle calculation errors with appropriate responses
 */
function handleCalculationError(error, res) {
  // API key or authentication errors
  if (error.message.includes('API key') || error.message.includes('authentication')) {
    return res.status(503).json({
      success: false,
      error: 'Location service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      details: 'External API configuration issue',
      retryAfter: 300 // 5 minutes
    });
  }
  
  // Rate limiting errors
  if (error.message.includes('rate limit') || error.message.includes('quota') || 
      error.message.includes('OVER_QUERY_LIMIT')) {
    return res.status(429).json({
      success: false,
      error: 'Service rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      details: 'Please try again in a few moments',
      retryAfter: 60 // 1 minute
    });
  }
  
  // Network connectivity errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return res.status(503).json({
      success: false,
      error: 'External service connectivity issue',
      code: 'CONNECTIVITY_ERROR',
      details: 'Unable to reach location data provider',
      retryAfter: 120 // 2 minutes
    });
  }
  
  // Generic server errors
  res.status(500).json({
    success: false,
    error: 'Location priority calculation failed',
    code: 'CALCULATION_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
}

/**
 * Calculate comprehensive priority score combining infrastructure and image validation
 * POST /api/location-priority/comprehensive
 * 
 * Request Body:
 * {
 *   "latitude": number,
 *   "longitude": number,
 *   "complaintType": string,
 *   "locationMeta": {
 *     "privacyLevel": string,
 *     "radiusM": number
 *   },
 *   "imageAnalysis": {
 *     "confidence": number,
 *     "modelConfidence": number
 *   },
 *   "complaintData": {
 *     "created_at": string,
 *     "votes": number,
 *     "status": string
 *   }
 * }
 */
router.post('/comprehensive', async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('🧠 Comprehensive priority calculation request:', req.body);
    
    const { 
      latitude, 
      longitude, 
      imageAnalysis, 
      complaintData = {}, 
      complaintType, 
      locationMeta,
      description,
      imageUrl,
      votes,
      status
    } = req.body || {};
    
    const parsedLat = latitude === undefined || latitude === null || latitude === '' ? NaN : Number(latitude);
    const parsedLon = longitude === undefined || longitude === null || longitude === '' ? NaN : Number(longitude);

    // Input validation for latitude and longitude
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon) ||
        parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) {
      recordMetric({ success: false, durationMs: Date.now() - startTime });
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates',
        code: 'INVALID_COORDINATES',
        timestamp: new Date().toISOString()
      });
    }

    const safeComplaintData = (complaintData && typeof complaintData === 'object' && !Array.isArray(complaintData))
      ? complaintData
      : {};
    const effectiveComplaintType = complaintType || safeComplaintData.complaintType;
    const effectiveLocationMeta = locationMeta || safeComplaintData.locationMeta;
    const effectiveDescription = description !== undefined ? description : safeComplaintData.description;
    const effectiveImageUrl = imageUrl !== undefined ? imageUrl : safeComplaintData.imageUrl;
    const effectiveVotes = votes !== undefined ? votes : (safeComplaintData.votes ?? 0);
    const effectiveStatus = status || safeComplaintData.status || 'pending';

    // Calculate comprehensive priority score
    const priorityResult = await locationPriorityService.calculateComprehensivePriority(
      parsedLat,
      parsedLon,
      imageAnalysis || {},
      {
        ...safeComplaintData,
        complaintType: effectiveComplaintType,
        locationMeta: effectiveLocationMeta,
        description: effectiveDescription,
        imageUrl: effectiveImageUrl,
        votes: effectiveVotes,
        status: effectiveStatus
      }
    );
    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Comprehensive priority calculation completed in ${processingTime}ms`);

    recordMetric({
      success: !priorityResult.error,
      durationMs: processingTime,
      priorityLevel: priorityResult.priorityLevel,
      complaintType: effectiveComplaintType,
      privacyLevel: effectiveLocationMeta?.privacyLevel,
    });

    const createdAtMs = safeComplaintData.created_at ? new Date(safeComplaintData.created_at).getTime() : NaN;
    const complaintAge = Number.isFinite(createdAtMs)
      ? Math.max(0, Math.round((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)))
      : null;
    
    // Format response
    const response = {
      success: true,
      priorityScore: priorityResult.priorityScore,
      priorityLevel: priorityResult.priorityLevel,
      reasoning: priorityResult.reasoning,
      
      // Breakdown of score components
      breakdown: {
        infrastructureScore: priorityResult.breakdown?.infrastructureScore ?? 0,
        imageValidationScore: priorityResult.breakdown?.imageValidationScore ?? 0,
        emotionScore: priorityResult.breakdown?.emotionScore ?? 0,
        voteScore: priorityResult.breakdown?.voteScore ?? 0,
        statusMultiplier: priorityResult.breakdown?.statusMultiplier ?? 1
      },
      
      // Infrastructure details
      infrastructure: {
        totalFacilities: priorityResult.totalFacilities || 0,
        facilityAnalysis: priorityResult.facilityAnalysis || {}
      },
      
      // Location and image details
      details: {
        coordinates: { 
          latitude: parsedLat, 
          longitude: parsedLon 
        },
        imageConfidence: priorityResult.imageConfidence ?? 0,
        complaintAge,
        votes: effectiveVotes,
        status: effectiveStatus
      },
      
      metadata: {
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        apiVersion: 'v2'
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error in comprehensive priority calculation:', error);
    recordMetric({ success: false, durationMs: Date.now() - startTime });
    
    // Generic server errors
    res.status(500).json({
      success: false,
      error: 'Comprehensive priority calculation failed',
      code: 'CALCULATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
