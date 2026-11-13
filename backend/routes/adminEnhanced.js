const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeUserType } = require('../middleware/auth');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function sanitizeSearchTerm(term) {
  if (typeof term !== 'string') return '';
  return term.trim().replace(/[,()\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parsePagination(page, limit) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = parseInt(limit, 10);
  const limitNum = Math.min(100, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 20));
  return { pageNum, limitNum, offset: (pageNum - 1) * limitNum };
}

function normalizePriorityTo100(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  if (num > 0 && num <= 1) return Math.round(num * 100);
  if (num > 1 && num <= 10) return Math.round(num * 10);
  return Math.min(100, Math.max(0, Math.round(num)));
}

// Require authenticated admin for all enhanced admin routes
router.use(
  (req, res, next) => (req.user === undefined ? authenticateUser(req, res, next) : next()),
  authorizeUserType(['admin'])
);

// ============================================================================
// ENHANCED ADMIN DASHBOARD ROUTES
// ============================================================================

// Get comprehensive dashboard overview
router.get('/dashboard/overview', async (req, res) => {
  try {
    console.log('📊 Loading comprehensive admin dashboard...');
    const supabase = req.app.get('supabase');
    
    // Get complaint statistics with stages
    const { data: complaints, error: complaintsError } = await supabase
      .from('complaints')
      .select(`
        *,
        complaint_stages (
          stage_number,
          stage_name,
          stage_status,
          completed_at
        ),
        users:user_id (
          full_name,
          email
        )
      `);
    
    // Get user statistics
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, user_type, created_at, is_active');
    
    // Get top priority complaints
    const { data: priorityComplaints, error: priorityError } = await supabase
      .from('complaints')
      .select(`
        *,
        users:user_id (full_name, email),
        complaint_stages (
          stage_number,
          stage_name,
          stage_status
        )
      `)
      .order('priority_score', { ascending: false })
      .limit(10);
    
    // Get location-based hotspots (optional RPC - log and fall back to [] if unavailable)
    const { data: locationHotspots, error: locationError } = await supabase
      .rpc('get_location_hotspots', { radius_km: 1, min_complaints: 2 });
    
    if (complaintsError || usersError || priorityError || locationError) {
      console.error('Dashboard data error:', {
        complaintsError,
        usersError,
        priorityError,
        locationError
      });
    }

    if (complaintsError || usersError || priorityError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to load dashboard overview'
      });
    }
    
    const dashboardData = {
      overview: calculateDashboardOverview(complaints || [], users || []),
      topPriorityComplaints: priorityComplaints || [],
      locationHotspots: locationHotspots || [],
      recentActivity: await getRecentActivity(supabase),
      stageProgress: calculateStageProgress(complaints || []),
      costAnalysis: calculateCostAnalysis(complaints || [])
    };
    
    res.json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard overview'
    });
  }
});

// Get priority queue with search and filtering
router.get('/complaints/priority-queue', async (req, res) => {
  try {
    const { search, location, category, status, page = 1, limit = 20 } = req.query;
    const { pageNum, limitNum, offset } = parsePagination(page, limit);
    const supabase = req.app.get('supabase');
    
    let query = supabase
      .from('complaints')
      .select(`
        *,
        users:user_id (full_name, email, phone_number),
        complaint_stages (
          stage_number,
          stage_name,
          stage_status,
          assigned_officer_id,
          assigned_contractor_id,
          started_at,
          expected_completion,
          officers (name, department),
          contractors (name, company_name)
        )
      `, { count: 'exact' });
    
    // Apply filters
    const cleanSearch = sanitizeSearchTerm(search);
    if (cleanSearch) {
      query = query.or(`title.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%,location_address.ilike.%${cleanSearch}%`);
    }
    
    if (typeof location === 'string' && location.trim()) {
      query = query.ilike('location_address', `%${location.trim()}%`);
    }
    
    if (typeof category === 'string' && category.trim()) {
      query = query.eq('category', category.trim());
    }
    
    if (typeof status === 'string' && status.trim()) {
      query = query.eq('status', status.trim());
    }
    
    // Order by priority score and creation date
    query = query.order('priority_score', { ascending: false })
                 .order('created_at', { ascending: true });
    
    // Pagination
    query = query.range(offset, offset + limitNum - 1);
    
    const { data: complaints, error, count } = await query;
    
    if (error) {
      console.error('Priority queue error:', error);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const total = count || 0;
    
    res.json({
      success: true,
      data: {
        complaints: complaints || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.max(1, Math.ceil(total / limitNum))
        }
      }
    });
    
  } catch (error) {
    console.error('Priority queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch priority queue'
    });
  }
});

