const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

/**
 * Submit feedback for a complaint submission experience
 * POST /api/feedback/submit
 * Body: { complaintId: string, rating: number (1-5), feedback: string, improvements: string }
 */
router.post('/submit', async (req, res) => {
  try {
    console.log('📝 Processing feedback submission:', req.body);
    
    const { complaintId, rating, feedback, improvements, submittedAt } = req.body || {};
    
    // Validation
    if (typeof complaintId !== 'string' || !complaintId.trim() || rating === undefined || rating === null || rating === '') {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: complaintId and rating are required'
      });
    }

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    let normalizedSubmittedAt = new Date().toISOString();
    if (submittedAt !== undefined && submittedAt !== null && submittedAt !== '') {
      const parsedDate = new Date(submittedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'submittedAt must be a valid date'
        });
      }
      normalizedSubmittedAt = parsedDate.toISOString();
    }
    
    // Check if complaint exists
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('id, title, status')
      .eq('id', complaintId.trim())
      .single();
      
    if (complaintError || !complaint) {
      console.error('❌ Complaint not found:', complaintError);
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }
    
    // Prepare feedback data
    const feedbackData = {
      complaint_id: complaintId.trim(),
      user_id: req.user?.id || null, // Authenticated user or null for guest
      rating: parsedRating,
      feedback_text: typeof feedback === 'string' && feedback.trim() ? feedback.trim() : null,
      improvement_suggestions: typeof improvements === 'string' && improvements.trim() ? improvements.trim() : null,
      submitted_at: normalizedSubmittedAt,
      created_at: new Date().toISOString()
    };
    
    // Insert feedback into database
    let { data: newFeedback, error: insertError } = await supabase
      .from('complaint_feedback')
      .insert([feedbackData])
      .select();
      
    if (insertError) {
      console.error('❌ Error inserting feedback:', insertError);
      
      // If table doesn't exist, create it
      if (insertError.code === '42P01' || insertError.code === 'PGRST205') {
        console.log('📋 Creating complaint_feedback table...');
        
        const { error: createTableError } = await supabase.rpc('create_feedback_table', {});
        
        if (createTableError) {
          console.warn('⚠️ complaint_feedback table unavailable, falling back to complaint_updates:', createTableError.message);
          const fallbackPayload = JSON.stringify({
            type: 'citizen_feedback',
            rating: parsedRating,
            feedback_text: feedbackData.feedback_text,
            improvement_suggestions: feedbackData.improvement_suggestions,
            submitted_at: feedbackData.submitted_at
          });
          const { data: fallbackRow, error: fallbackError } = await supabase
            .from('complaint_updates')
            .insert([{
              complaint_id: feedbackData.complaint_id,
              updated_by_id: feedbackData.user_id,
              old_status: complaint.status || null,
              new_status: complaint.status || null,
              update_notes: `[FEEDBACK] ${fallbackPayload}`,
              created_at: feedbackData.created_at
            }])
            .select();

          if (fallbackError) {
            console.error('❌ Error storing fallback feedback in complaint_updates:', fallbackError);
            return res.status(500).json({
              success: false,
              message: 'Failed to submit feedback'
            });
          }

          return res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully',
            data: {
              feedbackId: fallbackRow?.[0]?.id,
              complaintId: complaintId.trim(),
              rating: parsedRating,
              submittedAt: feedbackData.submitted_at,
              storage: 'complaint_updates_fallback'
            }
          });
        }
        
        // Retry insertion
        const { data: retryFeedback, error: retryError } = await supabase
          .from('complaint_feedback')
          .insert([feedbackData])
          .select();
          
        if (retryError) {
          console.error('❌ Error inserting feedback after table creation:', retryError);
          return res.status(500).json({
            success: false,
            message: 'Failed to submit feedback'
          });
        }
        
        newFeedback = retryFeedback;
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to submit feedback',
          details: insertError.message
        });
      }
    }
    
    console.log('✅ Feedback submitted successfully:', newFeedback?.[0]?.id);
    
    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        feedbackId: newFeedback?.[0]?.id,
        complaintId: complaintId.trim(),
        rating: parsedRating,
        submittedAt: feedbackData.submitted_at
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing feedback submission:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing feedback'
    });
  }
});

/**
 * Get feedback statistics (for admin dashboard)
 * GET /api/feedback/stats
 */
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Getting feedback statistics...');
    
    // Get overall statistics
    const { data: stats, error: statsError } = await supabase
      .from('complaint_feedback')
      .select('rating, created_at');
      
    if (statsError) {
      if (statsError.code === '42P01' || statsError.code === 'PGRST205') {
        const { data: fallbackRows } = await supabase
          .from('complaint_updates')
          .select('update_notes, created_at')
          .like('update_notes', '[FEEDBACK] %')
          .order('created_at', { ascending: false });

        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let ratingSum = 0;
        let totalFeedback = 0;
        const recentFeedback = [];

        for (const row of fallbackRows || []) {
          try {
            const parsed = JSON.parse(row.update_notes.slice('[FEEDBACK] '.length));
            const r = Number(parsed.rating);
            if (Number.isFinite(r) && ratingDistribution[r] !== undefined) {
              totalFeedback += 1;
              ratingSum += r;
              ratingDistribution[r] += 1;
              if (parsed.feedback_text && recentFeedback.length < 10) {
                recentFeedback.push({
                  rating: r,
                  feedback_text: parsed.feedback_text,
                  improvement_suggestions: parsed.improvement_suggestions || null,
                  created_at: row.created_at
                });
              }
            }
          } catch {}
        }

        return res.status(200).json({
          success: true,
          data: {
            totalFeedback,
            averageRating: totalFeedback > 0 ? Number((ratingSum / totalFeedback).toFixed(2)) : 0,
            ratingDistribution,
            recentFeedback,
            tableReady: false
          }
        });
      }
      console.error('❌ Error getting feedback stats:', statsError);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve feedback statistics'
      });
    }
    
    // Calculate statistics
    const safeStats = stats || [];
    const totalFeedback = safeStats.length;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;

    for (const item of safeStats) {
      const r = Number(item.rating);
      if (Number.isFinite(r)) {
        ratingSum += r;
        if (ratingDistribution[r] !== undefined) {
          ratingDistribution[r] += 1;
        }
      }
    }

    const averageRating = totalFeedback > 0
      ? Number((ratingSum / totalFeedback).toFixed(2))
      : 0;
    
    // Get recent feedback with text
    const { data: recentFeedback, error: recentError } = await supabase
      .from('complaint_feedback')
      .select('rating, feedback_text, improvement_suggestions, created_at')
      .not('feedback_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    const responseData = {
      totalFeedback,
      averageRating,
      ratingDistribution,
      recentFeedback: recentError ? [] : (recentFeedback || [])
    };
    
    console.log('✅ Feedback statistics retrieved');
    
    return res.status(200).json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('❌ Error getting feedback statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving statistics'
    });
  }
});

module.exports = router;
