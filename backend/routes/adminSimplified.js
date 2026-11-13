const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeUserType } = require('../middleware/auth');

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

// Require authenticated admin for all routes in this router
router.use(
  (req, res, next) => (req.user === undefined ? authenticateUser(req, res, next) : next()),
  authorizeUserType(['admin'])
);

// Simplified admin routes that work with current database structure
router.get('/dashboard/overview', async (req, res) => {
  try {
    const supabase = req.app.get('supabase');

    // Get basic statistics that we know work
    const { data: complaints, error: complaintsError } = await supabase
      .from('complaints')
      .select('id, status, priority_score, category, created_at');

    const { count: totalUsersCount, error: usersError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('user_type', 'citizen');

    if (complaintsError || usersError) {
      console.error('Dashboard data error:', { complaintsError, usersError });
      return res.status(500).json({
        success: false,
        message: 'Failed to load dashboard overview'
      });
    }

    // Calculate overview stats
    const totalComplaints = complaints?.length || 0;
    const resolvedComplaints = complaints?.filter(c => c.status === 'resolved').length || 0;
    const pendingComplaints = complaints?.filter(c => c.status === 'pending').length || 0;
    const inProgressComplaints = complaints?.filter(c => c.status === 'in_progress').length || 0;
    
    // High priority complaints (normalized >= 60 on 0-100 scale, i.e. >= 0.6 on 0-1)
    const highPriorityComplaints = complaints?.filter(c => {
      const score = normalizePriorityTo100(c.priority_score);
      return score !== null && score >= 60;
    }).length || 0;

    // Recent complaints (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentComplaints = complaints?.filter(c => 
      new Date(c.created_at) >= weekAgo
    ).length || 0;

    // Category breakdown
    const categoryStats = {};
    complaints?.forEach(complaint => {
      const category = complaint.category || 'other';
      categoryStats[category] = (categoryStats[category] || 0) + 1;
    });

    const dashboardData = {
      overview: {
        totalComplaints,
        resolvedComplaints,
        pendingComplaints,
        inProgressComplaints,
        highPriorityComplaints,
        recentComplaints,
        totalUsers: totalUsersCount || 0,
        resolutionRate: totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0
      },
      topPriorityComplaints: complaints
        ?.filter(c => c.priority_score !== null && c.priority_score !== undefined)
        ?.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
        ?.slice(0, 5) || [],
      locationHotspots: [],
      recentActivity: [...(complaints || [])]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10),
      stageProgress: {
        pending: pendingComplaints,
        in_progress: inProgressComplaints,
        resolved: resolvedComplaints
      },
      costAnalysis: {
        totalEstimatedCost: 0,
        completedCost: 0,
        pendingCost: 0
      },
      categoryStats
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

// Simplified priority queue
router.get('/complaints/priority-queue', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, status } = req.query;
    const { pageNum, limitNum, offset } = parsePagination(page, limit);
    const supabase = req.app.get('supabase');

    let query = supabase
      .from('complaints')
      .select(`
        id,
        title,
        description,
        category,
        status,
        priority_score,
        location_address,
        created_at,
        updated_at,
        user_id
      `, { count: 'exact' });

    // Apply filters
    const cleanSearch = sanitizeSearchTerm(search);
    if (cleanSearch) {
      query = query.or(`title.ilike.%${cleanSearch}%,location_address.ilike.%${cleanSearch}%`);
    }
    
    if (typeof category === 'string' && category.trim()) {
      query = query.eq('category', category.trim());
    }
    
    if (typeof status === 'string' && status.trim()) {
      query = query.eq('status', status.trim());
    }

    query = query.order('priority_score', { ascending: false })
                 .order('created_at', { ascending: false })
                 .range(offset, offset + limitNum - 1);

    const { data: complaints, error, count } = await query;

    if (error) {
      console.error('Priority queue query error:', error);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Batch fetch user details for all complaints
    const userIds = [...new Set((complaints || []).map(c => c.user_id).filter(Boolean))];
    const usersMap = {};
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds);

      if (usersError) {
        console.warn('Priority queue users lookup warning:', usersError.message);
      } else {
        (users || []).forEach(u => {
          usersMap[u.id] = u;
        });
      }
    }

    const complaintsWithUsers = (complaints || []).map(complaint => ({
      ...complaint,
      users: usersMap[complaint.user_id] || { full_name: 'Unknown User', email: 'unknown@example.com' }
    }));

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));

    res.json({
      success: true,
      data: {
        complaints: complaintsWithUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalPages,
          totalCount,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
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

// Simplified citizens endpoint
router.get('/citizens', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sort = 'recent' } = req.query;
    const { pageNum, limitNum, offset } = parsePagination(page, limit);
    const supabase = req.app.get('supabase');

    let query = supabase
      .from('users')
      .select('id, full_name, email, phone_number, is_active, created_at', { count: 'exact' })
      .eq('user_type', 'citizen');

    const cleanSearch = sanitizeSearchTerm(search);
    if (cleanSearch) {
      query = query.or(`full_name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`);
    }

    // Apply sorting
    if (sort === 'name') {
      query = query.order('full_name', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data: citizens, error, count } = await query;

    if (error) {
      console.error('Citizens query error:', error);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Batch fetch complaint counts for all citizens on this page
    const citizenIds = (citizens || []).map(c => c.id);
    const statsByUser = {};
    if (citizenIds.length > 0) {
      const { data: complaints, error: complaintsError } = await supabase
        .from('complaints')
        .select('user_id, status, created_at')
        .in('user_id', citizenIds);

      if (complaintsError) {
        console.warn('Citizens complaints lookup warning:', complaintsError.message);
      } else {
        (complaints || []).forEach(c => {
          if (!statsByUser[c.user_id]) {
            statsByUser[c.user_id] = { total: 0, resolved: 0, lastTs: null };
          }
          const entry = statsByUser[c.user_id];
          entry.total++;
          if (c.status === 'resolved') entry.resolved++;
          const ts = new Date(c.created_at).getTime();
          if (Number.isFinite(ts) && (entry.lastTs === null || ts > entry.lastTs)) {
            entry.lastTs = ts;
          }
        });
      }
    }

    const citizensWithStats = (citizens || []).map(citizen => {
      const stats = statsByUser[citizen.id] || { total: 0, resolved: 0, lastTs: null };
      return {
        ...citizen,
        complaints_count: stats.total,
        resolved_complaints: stats.resolved,
        last_complaint_date: stats.lastTs !== null ? new Date(stats.lastTs).toISOString() : null,
        status: citizen.is_active === false ? 'inactive' : 'active',
        reputation_score: Math.min(stats.total * 10 + stats.resolved * 5, 100)
      };
    });

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));

    res.json({
      success: true,
      data: {
        citizens: citizensWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalPages,
          totalCount,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('Citizens error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch citizens'
    });
  }
});

// Get citizen details
router.get('/citizens/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.get('supabase');

    // Get citizen data (explicit safe columns - never expose password hash)
    const { data: citizen, error: citizenError } = await supabase
      .from('users')
      .select('id, full_name, email, phone_number, user_type, address, is_active, created_at, updated_at, last_login')
      .eq('id', id)
      .single();

    if (citizenError || !citizen) {
      if (citizenError?.code === '22P02') {
        return res.status(400).json({
          success: false,
          message: 'Invalid citizen ID format'
        });
      }
      return res.status(404).json({
        success: false,
        message: 'Citizen not found'
      });
    }

    // Get citizen's complaints
    const { data: complaints, error: complaintsError } = await supabase
      .from('complaints')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (complaintsError) {
      console.error('Complaints query error:', complaintsError);
    }

    const resolvedComplaints = complaints?.filter(c => c.status === 'resolved').length || 0;

    const citizenDetails = {
      ...citizen,
      status: citizen.is_active === false ? 'inactive' : 'active',
      complaints: complaints || [],
      resolved_complaints: resolvedComplaints,
      votes_count: 0, // Placeholder
      reputation_score: Math.min((complaints?.length || 0) * 10 + resolvedComplaints * 5, 100)
    };

    res.json({
      success: true,
      data: citizenDetails
    });

  } catch (error) {
    console.error('Citizen details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch citizen details'
    });
  }
});

