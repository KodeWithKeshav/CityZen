const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { toggleUpvote } = require('../services/voteService');

// Vote on a complaint (authenticated upvote toggle via shared voteService)
router.post('/', async (req, res) => {
  try {
    console.log('Processing vote request:', req.body);

    // Check for authenticated user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to vote on complaints'
      });
    }

    const { complaintId } = req.body || {};
    const userId = req.user.id;

    if (typeof complaintId !== 'string' || !complaintId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: complaintId'
      });
    }

    const normalizedComplaintId = complaintId.trim();

    // First check if the complaint exists
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('id')
      .eq('id', normalizedComplaintId)
      .single();

    if (complaintError || !complaint) {
      console.error('Complaint not found:', complaintError || 'No data returned');
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    const { action, userVoted, voteCount } = await toggleUpvote(supabase, normalizedComplaintId, { userId });

    return res.status(200).json({
      success: true,
      message: action === 'voted' ? 'Vote added successfully' : 'Vote removed successfully',
      data: {
        complaint_id: normalizedComplaintId,
        user_id: userId,
        action,
        userVoted,
        voteCount
      }
    });
  } catch (error) {
    console.error('Vote processing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing vote'
    });
  }
});

module.exports = router;