// Get citizen management data
router.get('/citizens', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const { pageNum, limitNum, offset } = parsePagination(page, limit);
    const supabase = req.app.get('supabase');
    
    let query = supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        phone_number,
        user_type,
        address,
        is_active,
        created_at,
        updated_at,
        last_login,
        complaints (
          id,
          title,
          status,
          priority_score,
          created_at
        )
      `, { count: 'exact' })
      .eq('user_type', 'citizen');
    
    const cleanSearch = sanitizeSearchTerm(search);
    if (cleanSearch) {
      query = query.or(`full_name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%,phone_number.ilike.%${cleanSearch}%`);
    }
    
    query = query.order('created_at', { ascending: false });
    
    // Pagination
    query = query.range(offset, offset + limitNum - 1);
    
    const { data: citizens, error, count } = await query;
    
    if (error) {
      console.error('Citizens fetch error:', error);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const total = count || 0;
    
    res.json({
      success: true,
      data: {
        citizens: citizens || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.max(1, Math.ceil(total / limitNum))
        }
      }
    });
    
  } catch (error) {
    console.error('Citizens management error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch citizens data'
    });
  }
});

// Update complaint stage
router.put('/complaints/:complaintId/stages/:stageId', async (req, res) => {
  try {
    const { complaintId, stageId } = req.params;
    const { 
      stage_status,
      assigned_officer_id,
      assigned_contractor_id,
      admin_notes,
      estimated_cost,
      expected_completion 
    } = req.body;

    const validStageStatuses = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'];
    if (!stage_status || !validStageStatuses.includes(stage_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid stage_status. Must be one of: ${validStageStatuses.join(', ')}`
      });
    }
    
    const supabase = req.app.get('supabase');

    // Fetch existing stage to preserve started_at / capture old_status
    const { data: existingStage, error: fetchError } = await supabase
      .from('complaint_stages')
      .select('*')
      .eq('id', stageId)
      .eq('complaint_id', complaintId)
      .single();

    if (fetchError || !existingStage) {
      return res.status(404).json({
        success: false,
        message: 'Complaint stage not found'
      });
    }

    const updatePayload = {
      stage_status,
      updated_at: new Date().toISOString()
    };

    if (assigned_officer_id !== undefined) {
      if (assigned_officer_id === null || assigned_officer_id === '') {
        updatePayload.assigned_officer_id = null;
      } else if (isValidUuid(assigned_officer_id)) {
        updatePayload.assigned_officer_id = assigned_officer_id.trim();
      } else {
        return res.status(400).json({ success: false, message: 'Invalid assigned_officer_id format' });
      }
    }

    if (assigned_contractor_id !== undefined) {
      if (assigned_contractor_id === null || assigned_contractor_id === '') {
        updatePayload.assigned_contractor_id = null;
      } else if (isValidUuid(assigned_contractor_id)) {
        updatePayload.assigned_contractor_id = assigned_contractor_id.trim();
      } else {
        return res.status(400).json({ success: false, message: 'Invalid assigned_contractor_id format' });
      }
    }

    if (admin_notes !== undefined) {
      updatePayload.admin_notes = admin_notes;
    }

    if (estimated_cost !== undefined) {
      if (estimated_cost === null || estimated_cost === '') {
        updatePayload.estimated_cost = null;
      } else {
        const parsedCost = Number(estimated_cost);
        if (!Number.isFinite(parsedCost) || parsedCost < 0) {
          return res.status(400).json({ success: false, message: 'Invalid estimated_cost value' });
        }
        updatePayload.estimated_cost = parsedCost;
      }
    }

    if (expected_completion !== undefined) {
      updatePayload.expected_completion = expected_completion || null;
    }

    if (stage_status === 'in_progress' && !existingStage.started_at) {
      updatePayload.started_at = new Date().toISOString();
    }
    if (stage_status === 'completed') {
      updatePayload.completed_at = new Date().toISOString();
    } else if (stage_status === 'pending' || stage_status === 'in_progress') {
      updatePayload.completed_at = null;
    }
    
    // Update the stage
    const { data: updatedStage, error: stageError } = await supabase
      .from('complaint_stages')
      .update(updatePayload)
      .eq('id', stageId)
      .eq('complaint_id', complaintId)
      .select();
    
    if (stageError) {
      console.error('Stage update error:', stageError);
      return res.status(400).json({
        success: false,
        message: stageError.message
      });
    }

    if (!updatedStage || updatedStage.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint stage not found'
      });
    }
    
    // Add timeline entry (non-blocking if timeline table fails)
    const { error: timelineError } = await supabase
      .from('complaint_timeline')
      .insert({
        complaint_id: complaintId,
        event_type: 'stage_update',
        event_title: `Stage Updated: ${updatedStage[0].stage_name}`,
        event_description: admin_notes || `Stage status changed to ${stage_status}`,
        performed_by: isValidUuid(req.user?.id) ? req.user.id : null,
        related_stage_id: stageId,
        metadata: {
          old_status: req.body.old_status || existingStage.stage_status,
          new_status: stage_status,
          officer_assigned: updatePayload.assigned_officer_id ?? existingStage.assigned_officer_id,
          contractor_assigned: updatePayload.assigned_contractor_id ?? existingStage.assigned_contractor_id
        }
      });

    if (timelineError) {
      console.warn('Timeline insert warning:', timelineError.message);
    }
    
    // Update complaint status and progress
    await updateComplaintProgress(supabase, complaintId);
    
    res.json({
      success: true,
      message: 'Stage updated successfully',
      data: updatedStage[0]
    });
    
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stage'
    });
  }
});