// Update citizen status
router.put('/citizens/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['active', 'inactive', 'suspended', 'banned'];

    if (typeof status !== 'string' || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const supabase = req.app.get('supabase');
    const isActive = status === 'active';

    const { data, error } = await supabase
      .from('users')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_type', 'citizen')
      .select('id, full_name, email, phone_number, user_type, is_active, updated_at')
      .single();

    if (error || !data) {
      if (error?.code === '22P02') {
        return res.status(400).json({
          success: false,
          message: 'Invalid citizen ID format'
        });
      }
      if (!data || error?.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Citizen not found'
        });
      }
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      data: {
        ...data,
        status: data.is_active ? 'active' : 'inactive',
        message: `Citizen status updated to ${status}`
      }
    });

  } catch (error) {
    console.error('Update citizen status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update citizen status'
    });
  }
});

// Get complaint details
router.get('/complaints/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.get('supabase');

    // Get complaint data
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', id)
      .single();

    if (complaintError || !complaint) {
      if (complaintError?.code === '22P02') {
        return res.status(400).json({
          success: false,
          message: 'Invalid complaint ID format'
        });
      }
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Get user data if complaint has a user_id
    let user = null;
    if (complaint.user_id) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name, email, phone_number')
        .eq('id', complaint.user_id)
        .single();
      if (!userError && userData) {
        user = userData;
      }
    }

    const complaintDetails = {
      ...complaint,
      users: user || { full_name: 'Unknown User', email: 'unknown@example.com' },
      complaint_stages: [], // Placeholder for stages
    };

    res.json({
      success: true,
      data: complaintDetails
    });

  } catch (error) {
    console.error('Complaint details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint details'
    });
  }
});

// Update complaint status
router.put('/complaints/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected', 'cancelled'];

    if (typeof status !== 'string' || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const supabase = req.app.get('supabase');
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('complaints')
      .update({
        status,
        resolved_at: status === 'resolved' ? nowIso : null,
        updated_at: nowIso
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      console.error('Update complaint status error:', error);
      if (error?.code === '22P02') {
        return res.status(400).json({
          success: false,
          message: 'Invalid complaint ID format'
        });
      }
      if (!data || error?.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
      }
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Update complaint status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update complaint status'
    });
  }
});

// Placeholder routes for officers and contractors (with valid UUIDs)
router.get('/officers', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'f8a5bae5-a458-407f-9209-c29209f9d024', name: 'John Smith', department: 'Public Works', status: 'active' },
      { id: 'e7b4c9d6-b347-406e-8108-b18108e8c023', name: 'Sarah Johnson', department: 'Infrastructure', status: 'active' }
    ]
  });
});

router.get('/contractors', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'd6c3b8a5-c246-405d-7017-a07017d7b022', name: 'ABC Construction Ltd', specialization: 'Road Repair', status: 'active' },
      { id: 'c5b2a794-b135-404c-6016-906016c6a021', name: 'Quick Fix Services', specialization: 'Streetlight Maintenance', status: 'active' }
    ]
  });
});

module.exports = router;
