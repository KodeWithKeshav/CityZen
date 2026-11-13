const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeUserType } = require('../middleware/auth');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

// Require authenticated admin for all routes in this router
router.use(
  (req, res, next) => (req.user === undefined ? authenticateUser(req, res, next) : next()),
  authorizeUserType(['admin'])
);

/**
 * Update complaint status
 * PUT /api/admin/complaints/:id/status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, adminId } = req.body;
    
    console.log(`🔄 Admin updating complaint ${id} status to: ${status}`);
    
    // Validate input
    if (!id || typeof status !== 'string' || !status.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Complaint ID and status are required'
      });
    }
    
    // Validate status value
    const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value. Must be one of: pending, in_progress, resolved, rejected'
      });
    }
    
    const supabase = req.app.get('supabase');

    const { data: existingComplaint, error: fetchError } = await supabase
      .from('complaints')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existingComplaint) {
      if (fetchError?.code === '22P02') {
        return res.status(400).json({
          success: false,
          error: 'Invalid complaint ID format'
        });
      }
      return res.status(404).json({
        success: false,
        error: 'Complaint not found'
      });
    }

    const nowIso = new Date().toISOString();

    // Update complaint status
    const updateData = {
      status,
      updated_at: nowIso,
      resolved_at: status === 'resolved' ? nowIso : null
    };

    if (notes !== undefined) {
      updateData.resolution_notes = notes;
    }

    if (adminId !== undefined) {
      if (adminId === null || adminId === '') {
        updateData.assigned_admin_id = null;
      } else if (isValidUuid(adminId)) {
        updateData.assigned_admin_id = adminId.trim();
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid adminId format'
        });
      }
    } else if (isValidUuid(req.user?.id)) {
      updateData.assigned_admin_id = req.user.id;
    }
    
    const { data, error } = await supabase
      .from('complaints')
      .update(updateData)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('❌ Error updating complaint status:', error);
      const statusCode = error.code === '22P02' ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: statusCode === 400 ? 'Invalid complaint ID format' : 'Failed to update complaint status',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found'
      });
    }
    
    console.log(`✅ Complaint ${id} status updated to ${status}`);

    // Log status change to complaint_updates so citizen/admin timelines stay in sync
    const { error: updateLogError } = await supabase
      .from('complaint_updates')
      .insert({
        complaint_id: id,
        updated_by_id: isValidUuid(req.user?.id) ? req.user.id : null,
        old_status: existingComplaint.status || null,
        new_status: status,
        update_notes: (typeof notes === 'string' && notes.trim()) ? notes.trim() : `Status changed to ${status}`,
        created_at: nowIso
      });

    if (updateLogError) {
      console.warn('⚠️ Failed to log status update to complaint_updates:', updateLogError.message);
    }

    // Return updated complaint
    res.json({
      success: true,
      message: `Complaint status updated to ${status}`,
      data: data[0]
    });
    
  } catch (error) {
    console.error('❌ Admin update complaint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update complaint status',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

/**
 * Get all complaints for admin dashboard
 * GET /api/admin/complaints
 */
