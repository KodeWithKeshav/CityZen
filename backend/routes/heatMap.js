const express = require('express');
const router = express.Router();
const HeatMapService = require('../services/HeatMapService');
const { supabase } = require('../config/supabase');

const heatMapService = new HeatMapService();

function parsePositiveDays(daysParam) {
  if (!daysParam || daysParam === 'all') return null;
  const parsed = Number.parseInt(daysParam, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * GET /api/heat-map/data
 * Get heat map data for visualization
 */
router.get('/data', async (req, res) => {
  try {
    console.log('🗺️ Heat map data requested');
    
    const filters = {
      dateRange: parsePositiveDays(req.query.days),
      status: typeof req.query.status === 'string' && req.query.status.trim() ? req.query.status.trim() : undefined,
      complaintType: typeof req.query.type === 'string' && req.query.type.trim() ? req.query.type.trim() : undefined
    };

    console.log('🔍 Filters applied:', filters);

    const heatMapData = await heatMapService.getComplaintHeatMapData(filters);
    
    console.log(`✅ Returning ${heatMapData.points.length} complaint points`);
    
    res.json({
      success: true,
      data: heatMapData,
      filters: filters,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Heat map data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch heat map data',
      message: error.message
    });
  }
});

/**
 * GET /api/heat-map/statistics
 * Get complaint statistics for dashboard
 */
router.get('/statistics', async (req, res) => {
  try {
    console.log('📊 Statistics requested');
    
    const timeRange = parsePositiveDays(req.query.days);
    const heatMapData = await heatMapService.getComplaintHeatMapData({ dateRange: timeRange });
    const statistics = heatMapData.statistics || {
      total: 0,
      resolved: 0,
      active: 0,
      pending: 0,
      resolutionRate: 0,
      averageResolutionDays: 0,
      byType: {},
      byPriority: {}
    };
    
    console.log('✅ Statistics calculated:', {
      total: statistics.total,
      resolved: statistics.resolved,
      resolutionRate: statistics.resolutionRate
    });
    
    res.json({
      success: true,
      data: statistics,
      timeRange: timeRange,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/heat-map/filtered
 * Get filtered heat map data
 */
router.get('/filtered', async (req, res) => {
  try {
    console.log('🔍 Filtered heat map data requested');
    
    const minLat = parseOptionalFiniteNumber(req.query.minLat);
    const maxLat = parseOptionalFiniteNumber(req.query.maxLat);
    const minLng = parseOptionalFiniteNumber(req.query.minLng);
    const maxLng = parseOptionalFiniteNumber(req.query.maxLng);

    if ([minLat, maxLat, minLng, maxLng].some(v => Number.isNaN(v))) {
      return res.status(400).json({
        success: false,
        error: 'Bounding box coordinates (minLat, maxLat, minLng, maxLng) must be valid numbers'
      });
    }

    const filters = {
      dateRange: parsePositiveDays(req.query.days),
      status: typeof req.query.status === 'string' && req.query.status.trim() ? req.query.status.trim() : undefined,
      complaintType: typeof req.query.type === 'string' && req.query.type.trim() ? req.query.type.trim() : undefined,
      priorityLevel: typeof req.query.priority === 'string' && req.query.priority.trim() ? req.query.priority.trim().toUpperCase() : undefined,
      minLat,
      maxLat,
      minLng,
      maxLng
    };

    // Remove undefined values (do not use global isNaN, which treats strings as NaN)
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    console.log('🔍 Applied filters:', filters);

    const baseData = await heatMapService.getComplaintHeatMapData({
      dateRange: filters.dateRange ?? null,
      status: filters.status,
      complaintType: filters.complaintType
    });

    const filteredPoints = (baseData.points || []).filter(point => {
      if (filters.priorityLevel && point.priorityLevel !== filters.priorityLevel) return false;
      if (filters.minLat !== undefined && point.lat < filters.minLat) return false;
      if (filters.maxLat !== undefined && point.lat > filters.maxLat) return false;
      if (filters.minLng !== undefined && point.lng < filters.minLng) return false;
      if (filters.maxLng !== undefined && point.lng > filters.maxLng) return false;
      return true;
    });

    const heatMapData = {
      ...baseData,
      points: filteredPoints,
      statistics: heatMapService.calculateHeatMapStatistics(filteredPoints),
      totalComplaints: filteredPoints.length
    };
    
    console.log(`✅ Returning ${heatMapData.points.length} filtered points`);
    
    res.json({
      success: true,
      data: heatMapData,
      filters: filters,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Filtered heat map error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filtered heat map data',
      message: error.message
    });
  }
});

/**
 * POST /api/heat-map/refresh
 * Refresh heat map data (force database update)
 */
router.post('/refresh', async (req, res) => {
  try {
    console.log('🔄 Heat map refresh requested');
    
    // Force refresh by fetching fresh data
    const heatMapData = await heatMapService.getComplaintHeatMapData({ 
      dateRange: 30,
      forceRefresh: true 
    });
    
    console.log(`✅ Heat map refreshed with ${heatMapData.points.length} points`);
    
    res.json({
      success: true,
      message: 'Heat map data refreshed successfully',
      data: heatMapData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Heat map refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh heat map data',
      message: error.message
    });
  }
});

/**
 * GET /api/heat-map/complaint/:id
 * Get specific complaint details for popup
 */
router.get('/complaint/:id', async (req, res) => {
  try {
    const complaintId = req.params.id?.trim();
    if (!complaintId) {
      return res.status(400).json({
        success: false,
        error: 'Complaint ID is required'
      });
    }

    console.log(`🔍 Complaint details requested for ID: ${complaintId}`);
    
    const { data: complaint, error } = await supabase
      .from('complaints')
      .select('id, title, description, category, status, priority_score, location_address, location_latitude, location_longitude, vote_count, image_urls, created_at, resolved_at')
      .eq('id', complaintId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...complaint,
        priorityLevel: heatMapService.getPriorityLevel(complaint.priority_score),
        color: heatMapService.getStatusColor(complaint.status)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Complaint details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch complaint details',
      message: error.message
    });
  }
});

module.exports = router;