// Get complaint timeline and details
router.get('/complaints/:complaintId/details', async (req, res) => {
  try {
    const { complaintId } = req.params;
    const supabase = req.app.get('supabase');
    
    // Get complaint with all related data
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        *,
        users:user_id (full_name, email, phone_number),
        complaint_stages (
          *,
          officers (name, department, contact_phone),
          contractors (name, company_name, contact_phone, rating)
        ),
        complaint_timeline (*),
        complaint_costs (*)
      `)
      .eq('id', complaintId)
      .single();
    
    if (complaintError) {
      if (complaintError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
      }
      console.error('Complaint details error:', complaintError);
      return res.status(400).json({
        success: false,
        message: complaintError.message
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }
    
    res.json({
      success: true,
      data: complaint
    });
    
  } catch (error) {
    console.error('Complaint details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint details'
    });
  }
});

// Get officers and contractors for assignments
router.get('/personnel', async (req, res) => {
  try {
    const { type, department } = req.query;
    const supabase = req.app.get('supabase');
    
    let officers = [];
    let contractors = [];
    
    if (!type || type === 'officers') {
      let officersQuery = supabase
        .from('officers')
        .select('*')
        .eq('is_active', true);
      
      if (typeof department === 'string' && department.trim()) {
        officersQuery = officersQuery.eq('department', department.trim());
      }
      
      const { data: officersData, error: officersError } = await officersQuery;
      if (officersError) {
        console.error('Officers fetch error:', officersError);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch officers data'
        });
      }
      officers = officersData || [];
    }
    
    if (!type || type === 'contractors') {
      const { data: contractorsData, error: contractorsError } = await supabase
        .from('contractors')
        .select('*')
        .eq('is_active', true)
        .order('rating', { ascending: false });
      
      if (contractorsError) {
        console.error('Contractors fetch error:', contractorsError);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch contractors data'
        });
      }
      contractors = contractorsData || [];
    }
    
    res.json({
      success: true,
      data: {
        officers,
        contractors
      }
    });
    
  } catch (error) {
    console.error('Personnel fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch personnel data'
    });
  }
});

// Delete/deactivate citizen
router.delete('/citizens/:citizenId', async (req, res) => {
  try {
    const { citizenId } = req.params;
    const { permanent = 'false' } = req.query;
    const isPermanent = permanent === 'true';
    const supabase = req.app.get('supabase');
    
    if (isPermanent) {
      // Permanent deletion
      const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('id', citizenId)
        .eq('user_type', 'citizen')
        .select('id');
      
      if (error) {
        console.error('Citizen deletion error:', error);
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Citizen not found'
        });
      }
    } else {
      // Soft deletion (deactivation)
      const { data, error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', citizenId)
        .eq('user_type', 'citizen')
        .select('id');
      
      if (error) {
        console.error('Citizen deactivation error:', error);
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Citizen not found'
        });
      }
    }
    
    res.json({
      success: true,
      message: isPermanent ? 'Citizen deleted permanently' : 'Citizen deactivated successfully'
    });
    
  } catch (error) {
    console.error('Citizen management error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to manage citizen account'
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateDashboardOverview(complaints, users) {
  const totalComplaints = complaints.length;
  const pendingComplaints = complaints.filter(c => c.status === 'pending').length;
  const inProgressComplaints = complaints.filter(c => c.status === 'in_progress').length;
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
  
  const totalUsers = users.filter(u => u.user_type === 'citizen').length;
  const activeUsers = users.filter(u => u.user_type === 'citizen' && u.is_active).length;
  
  const avgResolutionTime = calculateAverageResolutionTime(complaints);
  const highPriorityComplaints = complaints.filter(c => {
    const score = normalizePriorityTo100(c.priority_score);
    return score !== null && score >= 60;
  }).length;
  
  return {
    totalComplaints,
    pendingComplaints,
    inProgressComplaints,
    resolvedComplaints,
    totalUsers,
    activeUsers,
    avgResolutionTime,
    highPriorityComplaints,
    resolutionRate: totalComplaints > 0 ? Number(((resolvedComplaints / totalComplaints) * 100).toFixed(1)) : 0
  };
}

function calculateStageProgress(complaints) {
  const stageStats = {};
  
  complaints.forEach(complaint => {
    if (complaint.complaint_stages) {
      complaint.complaint_stages.forEach(stage => {
        if (!stageStats[stage.stage_name]) {
          stageStats[stage.stage_name] = {
            pending: 0,
            in_progress: 0,
            completed: 0,
            failed: 0
          };
        }
        const statusKey = stage.stage_status || 'pending';
        stageStats[stage.stage_name][statusKey] = (stageStats[stage.stage_name][statusKey] || 0) + 1;
      });
    }
  });
  
  return stageStats;
}

function calculateCostAnalysis(complaints) {
  let totalEstimated = 0;
  let totalActual = 0;
  
  complaints.forEach(complaint => {
    const est = parseFloat(complaint.estimated_cost);
    if (Number.isFinite(est)) {
      totalEstimated += est;
    }
    const act = parseFloat(complaint.actual_cost);
    if (Number.isFinite(act)) {
      totalActual += act;
    }
  });
  
  return {
    totalEstimated,
    totalActual,
    costVariance: totalEstimated > 0 ? Number((((totalActual - totalEstimated) / totalEstimated) * 100).toFixed(1)) : 0
  };
}

function calculateAverageResolutionTime(complaints) {
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved' && c.created_at && c.resolved_at);
  
  if (resolvedComplaints.length === 0) return 0;
  
  let validCount = 0;
  const totalTime = resolvedComplaints.reduce((sum, complaint) => {
    const created = new Date(complaint.created_at);
    const resolvedAt = new Date(complaint.resolved_at);
    if (Number.isNaN(created.getTime()) || Number.isNaN(resolvedAt.getTime())) {
      return sum;
    }
    validCount++;
    return sum + Math.max(0, resolvedAt - created);
  }, 0);
  
  if (validCount === 0) return 0;
  const avgMilliseconds = totalTime / validCount;
  return Math.round(avgMilliseconds / (1000 * 60 * 60)); // Convert to hours
}

async function getRecentActivity(supabase) {
  const { data, error } = await supabase
    .from('complaint_timeline')
    .select(`
      *,
      complaints (title),
      users (full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.warn('Recent activity fetch warning:', error.message);
    return [];
  }
  
  return data || [];
}

async function updateComplaintProgress(supabase, complaintId) {
  // Get all stages for this complaint
  const { data: stages, error: stagesError } = await supabase
    .from('complaint_stages')
    .select('*')
    .eq('complaint_id', complaintId)
    .order('stage_number');
  
  if (stagesError || !stages || stages.length === 0) {
    if (stagesError) {
      console.warn('Failed to fetch stages for progress update:', stagesError.message);
    }
    return;
  }
  
  const totalStages = stages.length;
  const completedStages = stages.filter(s => s.stage_status === 'completed').length;
  const currentStage = stages.find(s => s.stage_status === 'in_progress') || stages.find(s => s.stage_status === 'pending');
  
  // Determine overall complaint status
  let overallStatus = 'pending';
  if (completedStages === totalStages) {
    overallStatus = 'resolved';
  } else if (completedStages > 0 || stages.some(s => s.stage_status === 'in_progress')) {
    overallStatus = 'in_progress';
  }
  
  // Update complaint
  const { error: updateError } = await supabase
    .from('complaints')
    .update({
      status: overallStatus,
      current_stage_id: currentStage?.id ?? null,
      completed_stages: completedStages,
      total_stages: totalStages,
      resolved_at: overallStatus === 'resolved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', complaintId);

  if (updateError) {
    console.warn('Failed to update complaint progress:', updateError.message);
  }
}

module.exports = router;