router.get('/', async (req, res) => {
  try {
    console.log('📋 Admin fetching all complaints');
    
    // Query parameters for filtering
    const { status, priority, category, days, flagged } = req.query;

    const supabase = req.app.get('supabase');
    let query = supabase.from('complaints').select('*');

    // Apply filters if provided
    if (typeof status === 'string' && status.trim()) {
      query = query.eq('status', status.trim());
    }

    // Complaints the model-based authenticity check flagged for human
    // review (see services/TextAuthenticityService.js
    // analyzeTextAuthenticityBlended) - submission already succeeded for
    // these, they just need an admin look.
    if (flagged === 'true') {
      query = query.eq('content_flagged', true);
    }
    
    if (typeof priority === 'string' && priority.trim()) {
      // Support 0-1 (priorityConfig.js), 0-10, and legacy 0-100 scales
      const priorityFilters = {
        LOW: 'and(priority_score.gte.0,priority_score.lt.0.4),and(priority_score.gt.1,priority_score.lt.4),and(priority_score.gt.10,priority_score.lt.40)',
        MEDIUM: 'and(priority_score.gte.0.4,priority_score.lt.0.6),and(priority_score.gte.4,priority_score.lt.6),and(priority_score.gte.40,priority_score.lt.60)',
        HIGH: 'and(priority_score.gte.0.6,priority_score.lt.0.8),and(priority_score.gte.6,priority_score.lt.8),and(priority_score.gte.60,priority_score.lt.80)',
        CRITICAL: 'and(priority_score.gte.0.8,priority_score.lte.1),and(priority_score.gte.8,priority_score.lte.10),priority_score.gte.80'
      };
      
      const orFilter = priorityFilters[priority.trim().toUpperCase()];
      if (orFilter) {
        query = query.or(orFilter);
      }
    }
    
    if (typeof category === 'string' && category.trim()) {
      query = query.eq('category', category.trim());
    }
    
    if (days !== undefined && days !== '') {
      const daysNum = parseInt(days, 10);
      if (!Number.isFinite(daysNum) || daysNum <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid days parameter; must be a positive integer'
        });
      }
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - daysNum);
      query = query.gte('created_at', daysAgo.toISOString());
    }
    
    // Order by priority score (highest first) and created date (newest first)
    query = query.order('priority_score', { ascending: false }).order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching complaints:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch complaints',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
    
    console.log(`✅ Fetched ${data?.length || 0} complaints for admin dashboard`);
    
    // Calculate statistics
    const statistics = calculateComplaintStatistics(data || []);
    
    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      statistics
    });
    
  } catch (error) {
    console.error('❌ Admin fetch complaints error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch complaints',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

/**
 * Calculate complaint statistics for admin dashboard
 */
function calculateComplaintStatistics(complaints) {
  const total = complaints.length;
  
  // Count by status
  const byStatus = complaints.reduce((acc, complaint) => {
    const status = complaint.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  
  // Calculate resolution rate
  const resolved = byStatus.resolved || 0;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  
  // Calculate average resolution time (in days)
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved' && c.created_at && c.resolved_at);
  let avgResolutionDays = 0;
  
  if (resolvedComplaints.length > 0) {
    let validCount = 0;
    const totalDays = resolvedComplaints.reduce((sum, complaint) => {
      const created = new Date(complaint.created_at);
      const resolvedAt = new Date(complaint.resolved_at);
      if (Number.isNaN(created.getTime()) || Number.isNaN(resolvedAt.getTime())) {
        return sum;
      }
      validCount++;
      return sum + Math.max(0, (resolvedAt - created) / (1000 * 60 * 60 * 24));
    }, 0);
    
    avgResolutionDays = validCount > 0 ? Math.round(totalDays / validCount) : 0;
  }
  
  // Count by category
  const byCategory = complaints.reduce((acc, complaint) => {
    const category = complaint.category || 'uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  
  // Get top categories
  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));
  
  return {
    total,
    byStatus,
    resolved,
    pending: byStatus.pending || 0,
    inProgress: byStatus.in_progress || 0,
    rejected: byStatus.rejected || 0,
    resolutionRate,
    avgResolutionDays,
    byCategory,
    topCategories
  };
}

/**
 * Get complaint details
 * GET /api/admin/complaints/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Admin fetching complaint details for ID: ${id}`);
    
    const supabase = req.app.get('supabase');
    let data;
    const { data: cWithUser, error: cErr } = await supabase
      .from('complaints')
      .select(`
        *,
        users:user_id (id, full_name, email, phone_number)
      `)
      .eq('id', id)
      .single();

    if (cErr || !cWithUser) {
      const { data: cBasic, error: basicErr } = await supabase
        .from('complaints')
        .select('*')
        .eq('id', id)
        .single();
      if (basicErr || !cBasic) {
        const finalErr = basicErr || cErr;
        if (finalErr?.code === 'PGRST116' || !finalErr) {
          return res.status(404).json({
            success: false,
            error: 'Complaint not found'
          });
        }
        if (finalErr?.code === '22P02') {
          return res.status(400).json({
            success: false,
            error: 'Invalid complaint ID format'
          });
        }
        console.error('❌ Error fetching complaint details:', finalErr);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch complaint details',
          ...(process.env.NODE_ENV === 'development' && { details: finalErr.message })
        });
      }
      data = cBasic;
    } else {
      data = cWithUser;
    }

    if (!data.users && data.user_id) {
      const { data: u } = await supabase
        .from('users')
        .select('id, full_name, email, phone_number')
        .eq('id', data.user_id)
        .single();
      if (u) data.users = u;
    }

    const regName = data.users?.full_name || data.user_name || 'Verified Citizen';
    data.users = data.users
      ? { ...data.users, full_name: data.users.full_name || regName }
      : { full_name: regName, email: null };
    data.user = data.users;
    data.user_name = regName;
    data.citizenName = regName;

    console.log(`✅ Fetched details for complaint ${id} (registered by: ${regName})`);

    res.json({
      success: true,
      data
    });
    
  } catch (error) {
    console.error('❌ Admin fetch complaint details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch complaint details',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

module.exports = router;
