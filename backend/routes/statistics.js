const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

function summarizeStatuses(rows) {
  let pending = 0;
  let inProgress = 0;
  let resolved = 0;

  for (const c of rows) {
    const status = c.status?.toLowerCase().trim();
    if (status === 'pending') pending += 1;
    else if (status === 'in_progress') inProgress += 1;
    else if (status === 'completed' || status === 'resolved') resolved += 1;
  }

  return { pending, inProgress, resolved };
}

/**
 * Get detailed statistics breakdown for debugging
 * GET /api/statistics/debug
 */
router.get('/debug', async (req, res) => {
  try {
    console.log('🔍 Debug statistics request');
    
    const { data, error } = await supabase
      .from('complaints')
      .select('id, status, title')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(error.message);
    }

    const rows = data || [];
    const includeDetails = process.env.NODE_ENV !== 'production' || req.user?.userType === 'admin';
    
    // Count status occurrences
    const statusCounts = {};
    const statusDetails = {};
    
    rows.forEach(complaint => {
      const status = complaint.status || 'null';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      if (includeDetails) {
        if (!statusDetails[status]) {
          statusDetails[status] = [];
        }
        statusDetails[status].push({
          id: complaint.id?.substring(0, 8),
          title: complaint.title?.substring(0, 30)
        });
      }
    });
    
    console.log('📊 Status breakdown:', statusCounts);
    
    res.json({
      success: true,
      total: rows.length,
      statusCounts,
      ...(includeDetails ? { statusDetails } : {}),
      frontendFiltering: summarizeStatuses(rows)
    });
  } catch (error) {
    console.error('Debug statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get basic statistics summary
 * GET /api/statistics/summary
 */
router.get('/summary', async (req, res) => {
  try {
    console.log('📊 Getting statistics summary');
    
    const { data, error } = await supabase
      .from('complaints')
      .select('status')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(error.message);
    }

    const rows = data || [];
    const { pending, inProgress, resolved } = summarizeStatuses(rows);
    
    res.json({
      success: true,
      total: rows.length,
      pending,
      inProgress,
      resolved
    });
  } catch (error) {
    console.error('Statistics summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
