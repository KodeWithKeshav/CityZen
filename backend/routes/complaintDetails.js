const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { recomputeVoteCount } = require('../services/voteService');

const METERS_PER_DEGREE_LAT = 111320;

function parseCoord(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return NaN;
  return Number(v);
}

function buildBoundingBox(lat, lng, radiusMeters) {
  const latDelta = radiusMeters / METERS_PER_DEGREE_LAT;
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const lngDelta = radiusMeters / (METERS_PER_DEGREE_LAT * cosLat);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

// Get nearby complaints (registered BEFORE /:id so "nearby" is not captured as an ID)
router.get('/nearby', async (req, res) => {
  try {
    const { latitude, lat: latParam, longitude, lng: lngParam, distance, radius, limit = 20 } = req.query;
    const userId = req.user?.id || null;

    const lat = parseCoord(latitude ?? latParam);
    const lng = parseCoord(longitude ?? lngParam);
    const parsedDistance = parseFloat(distance ?? radius ?? 5000);
    const parsedLimit = parseInt(limit, 10);
    const radiusMeters = Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : 5000;
    const maxResults = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, parsedLimit) : 20;

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude are required'
      });
    }

    let complaints = [];

    // Try RPC function first
    try {
      const { data: rpcResults, error: rpcError } = await supabase.rpc(
        'find_complaints_within_distance',
        {
          origin_lat: lat,
          origin_lng: lng,
          distance_meters: radiusMeters,
          max_results: maxResults,
          exclude_id: null
        }
      );

      if (!rpcError && rpcResults) {
        complaints = rpcResults;
      } else {
        // Fallback if RPC fails: bounding-box pre-filter then exact Haversine distance
        console.log('RPC failed, using fallback query:', rpcError);
        const bbox = buildBoundingBox(lat, lng, radiusMeters);

        const { data: allComplaints, error: queryError } = await supabase
          .from('complaints')
          .select('*')
          .gte('location_latitude', bbox.minLat)
          .lte('location_latitude', bbox.maxLat)
          .gte('location_longitude', bbox.minLng)
          .lte('location_longitude', bbox.maxLng);

        if (queryError) {
          throw new Error(queryError.message);
        }

        if (allComplaints) {
          complaints = allComplaints
            .map(complaint => {
              const distKm = calculateDistance(
                lat,
                lng,
                complaint.location_latitude,
                complaint.location_longitude
              );
              return {
                ...complaint,
                distance: distKm * 1000 // Convert km to meters
              };
            })
            .filter(complaint => complaint.distance <= radiusMeters)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, maxResults);
        }
      }
    } catch (locationError) {
      console.error('Error getting nearby complaints:', locationError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch nearby complaints',
        error: locationError.message
      });
    }

    // If there are no nearby complaints
    if (complaints.length === 0) {
      return res.status(200).json({
        success: true,
        complaints: []
      });
    }

    // Get complaint IDs for vote queries
    const complaintIds = complaints.map(c => c.id);

    // Get upvote counts only
    const { data: voteCounts, error: voteError } = await supabase
      .from('complaint_votes')
      .select('complaint_id')
      .in('complaint_id', complaintIds)
      .eq('vote_type', 'upvote');

    if (voteError) {
      console.error('Error fetching vote counts:', voteError);
    }

    // Check which complaints the user has upvoted
    let userVotes = [];
    if (userId) {
      const { data: votes, error: userVoteError } = await supabase
        .from('complaint_votes')
        .select('complaint_id')
        .in('complaint_id', complaintIds)
        .eq('user_id', userId)
        .eq('vote_type', 'upvote');

      if (!userVoteError && votes) {
        userVotes = votes.map(v => v.complaint_id);
      } else if (userVoteError) {
        console.error('Error fetching user votes:', userVoteError);
      }
    }

    // Create a map of complaint_id to vote count
    const voteCountMap = {};
    if (voteCounts) {
      voteCounts.forEach(vote => {
        voteCountMap[vote.complaint_id] = (voteCountMap[vote.complaint_id] || 0) + 1;
      });
    }

    // Add vote counts and user votes to complaints
    const completeComplaints = complaints.map(complaint => ({
      ...complaint,
      vote_count: voteError ? (complaint.vote_count || 0) : (voteCountMap[complaint.id] || 0),
      userVoted: userVotes.includes(complaint.id),
      distance: Math.round(Number(complaint.distance) || 0) // Round to nearest meter
    }));

    // Sort by vote count (higher first), then by distance (closer first)
    completeComplaints.sort((a, b) => {
      if (b.vote_count !== a.vote_count) {
        return b.vote_count - a.vote_count;
      }
      return a.distance - b.distance;
    });

    return res.status(200).json({
      success: true,
      complaints: completeComplaints
    });
  } catch (error) {
    console.error('❌ Error in nearby complaints API:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Vote on a complaint
router.post('/vote', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to vote on complaints'
      });
    }

    const { complaintId, voteType } = req.body || {};
    const userId = req.user.id;

    if (!complaintId || !voteType) {
      return res.status(400).json({
        success: false,
        message: 'Complaint ID and vote type are required'
      });
    }

    if (voteType !== 'upvote' && voteType !== 'downvote') {
      return res.status(400).json({
        success: false,
        message: 'voteType must be either "upvote" or "downvote"'
      });
    }

    // Check if complaint exists
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('id')
      .eq('id', complaintId)
      .maybeSingle();

    if (complaintError) {
      console.error('Error verifying complaint for vote:', complaintError);
      return res.status(500).json({
        success: false,
        message: 'Error verifying complaint',
        error: complaintError.message
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Check if user has already voted
    const { data: existingVote, error: voteError } = await supabase
      .from('complaint_votes')
      .select('id, vote_type')
      .eq('complaint_id', complaintId)
      .eq('user_id', userId)
      .maybeSingle();

    if (voteError) {
      console.error('Error checking existing vote:', voteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check existing vote',
        error: voteError.message
      });
    }

    // Handle upvote (add or flip from downvote) or downvote (update existing upvote)
    if (voteType === 'upvote' && !existingVote) {
      const { error } = await supabase
        .from('complaint_votes')
        .insert({
          complaint_id: complaintId,
          user_id: userId,
          vote_type: 'upvote',
          vote_count: 1,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error adding vote:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to add vote',
          error: error.message
        });
      }

      const voteCount = await recomputeVoteCount(supabase, complaintId);
      return res.status(200).json({
        success: true,
        message: 'Vote added successfully',
        voteCount
      });
    } else if (voteType === 'upvote' && existingVote && existingVote.vote_type !== 'upvote') {
      const { error } = await supabase
        .from('complaint_votes')
        .update({
          vote_count: 1,
          vote_type: 'upvote'
        })
        .eq('id', existingVote.id);

      if (error) {
        console.error('Error changing vote to upvote:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to change vote to upvote',
          error: error.message
        });
      }

      const voteCount = await recomputeVoteCount(supabase, complaintId);
      return res.status(200).json({
        success: true,
        message: 'Vote changed to upvote successfully',
        voteCount
      });
    } else if (voteType === 'downvote' && existingVote && existingVote.vote_type !== 'downvote') {
      const { error } = await supabase
        .from('complaint_votes')
        .update({
          vote_count: 0,
          vote_type: 'downvote'
        })
        .eq('id', existingVote.id);

      if (error) {
        console.error('Error changing vote to downvote:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to change vote to downvote',
          error: error.message
        });
      }

      const voteCount = await recomputeVoteCount(supabase, complaintId);
      return res.status(200).json({
        success: true,
        message: 'Vote changed to downvote successfully',
        voteCount
      });
    } else {
      return res.status(200).json({
        success: true,
        message: 'No change needed'
      });
    }
  } catch (error) {
    console.error('❌ Error in vote API:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get complaint progress and timeline for citizens
router.get('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch core complaint without relying on optional FK relations that may not exist in schema
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        *,
        users:user_id (id, full_name)
      `)
      .eq('id', id)
      .maybeSingle();

    if (complaintError) {
      console.error('Error fetching complaint progress:', complaintError);
      return res.status(500).json({
        success: false,
        message: 'Error fetching complaint progress',
        error: complaintError.message
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    const formatDate = (value, withTime = false) => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      const opts = withTime
        ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'long', day: 'numeric' };
      return d.toLocaleDateString('en-US', opts);
    };

    // Fetch optional stages/timeline if those tables exist; fall back to complaint_workflow + complaint_updates
    const [stagesRes, timelineRes, workflowRes, updatesRes] = await Promise.all([
      supabase.from('complaint_stages').select('*').eq('complaint_id', id).order('stage_number', { ascending: true }),
      supabase.from('complaint_timeline').select('*').eq('complaint_id', id).order('created_at', { ascending: false }),
      supabase.from('complaint_workflow').select('*').eq('complaint_id', id).maybeSingle(),
      supabase.from('complaint_updates').select('*').eq('complaint_id', id).order('created_at', { ascending: false })
    ]);

    let rawStages = !stagesRes.error && Array.isArray(stagesRes.data) ? stagesRes.data : [];
    if (rawStages.length === 0 && !workflowRes.error && workflowRes.data) {
      const wf = workflowRes.data;
      rawStages = [
        {
          id: `${wf.id || id}-stage-1`,
          stage_number: 1,
          stage_name: 'Inspection & Assessment',
          stage_description: wf.step_1_notes || 'Initial inspection and priority verification',
          stage_status: wf.step_1_status || 'pending',
          assigned_officer_id: wf.step_1_officer_id || null,
          created_at: wf.step_1_timestamp || wf.created_at,
          actual_completion_date: wf.step_1_status === 'completed' ? wf.step_1_timestamp : null
        },
        {
          id: `${wf.id || id}-stage-2`,
          stage_number: 2,
          stage_name: 'Department Approval & Estimation',
          stage_description: wf.step_2_notes || 'Resource allocation and cost estimation',
          stage_status: wf.step_2_status || 'pending',
          assigned_officer_id: wf.step_2_officer_id || null,
          created_at: wf.step_2_timestamp || wf.created_at,
          actual_completion_date: wf.step_2_status === 'completed' ? wf.step_2_timestamp : null
        },
        {
          id: `${wf.id || id}-stage-3`,
          stage_number: 3,
          stage_name: 'Field Execution & Resolution',
          stage_description: wf.step_3_notes || 'On-site remediation and completion verification',
          stage_status: wf.step_3_status || 'pending',
          assigned_contractor_id: wf.step_3_contractor_id || null,
          estimated_completion_date: wf.step_3_start_date || null,
          actual_completion_date: wf.step_3_completion_date || null,
          created_at: wf.step_3_timestamp || wf.created_at
        }
      ];
    }

    // Sort stages by stage_number before determining active/next stage
    const stages = rawStages
      .map(stage => ({
        ...stage,
        formatted_created_date: formatDate(stage.created_at),
        formatted_completion_date: formatDate(stage.actual_completion_date),
        formatted_estimated_date: formatDate(stage.estimated_completion_date)
      }))
      .sort((a, b) => (a.stage_number || 0) - (b.stage_number || 0));

    // Calculate progress percentage
    const totalStages = stages.length;
    const completedStages = stages.filter(stage => stage.stage_status === 'completed').length;
    const progressPercentage = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

    // Get current active stage (or next pending stage in stage_number order)
    let currentStage = stages.find(stage => stage.stage_status === 'in_progress') || null;
    if (!currentStage) {
      currentStage = stages.find(stage => stage.stage_status === 'pending') || null;
    }

    // Format and sort timeline by date (newest first)
    const rawTimeline = (!timelineRes.error && Array.isArray(timelineRes.data) && timelineRes.data.length > 0)
      ? timelineRes.data
      : (!updatesRes.error && Array.isArray(updatesRes.data)
          ? updatesRes.data.map(u => ({
              id: u.id,
              action_type: u.new_status ? `status_${u.new_status}` : 'status_update',
              action_description: u.update_notes || (u.new_status ? `Status updated to ${u.new_status}` : 'Complaint updated'),
              performed_by: u.updated_by_id || null,
              created_at: u.created_at
            }))
          : []);

    const timeline = rawTimeline
      .map(entry => ({
        ...entry,
        formatted_date: formatDate(entry.created_at, true)
      }))
      .sort((a, b) => {
        const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0);
      });

    const progressData = {
      complaint: {
        id: complaint.id,
        title: complaint.title,
        description: complaint.description,
        status: complaint.status,
        category: complaint.category,
        priority_score: complaint.priority_score,
        created_at: complaint.created_at,
        formatted_created_date: formatDate(complaint.created_at),
        user: complaint.users
      },
      progress: {
        percentage: progressPercentage,
        completed_stages: completedStages,
        total_stages: totalStages,
        current_stage: currentStage
      },
      stages: stages,
      timeline: timeline.slice(0, 10) // Limit to recent 10 entries
    };

    res.json({
      success: true,
      data: progressData
    });

  } catch (error) {
    console.error('Complaint progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint progress'
    });
  }
});

// Get complaint by ID with detailed information
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;

    // Get the main complaint with location details
    const { data: complaint, error } = await supabase
      .from('complaints')
      .select(`
        *,
        users:user_id (id, full_name, email)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching complaint:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching complaint details',
        error: error.message
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    if (!complaint.users && complaint.user_id) {
      const { data: u } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('id', complaint.user_id)
        .maybeSingle();
      if (u) complaint.users = u;
    }

    const citizenFullName = complaint.users?.full_name || complaint.user_name || 'Verified Citizen';
    complaint.users = complaint.users || { full_name: citizenFullName };
    complaint.user = complaint.users;
    complaint.user_name = citizenFullName;
    complaint.citizenName = citizenFullName;

    // Check if current user has upvoted this complaint
    let userVoted = false;
    if (userId) {
      const { data: votes, error: votesError } = await supabase
        .from('complaint_votes')
        .select('id')
        .eq('complaint_id', id)
        .eq('user_id', userId)
        .eq('vote_type', 'upvote')
        .maybeSingle();

      if (!votesError && votes) {
        userVoted = true;
      }
    }

    // Get complaint upvote count
    const { count: upvoteCount, error: voteCountError } = await supabase
      .from('complaint_votes')
      .select('id', { count: 'exact', head: true })
      .eq('complaint_id', id)
      .eq('vote_type', 'upvote');

    if (voteCountError) {
      console.error('Error fetching vote count:', voteCountError);
    }

    // Get complaint updates
    const { data: updates, error: updatesError } = await supabase
      .from('complaint_updates')
      .select('*')
      .eq('complaint_id', id)
      .order('created_at', { ascending: true });

    if (updatesError) {
      console.error('Error fetching complaint updates:', updatesError);
    }

    // Get similar complaints nearby (within 500m)
    let similarComplaints = [];
    const originLat = parseCoord(complaint.location_latitude);
    const originLng = parseCoord(complaint.location_longitude);

    if (Number.isFinite(originLat) && Number.isFinite(originLng)) {
      // Try using stored procedure first
      try {
        const { data: nearby, error: nearbyError } = await supabase.rpc(
          'find_complaints_within_distance',
          {
            origin_lat: originLat,
            origin_lng: originLng,
            distance_meters: 500,
            max_results: 5,
            exclude_id: id
          }
        );

        if (!nearbyError && nearby) {
          similarComplaints = nearby.map(item => ({
            id: item.id,
            title: item.title,
            status: item.status,
            image_urls: item.image_urls,
            distance: Math.round(Number(item.distance) || 0) // Round to nearest meter
          }));
        } else {
          // Fallback to manual bounding-box query if RPC fails
          console.log('Falling back to manual nearby query');
          const bbox = buildBoundingBox(originLat, originLng, 500);
          const { data: manualNearby, error: manualError } = await supabase
            .from('complaints')
            .select('id, title, status, image_urls, location_latitude, location_longitude')
            .neq('id', id)
            .gte('location_latitude', bbox.minLat)
            .lte('location_latitude', bbox.maxLat)
            .gte('location_longitude', bbox.minLng)
            .lte('location_longitude', bbox.maxLng);

          if (!manualError && manualNearby) {
            similarComplaints = manualNearby
              .map(item => {
                const distance = calculateDistance(
                  originLat,
                  originLng,
                  item.location_latitude,
                  item.location_longitude
                );
                return {
                  ...item,
                  distance: Math.round(distance * 1000) // Convert km to meters and round
                };
              })
              .filter(item => item.distance <= 500) // Only include items within 500m
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 5);
          }
        }
      } catch (nearbyErr) {
        console.error('Error fetching nearby complaints:', nearbyErr);
      }
    }

    // Combine all data
    const completeComplaint = {
      ...complaint,
      userVoted,
      vote_count: voteCountError ? (complaint.vote_count || 0) : (upvoteCount ?? 0),
      updates: updates || [],
      similarComplaints
    };

    return res.status(200).json({
      success: true,
      complaint: completeComplaint
    });
  } catch (error) {
    console.error('❌ Error in complaint details API:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

module.exports = router;
