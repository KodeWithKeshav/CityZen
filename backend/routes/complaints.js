const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const LocationPriorityService = require('../services/LocationPriorityService');
const { emotionService } = require('../services/EmotionAnalysisService');
const { analyzeTextAuthenticityBlended } = require('../services/TextAuthenticityService');
const priorityConfig = require('../services/priorityConfig');
const potholeGeometryService = require('../services/potholeGeometryService');
const { castUpvote, toggleUpvote } = require('../services/voteService');
const { findNearbyDuplicateComplaint } = require('../services/duplicateComplaintService');
const { stripAdminOnlyFields, stripAdminOnlyFieldsFromList } = require('../utils/sanitizeComplaint');

// Initialize services
const locationPriorityService = new LocationPriorityService();

/**
 * Run sentiment/emotion analysis and authenticity/correctness checks on a
 * complaint description together, so both the pre-submit check and the
 * final submission use one source of truth.
 */
async function analyzeComplaintText({ title, description, category, imagePrimaryClass, translation, language }) {
  const [emotionResult, authenticity] = await Promise.all([
    emotionService.analyzeEmotion(description, category, translation),
    analyzeTextAuthenticityBlended({ text: description, title, category, imagePrimaryClass, language }),
  ]);

  return { emotion: emotionResult, authenticity };
}

/**
 * POST /api/complaints/analyze-text
 * Lets the client run sentiment + authenticity/correctness checks on a
 * description before final submission, so the UI can warn the citizen if
 * their text doesn't seem to match the selected/detected issue category
 * (e.g. category is "pothole" but the description is about something else)
 * or reads like spam/gibberish.
 */
router.post('/analyze-text', async (req, res) => {
  try {
    const { title, description, category, imagePrimaryClass, translation, language } = req.body || {};

    // Either field is enough to run analysis on -- a citizen should get an
    // immediate title-mismatch flag while typing the title, without having
    // to wait until they've also written a description (and vice versa).
    const hasTitle = typeof title === 'string' && title.trim();
    const hasDescription = typeof description === 'string' && description.trim();
    if (!hasTitle && !hasDescription) {
      return res.status(400).json({
        success: false,
        error: 'title or description is required',
        code: 'MISSING_TEXT'
      });
    }

    const result = await analyzeComplaintText({ title, description: description || '', category, imagePrimaryClass, translation, language });

    res.json({
      success: true,
      emotion: result.emotion,
      authenticity: result.authenticity,
    });
  } catch (error) {
    console.error('❌ Text analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze complaint text',
      details: error.message
    });
  }
});

/**
 * Submit a new complaint with automatic location processing
 * POST /api/complaints/submit
 */
// Function to check the complaints table schema
async function checkComplaintsTableSchema() {
  try {
    console.log('📊 Checking complaints table schema...');
    // Introspect the table schema to see column names
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Schema check error:', error);
      return null;
    }

    if (data && data.length > 0) {
      console.log('📋 Available columns in complaints table:', Object.keys(data[0]));
      return Object.keys(data[0]);
    }

    // Empty table: try RPC introspection before returning null so callers don't strip all fields
    console.log('ℹ️ No records in complaints table to infer schema, trying RPC introspection');
    try {
      const { data: rpcCols, error: rpcErr } = await supabase.rpc('get_table_columns', { table_name: 'complaints' });
      if (!rpcErr && Array.isArray(rpcCols) && rpcCols.length > 0) {
        const colNames = rpcCols.map(c => (typeof c === 'string' ? c : c.column_name)).filter(Boolean);
        if (colNames.length > 0) return colNames;
      }
    } catch (rpcException) {
      console.log('ℹ️ RPC schema introspection unavailable:', rpcException.message);
    }

    return null;
  } catch (error) {
    console.error('❌ Schema check failed:', error);
    return null;
  }
}

// Filter the complaint data to match available columns
async function filterComplaintDataForInsertion(complaintData, availableColumns) {
  const filteredData = {};

  // Only filter columns when schema introspection actually returned column names;
  // when the table is empty or schema lookup failed, keep all fields instead of stripping to {}
  if (Array.isArray(availableColumns) && availableColumns.length > 0) {
    Object.keys(complaintData).forEach(key => {
      if (availableColumns.includes(key)) {
        filteredData[key] = complaintData[key];
      }
    });
  } else {
    Object.assign(filteredData, complaintData);
  }

  // Validate numeric fields to prevent overflow errors
  // For columns with precision 3, scale 2 (max value < 10)
  const numericFields = ['priority_score', 'location_sensitivity_score', 'emotion_score', 'ai_confidence_score', 'text_authenticity_score'];
  numericFields.forEach(field => {
    if (field in filteredData) {
      // Ensure value is a finite number between 0 and 9.99
      if (typeof filteredData[field] === 'number') {
        if (!Number.isFinite(filteredData[field])) {
          console.log(`⚠️ Adjusting non-finite ${field} to 0`);
          filteredData[field] = 0;
        } else if (filteredData[field] >= 10) {
          console.log(`⚠️ Adjusting ${field} from ${filteredData[field]} to 9.99 to prevent overflow`);
          filteredData[field] = 9.99;
        } else if (filteredData[field] < 0) {
          console.log(`⚠️ Adjusting ${field} from ${filteredData[field]} to 0 to ensure positive value`);
          filteredData[field] = 0;
        } else {
          // Ensure we're working with 2 decimal places max
          filteredData[field] = parseFloat(filteredData[field].toFixed(2));
        }
      }
    }
  });

  console.log('📝 Filtered complaint data for insertion:', filteredData);
  return filteredData;
}

router.post('/submit', async (req, res) => {
  try {
    console.log('📝 New complaint submission:', req.body);

    // Check if user is authenticated
    const authenticatedUser = req.user;
    console.log('👤 Authenticated user:', authenticatedUser ? authenticatedUser.id : 'None');

    // Check the table schema first
    const columns = await checkComplaintsTableSchema();

    const {
      title,
      description,
      category,
      imageUrl,
      imageValidation,
      locationData,
      language = 'en',
      translation
    } = req.body || {};

    // Input validation
    if (
      typeof title !== 'string' || !title.trim() ||
      typeof description !== 'string' || !description.trim() ||
      typeof category !== 'string' || !category.trim() ||
      !locationData || typeof locationData !== 'object'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, category, and location are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const parseCoord = (v) => (v === null || v === undefined || v === '' || typeof v === 'boolean') ? NaN : Number(v);
    const lat = parseCoord(locationData.latitude);
    const lng = parseCoord(locationData.longitude);
    const hasValidCoords =
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180;

    if (!hasValidCoords && (typeof locationData.address !== 'string' || !locationData.address.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Valid location coordinates or address are required',
        code: 'INVALID_LOCATION'
      });
    }

    const normalizedCategory = category.trim();
    const normalizedImageUrl = (typeof imageUrl === 'string' && imageUrl.trim()) ? imageUrl.trim() : null;
    const normalizedLanguage = (typeof language === 'string' && language.trim()) ? language.trim() : 'en';
    const normalizedLocationData = {
      ...locationData,
      latitude: hasValidCoords ? lat : null,
      longitude: hasValidCoords ? lng : null,
    };

    // Validate if string is a UUID
    const isUuid = (str) => {
      if (typeof str !== 'string') return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Create or ensure the demo user exists for foreign key constraint
    const ensureDemoUser = async () => {
      console.log('🔍 Checking for demo user...');

      // First, check if our default demo user exists
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('id')
        .eq('email', 'demo@civicrezo.org')
        .limit(1);

      if (findError) {
        console.error('❌ Error checking for demo user:', findError);
      }

      // If user exists, return its ID
      if (existingUser && existingUser.length > 0) {
        console.log('✅ Using existing demo user:', existingUser[0].id);
        return existingUser[0].id;
      }

      console.log('⚠️ Demo user not found, creating one...');

      // Check if the RPC function exists by trying to call it
      try {
        const { data: demoId, error: rpcError } = await supabase.rpc('create_demo_user');

        if (!rpcError && demoId) {
          console.log('✅ Created demo user via RPC:', demoId);
          return demoId;
        }

        if (rpcError) {
          console.log('⚠️ RPC function not available:', rpcError.message);
        }
        console.log('⚠️ RPC call failed, falling back to direct insert');
      } catch (rpcErr) {
        console.log('⚠️ RPC call failed, falling back to direct insert:', rpcErr.message);
      }
      
      const demoUuid = crypto.randomUUID();

      // Direct insert fallback
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          id: demoUuid,
          email: 'demo@civicrezo.org',
          password: '!demo-disabled-password!',
          full_name: 'Demo User',
          phone_number: '1234567890',
          user_type: 'citizen',
          address: 'Demo Address',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();

      if (insertError || !newUser || !newUser[0]?.id) {
        console.error('❌ Error creating demo user:', insertError || 'No user row returned');
        return demoUuid;
      }

      console.log('✅ Created new demo user:', newUser[0].id);
      return newUser[0].id;
    };

    // Always derive user identity from verified auth token when present; never trust unauthenticated body userId
    let userUuid;
    if (authenticatedUser && isUuid(authenticatedUser.id)) {
      console.log(`🔑 Using authenticated user_id: ${authenticatedUser.id}`);
      userUuid = authenticatedUser.id;
    } else {
      userUuid = await ensureDemoUser();
      console.log(`🔑 Using demo user_id: ${userUuid}`);
    }

    // --- Duplicate-complaint detection -------------------------------
    // Same category within ~40m of an existing non-resolved complaint ->
    // add this submitter's upvote to it instead of creating a new row (see
    // services/duplicateComplaintService.js). Runs before the image/text
    // validation and priority-scoring below, since a duplicate skips all
    // of that entirely - no point spending a Roboflow/emotion-analysis
    // call on a submission that isn't going to become a new complaint.
    const duplicateComplaint = hasValidCoords
      ? await findNearbyDuplicateComplaint({
        supabase,
        category: normalizedCategory,
        latitude: lat,
        longitude: lng,
      })
      : null;

    if (duplicateComplaint) {
      console.log(
        `♻️ Duplicate complaint detected ${Math.round(duplicateComplaint._distanceMeters)}m away ` +
        `(${duplicateComplaint.id}) - upvoting instead of creating a new complaint`
      );

      const { voteCount, alreadyVoted } = await castUpvote(supabase, duplicateComplaint.id, { userId: userUuid });

      return res.json({
        success: true,
        duplicate: true,
        // Same trimmed shape as the normal-submission response below
        // (response.complaint), so the client can render either result
        // with one code path.
        complaint: {
          id: duplicateComplaint.id,
          title: duplicateComplaint.title,
          category: duplicateComplaint.category,
          status: duplicateComplaint.status,
          submittedAt: duplicateComplaint.created_at,
        },
        voteCount,
        alreadyVoted,
        message: alreadyVoted
          ? "This issue was already reported nearby, and you'd already voted for it — no new complaint or vote was added."
          : 'This issue was already reported nearby, so we added your vote to it instead of creating a duplicate report.',
      });
    }

    // Reject outright if an image was uploaded but never passed validation
    // against the selected category (client should already prevent this,
    // but the server is the authority — never trust the client alone).
    if (normalizedImageUrl) {
      if (!imageValidation || imageValidation.allowUpload !== true) {
        return res.status(400).json({
          success: false,
          error: imageValidation?.message || 'The uploaded photo does not match the selected issue type.',
          code: 'IMAGE_CATEGORY_MISMATCH',
          categoryMatch: imageValidation?.categoryMatch ?? false,
          detectedClass: imageValidation?.primaryClass || null,
        });
      }
    }

    // Analyze the description: sentiment/emotion + authenticity/correctness
    // (does the text actually describe the declared/detected issue, and does
    // it read like a genuine report rather than spam/gibberish?)
    const textAnalysis = await analyzeComplaintText({
      title: title.trim(),
      description: description.trim(),
      category: normalizedCategory,
      imagePrimaryClass: imageValidation?.primaryClass || null,
      translation,
      language: normalizedLanguage,
    });
    console.log('🔎 Text analysis result:', {
      authenticityScore: textAnalysis.authenticity.authenticityScore,
      flagged: textAnalysis.authenticity.flagged,
      mismatchDetected: textAnalysis.authenticity.mismatchDetected,
      emotionScore: textAnalysis.emotion.emotionScore,
    });

    // Reject outright only when the blended authenticity score is low
    // enough to be near-certain spam/gibberish/off-topic (hardBlocked) — no
    // "submit anyway" path for that tier. A moderately low score
    // (flagged but not hardBlocked) now lets submission succeed but queues
    // the complaint for human admin review instead of rejecting at the
    // door; see services/TextAuthenticityService.js and
    // priorityConfig.js's AUTHENTICITY_THRESHOLDS.
    if (textAnalysis.authenticity.hardBlocked) {
      return res.status(400).json({
        success: false,
        error: 'The description does not appear to match the selected issue type.',
        code: 'DESCRIPTION_CATEGORY_MISMATCH',
        contentAnalysis: {
          authenticityScore: textAnalysis.authenticity.authenticityScore,
          reasons: textAnalysis.authenticity.reasons,
          suggestedCategory: textAnalysis.authenticity.suggestedCategory,
        },
      });
    }

    // Calculate comprehensive priority score
    const priorityAnalysis = await calculateComprehensivePriority({
      imageValidation,
      locationData: normalizedLocationData,
      category: normalizedCategory,
      description: description.trim()
    });

    // Create a base complaint object with essential fields
    const baseComplaint = {
      title: title.trim(),
      description: description.trim(),
      category: normalizedCategory,
      status: 'pending', // initial status as pending

      // User information - ensure it's a UUID for Supabase
      user_id: userUuid,

      // Timestamps in PostgreSQL timestamptz format (ISO format works well)
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const safeFixedScore = (val, fallback = 0) =>
      (typeof val === 'number' && Number.isFinite(val)) ? parseFloat(val.toFixed(2)) : fallback;

    const rawConfidence = imageValidation?.modelConfidence ?? imageValidation?.confidence;
    const numericConfidence = (typeof rawConfidence === 'number' && Number.isFinite(rawConfidence))
      ? rawConfidence
      : (typeof rawConfidence === 'string' && rawConfidence.trim() !== '' && Number.isFinite(Number(rawConfidence))
        ? Number(rawConfidence)
        : null);

    // Add expected fields according to your schema, with fallbacks
    const complaintData = {
      ...baseComplaint,

      // Location information
      location_latitude: normalizedLocationData.latitude,
      location_longitude: normalizedLocationData.longitude,

      // Try both versions of fields to increase compatibility
      location_address: (typeof locationData.address === 'string' && locationData.address.trim())
        ? locationData.address.trim()
        : (hasValidCoords ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Unknown location'),

      // Scoring fields - adjust to match the database constraints
      // For numeric fields with precision 3, scale 2, values must be < 10^1 (i.e., < 10)
      priority_score: safeFixedScore(priorityAnalysis.totalScore, 0),
      location_sensitivity_score: safeFixedScore(priorityAnalysis.locationScore, 0),
      emotion_score: safeFixedScore(textAnalysis.emotion?.emotionScore, 0.5),

      // Full "how was this score calculated" explanation (signal scores,
      // AHP weights, weighted contributions, human-readable reasoning,
      // nearby facility analysis) -- computed above but previously
      // discarded after the API response. Persisted so the admin UI can
      // show it later instead of only the bare priority_score number.
      // Dropped gracefully by filterComplaintDataForInsertion() if the
      // database/add_priority_breakdown_column.sql migration hasn't run yet.
      priority_breakdown: {
        ...priorityAnalysis.breakdown,
        reasoning: priorityAnalysis.reasoning,
        facilitiesCount: priorityAnalysis.facilitiesCount || 0,
        facilityAnalysis: priorityAnalysis.facilityAnalysis || null
      },

      // Add AI confidence score if available
      ai_confidence_score: numericConfidence !== null
        ? parseFloat(numericConfidence.toFixed(2))
        : 0.5,

      // How well the description matches the declared/detected category and
      // reads like a genuine report (0-1, see TextAuthenticityService)
      text_authenticity_score: textAnalysis.authenticity.authenticityScore,
      content_flagged: textAnalysis.authenticity.flagged,
      content_flag_reason: (Array.isArray(textAnalysis.authenticity?.reasons)
        ? textAnalysis.authenticity.reasons
        : []).join(' ') || null,

      // Which language the description was captured in (typed or via the
      // multilingual speech-to-text flow). Dropped gracefully by
      // filterComplaintDataForInsertion() if the `language` column migration
      // (database/add_language_column_to_complaints.sql) hasn't run yet.
      language: normalizedLanguage,

      // Images and media
      image_urls: normalizedImageUrl ? [normalizedImageUrl] : [],
      audio_url: null,

      // Status fields
      verification_status: textAnalysis.authenticity.flagged
        ? 'flagged_for_review'
        : (imageValidation?.allowUpload ? 'verified' : 'unverified'),
      assigned_department: null,
      assigned_admin_id: null,
      resolution_notes: null,
      resolved_at: null,
    };

    // Filter the complaint data to match available columns
    const filteredData = await filterComplaintDataForInsertion(complaintData, columns);

    let complaint;

    try {
      // Insert into Supabase
      const { data, error } = await supabase
        .from('complaints')
        .insert([filteredData])
        .select();

      if (error) {
        console.error('❌ Supabase insert error:', error);

        // Provide more specific error handling for numeric overflow
        if (error.code === '22003' && error.message.includes('numeric field overflow')) {
          throw new Error('Numeric field overflow. Scores must be less than 10 with up to 2 decimal places.');
        }

        throw new Error(error.message);
      }

      complaint = data;
      console.log('✅ Complaint saved to Supabase:', complaint);

      // After successful complaint submission, create an initial complaint update entry
      if (complaint && complaint[0] && complaint[0].id) {
        const complaintId = complaint[0].id;

        // Fire-and-forget pothole footprint/depth estimation (see
        // services/potholeGeometryService.js and PRIORITY_ENGINE plan doc
        // "Pothole Footprint & Depth Estimation"). Deliberately NOT
        // awaited and wrapped in .catch() so a slow/failed Roboflow call
        // can never delay or fail the citizen's response below.
        potholeGeometryService
          .estimateAndPersistGeometry({
            complaintId,
            imageUrl: normalizedImageUrl,
            category: normalizedCategory,
            primaryClass: imageValidation?.primaryClass || null,
            deviceTilt: req.body?.deviceTilt ?? null, // present once the mobile app sends it (Phase 2)
          })
          .catch((e) => console.error('❌ Geometry estimation error (non-blocking):', e.message));

        // 1. Add entry to complaint_updates table
        const { error: updateError } = await supabase
          .from('complaint_updates')
          .insert([{
            complaint_id: complaintId,
            updated_by_id: userUuid, // Use the same user who submitted the complaint
            old_status: null, // No old status for a new complaint
            new_status: 'pending', // Initial status
            update_notes: 'Complaint submitted',
            created_at: new Date().toISOString()
          }]);

        if (updateError) {
          console.error('❌ Error creating complaint update entry:', updateError);
        } else {
          console.log('✅ Added initial complaint update entry');
        }


        // 2. Register the creator's initial upvote (see services/voteService.js
        // - also recomputes and persists complaints.vote_count, which the
        // old delete-then-insert here never did, so a brand new complaint
        // used to show a vote count of 0 despite the creator "having voted").
        try {
          await castUpvote(supabase, complaintId, { userId: userUuid });
          console.log('✅ Added initial complaint vote entry');
        } catch (voteErr) {
          console.error('❌ Exception in complaint vote creation:', voteErr.message);
        }
      }
    } catch (dbError) {
      console.error('❌ Database operation failed:', dbError);

      // Attempt to get table schema directly (alternative approach)
      try {
        const { data: schema } = await supabase.rpc('get_table_columns', { table_name: 'complaints' });
        if (schema) {
          console.log('📊 Complaints table columns:', schema);
        }
      } catch (e) {
        console.error('Could not fetch schema via RPC:', e);
      }

      throw new Error(`Database error: ${dbError.message}`);
    }

    // Prepare response - safe access in case structure changed
    const complaintRecord = complaint && complaint[0] ? complaint[0] : {};

    const finalScore = Number(priorityAnalysis.totalScore || 0);
    const finalPriorityLevel = priorityConfig.getPriorityLevel(finalScore);

    const response = {
      success: true,
      complaint: {
        id: complaintRecord.id || `temp-${Date.now()}`,
        title: complaintRecord.title || title.trim(),
        category: complaintRecord.category || normalizedCategory,
        priorityScore: Math.round(finalScore * 100),
        status: complaintRecord.status || 'pending',
        submittedAt: complaintRecord.created_at || new Date().toISOString()
      },
      priorityAnalysis: {
        totalScore: finalScore,
        priorityLevel: finalPriorityLevel,
        breakdown: {
          locationScore: priorityAnalysis.locationScore,
          imageScore: priorityAnalysis.imageScore,
          facilitiesNearby: priorityAnalysis.facilitiesCount
        },
        reasoning: priorityAnalysis.reasoning
      },
      location: {
        privacyLevel: locationData.privacyLevel,
        accuracy: locationData.accuracy ? `±${locationData.accuracy}m` : 'Unknown',
        description: locationData.description
      },
      contentAnalysis: {
        authenticityScore: textAnalysis.authenticity.authenticityScore,
        flagged: textAnalysis.authenticity.flagged,
        hardBlocked: textAnalysis.authenticity.hardBlocked,
        mismatchDetected: textAnalysis.authenticity.mismatchDetected,
        suggestedCategory: textAnalysis.authenticity.suggestedCategory,
        reasons: textAnalysis.authenticity.reasons,
        emotionScore: textAnalysis.emotion.emotionScore,
      },
      nextSteps: generateNextSteps(finalPriorityLevel, normalizedCategory),
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Complaint submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit complaint',
      code: 'SUBMISSION_ERROR',
      details: error.message || 'Internal server error',
      suggestion: 'Please check your database schema and ensure all required fields are properly configured.'
    });
  }
});

/**
 * Calculate comprehensive priority score combining image and location analysis.
 *
 * FIX: this function used to contain a second, independent priority
 * formula (locationScore*0.6 + imageScore*0.4) that silently ran whenever
 * LocationPriorityService.calculateComprehensivePriority() threw --
 * meaning a transient Places-API hiccup could change which formula (and
 * which undocumented weights) produced a citizen's stored priority score.
 * Its own comment even disagreed with its own code (comment said "50%
 * location / 40% image", code used 60/40). There is now exactly one
 * formula, defined in services/priorityConfig.js and used everywhere
 * (final submission, /calculate-priority preview, and
 * /api/location-priority/comprehensive all call it). If it genuinely can't
 * run (no location data, or the calculation throws), this returns an
 * honestly-labeled category-tier-only estimate instead of silently
 * recomputing with different weights.
 */
async function calculateComprehensivePriority({ imageValidation, locationData, category, description }) {
  const startTime = Date.now();

  const categoryOnlyFallback = (reason) => {
    const fallbackScore = priorityConfig.getFallbackPriorityScore(category);
    const fallbackImageScore = imageValidation?.data?.priorityScore ?? imageValidation?.modelConfidence ?? imageValidation?.confidence ?? 0;
    return {
      totalScore: fallbackScore,
      priorityLevel: priorityConfig.getPriorityLevel(fallbackScore),
      locationScore: 0,
      imageScore: fallbackImageScore,
      reasoning: `${reason} Priority assigned from complaint category "${category}" (${priorityConfig.getCategoryImportanceLabel(category)}) only.`,
      facilitiesCount: 0,
      processingTime: Date.now() - startTime,
      breakdown: {
        infrastructureScore: 0,
        imageValidationScore: fallbackImageScore,
        emotionScore: 0,
        voteScore: 0,
        statusMultiplier: 1.0,
        degraded: true
      },
      facilityAnalysis: null
    };
  };

  if (!locationData || !Number.isFinite(locationData.latitude) || !Number.isFinite(locationData.longitude)) {
    return categoryOnlyFallback('No location data provided.');
  }

  try {
    const priorityResult = await locationPriorityService.calculateComprehensivePriority(
      locationData.latitude,
      locationData.longitude,
      imageValidation || {},
      {
        complaintType: category,
        created_at: new Date().toISOString(),
        status: 'pending',
        votes: 0,
        description,
        locationMeta: {
          privacyLevel: locationData.privacyLevel,
          radiusM: locationData.accuracy,
          precision: locationData.precision,
          description: locationData.description
        }
      }
    );

    console.log('✅ Priority calculation result:', priorityResult);

    return {
      totalScore: priorityResult.priorityScore,
      priorityLevel: priorityResult.priorityLevel,
      locationScore: priorityResult.breakdown.infrastructureScore,
      imageScore: priorityResult.breakdown.imageValidationScore,
      reasoning: priorityResult.reasoning,
      facilitiesCount: priorityResult.totalFacilities || 0,
      processingTime: Date.now() - startTime,
      breakdown: priorityResult.breakdown,
      facilityAnalysis: priorityResult.facilityAnalysis || null
    };
  } catch (priorityErr) {
    console.error('❌ Priority calculation error, using category-tier fallback:', priorityErr);
    return categoryOnlyFallback(`Priority calculation service unavailable (${priorityErr.message}).`);
  }
}

// NOTE: this file used to also define generatePriorityReasoning(),
// getFallbackPriority(), getCategoryImportance(), and getPriorityLevelFromScore()
// -- a THIRD independent category->score/label table (after
// EmotionAnalysisService's ~30-category multiplier table and this app's own
// 8-class taxonomy), several of whose category names couldn't even occur in
// this app. All four are now provided by services/priorityConfig.js
// (getFallbackPriorityScore, getCategoryImportanceLabel, getPriorityLevel)
// and used directly at each call site, so there is exactly one category ->
// tier mapping in the codebase.

/**
 * Generate next steps based on priority level and category
 */
function generateNextSteps(priorityLevel, category) {
  const defaultSteps = [
    'Your complaint has been received and will be reviewed shortly.',
    'You can track the status of your complaint in the dashboard.',
    'A citizen representative will be assigned to your case.'
  ];

  if (priorityLevel === 'CRITICAL') {
    return [
      '🚨 Your complaint has been marked as CRITICAL priority.',
      'An urgent response team will be notified immediately.',
      'Expect a response within 24 hours.',
      'You can track real-time updates in your dashboard.'
    ];
  } else if (priorityLevel === 'HIGH') {
    return [
      '⚠️ Your complaint has been marked as HIGH priority.',
      'It will be reviewed by municipal staff within 48 hours.',
      'You will receive updates when your complaint status changes.',
      'Local authorities have been notified about this issue.'
    ];
  } else if (priorityLevel === 'MEDIUM') {
    return [
      'Your complaint has been marked as MEDIUM priority.',
      'It will be assessed within the next 3-5 business days.',
      'Similar complaints in your area will be addressed together for efficiency.',
      'Check back for status updates.'
    ];
  }

  return defaultSteps;
}

/**
 * Get complaints with pagination and filters
 * GET /api/complaints
 */
const ALLOWED_SORT_COLUMNS = new Set([
  'created_at',
  'updated_at',
  'priority_score',
  'vote_count',
  'status',
  'category',
  'title'
]);

router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      userId,
      adminId,
      sort = 'created_at',
      order = 'desc',
      latitude,
      longitude,
      radius
    } = req.query;

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limitNum = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, parsedLimit) : 10;
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('complaints')
      .select(`
        *,
        users:user_id (id, full_name, email)
      `, { count: 'exact' });

    // Apply filters if provided
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (userId) query = query.eq('user_id', userId);
    if (adminId) query = query.eq('assigned_admin_id', adminId);

    // Apply location-based filtering if latitude, longitude, and radius are provided
    if (latitude !== undefined && longitude !== undefined && radius !== undefined) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const rad = parseFloat(radius);

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(rad) || rad <= 0 || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Invalid latitude, longitude, or radius filter parameters'
        });
      }

      console.log(`🌎 Filtering complaints by location: lat=${lat}, lng=${lng}, radius=${rad}m`);

      // Calculate the approximate distance in degrees for the radius
      const latDelta = rad / 111000; // 1 degree latitude is ~111km
      const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
      const lngDelta = rad / (111000 * cosLat);

      // Filter by bounding box first (more efficient than calculating exact distances for all records)
      query = query.filter(
        'location_latitude', 'gte', lat - latDelta
      ).filter(
        'location_latitude', 'lte', lat + latDelta
      ).filter(
        'location_longitude', 'gte', lng - lngDelta
      ).filter(
        'location_longitude', 'lte', lng + lngDelta
      );
    }

    // Apply sorting against an explicit column whitelist
    const sortColumn = ALLOWED_SORT_COLUMNS.has(sort) ? sort : 'created_at';
    const isAscending = typeof order === 'string' && order.toLowerCase() === 'asc';
    query = query.order(sortColumn, { ascending: isAscending });

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const complaints = data || [];

    // If we have user authentication, add vote information to each complaint
    if (complaints.length > 0 && req.user?.id) {
      const authenticatedUserId = req.user.id;

      // Vote counts are already included in complaints table, no need to fetch separately
      // Just get user votes for all complaints to check if user has voted
      const { data: userVotes, error: userVoteError } = await supabase
        .from('complaint_votes')
        .select('complaint_id, vote_type')
        .eq('user_id', authenticatedUserId)
        .in('complaint_id', complaints.map(c => c.id));

      // Map of user votes by complaint
      const userVoteMap = {};
      if (!userVoteError && userVotes) {
        userVotes.forEach(vote => {
          // User has upvoted if vote_type is 'upvote'
          userVoteMap[vote.complaint_id] = (vote.vote_type === 'upvote');
        });
      }

      // Add user vote information to each complaint (vote_count already exists in complaints table)
      complaints.forEach(complaint => {
        // vote_count is already available from complaints table
        complaint.userVoted = userVoteMap[complaint.id] || false;
      });
    }

    // Log the vote counts to help with debugging
    console.log(`📊 Returning ${complaints.length} complaints with vote counts:`,
      complaints.map(c => ({ id: c.id, votes: c.vote_count || 0, userVoted: c.userVoted || false }))
    );

    const totalCount = count || 0;
    res.json({
      success: true,
      complaints: stripAdminOnlyFieldsFromList(complaints),
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Fetch complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get all complaints
 * GET /api/complaints/all
 */
router.get('/all', async (req, res) => {
  try {
    console.log('📋 Fetching all complaints');

    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const complaints = data || [];
    console.log(`✅ Successfully fetched ${complaints.length} complaints`);

    res.json({
      success: true,
      complaints: stripAdminOnlyFieldsFromList(complaints)
    });
  } catch (error) {
    console.error('Fetch all complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// NEW: Personal Reports - Get user's own complaints with Amazon-style tracking
router.get('/personal-reports', async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log('🔍 Getting personal reports for user ID:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get all complaints by this user
    const { data: complaints, error: complaintsError } = await supabase
      .from('complaints')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (complaintsError) {
      console.error('Personal complaints query error:', complaintsError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch your complaints'
      });
    }

    // Get workflow data for all complaints separately
    let workflowData = [];
    if (complaints && complaints.length > 0) {
      const complaintIds = complaints.map(c => c.id);
      const { data: workflows, error: workflowError } = await supabase
        .from('complaint_workflow')
        .select('*')
        .in('complaint_id', complaintIds);

      if (workflowError) {
        console.error('Personal workflow query error:', workflowError);
        workflowData = [];
      } else {
        workflowData = workflows || [];
      }
    }

    // Transform complaints with Amazon-style tracking stages
    const complaintsWithTracking = complaints?.map(complaint => {
      const workflow = workflowData.find(w => w.complaint_id === complaint.id);

      // Create Amazon-style tracking stages
      const trackingStages = [
        {
          id: 1,
          name: 'Complaint Submitted',
          status: 'completed',
          date: complaint.created_at,
          description: 'Your complaint has been received and is being reviewed',
          icon: '📝'
        },
        {
          id: 2,
          name: 'Initial Review',
          status: workflow?.step_1_status === 'completed' ? 'completed' :
            workflow?.step_1_status === 'in_progress' ? 'in_progress' : 'pending',
          date: workflow?.step_1_timestamp,
          description: 'Our team is reviewing your complaint for validity and priority',
          icon: '🔍'
        },
        {
          id: 3,
          name: 'Assessment & Planning',
          status: workflow?.step_2_status === 'completed' ? 'completed' :
            workflow?.step_2_status === 'in_progress' ? 'in_progress' : 'pending',
          date: workflow?.step_2_timestamp,
          description: 'Field assessment and resource planning in progress',
          icon: '📋',
          estimatedCost: workflow?.step_2_estimated_cost
        },
        {
          id: 4,
          name: 'Work in Progress',
          status: workflow?.step_3_status === 'completed' ? 'completed' :
            workflow?.step_3_status === 'in_progress' ? 'in_progress' : 'pending',
          date: workflow?.step_3_timestamp,
          description: 'Resolution work is being carried out',
          icon: '🔧',
          contractor: workflow?.step_3_contractor_id ? 'Contractor assigned' : null,
          startDate: workflow?.step_3_start_date
        },
        {
          id: 5,
          name: 'Completed',
          status: complaint.status === 'resolved' ? 'completed' : 'pending',
          date: workflow?.step_3_completion_date || (complaint.status === 'resolved' ? complaint.updated_at : null),
          description: complaint.status === 'resolved' ? 'Issue has been resolved successfully' : 'Awaiting completion',
          icon: complaint.status === 'resolved' ? '✅' : '⏳',
          photos: workflow?.step_3_completion_photos
        }
      ];

      const inProgressIdx = trackingStages.findIndex(stage => stage.status === 'in_progress');
      const completedCount = trackingStages.filter(stage => stage.status === 'completed').length;
      const currentStage = inProgressIdx !== -1
        ? inProgressIdx + 1
        : (complaint.status === 'resolved' ? 5 : Math.min(5, completedCount + 1));

      return {
        ...complaint,
        trackingStages,
        currentStage
      };
    }) || [];

    // Calculate statistics
    const stats = {
      totalComplaints: complaints?.length || 0,
      resolved: complaints?.filter(c => c.status === 'resolved').length || 0,
      inProgress: complaints?.filter(c => c.status === 'in_progress').length || 0,
      pending: complaints?.filter(c => c.status === 'pending').length || 0,
      cancelled: complaints?.filter(c => c.status === 'cancelled').length || 0
    };

    console.log('✅ Personal reports fetched successfully:', stats);

    res.json({
      success: true,
      data: {
        complaints: stripAdminOnlyFieldsFromList(complaintsWithTracking),
        stats
      }
    });

  } catch (error) {
    console.error('Personal reports endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your reports'
    });
  }
});

/**
 * Get user vote status for complaints
 * GET /api/complaints/vote/status
 * Requires authentication
 * Query: { complaintIds: string } - comma-separated list of complaint IDs
 */
router.get('/vote/status', async (req, res) => {
  try {
    // Check for authenticated user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to check vote status'
      });
    }

    const { complaintIds } = req.query;
    const userId = req.user.id;

    if (!complaintIds) {
      return res.status(400).json({
        success: false,
        message: 'complaintIds query parameter is required'
      });
    }

    // Parse comma-separated or array complaint IDs safely
    const rawIds = Array.isArray(complaintIds)
      ? complaintIds.flatMap(item => String(item).split(','))
      : String(complaintIds).split(',');
    const idsArray = [...new Set(rawIds.map(id => id.trim()).filter(Boolean))];

    if (idsArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one valid complaintId is required'
      });
    }

    // Get user's votes for these complaints
    const { data: votes, error } = await supabase
      .from('complaint_votes')
      .select('complaint_id, vote_type')
      .eq('user_id', userId)
      .in('complaint_id', idsArray)
      .eq('vote_type', 'upvote'); // Only consider upvotes

    if (error) {
      console.error('❌ Error fetching vote status:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching vote status'
      });
    }

    // Build a map of complaint IDs to vote status
    const voteStatusMap = {};
    idsArray.forEach(id => {
      voteStatusMap[id] = false;
    });

    (votes || []).forEach(vote => {
      voteStatusMap[vote.complaint_id] = true;
    });

    return res.status(200).json({
      success: true,
      data: voteStatusMap
    });

  } catch (error) {
    console.error('❌ Vote status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while getting vote status'
    });
  }
});

/**
 * Get individual complaint details
 * GET /api/complaints/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const complaintId = req.params.id;

    if (!complaintId) {
      return res.status(400).json({
        success: false,
        message: 'Complaint ID is required'
      });
    }

    console.log(`🔍 Fetching complaint details for ID: ${complaintId}`);

    // Get complaint details
    const { data: complaint, error } = await supabase
      .from('complaints')
      .select(`
        *,
        users:user_id (
          id,
          full_name,
          email
        )
      `)
      .eq('id', complaintId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching complaint:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching complaint'
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

    // Vote count is already available in complaints table (complaint.vote_count)
    const voteCount = complaint.vote_count || 0;

    // Check if current user has voted (if authenticated)
    let userVoted = false;
    if (req.user && req.user.id) {
      const { data: userVote, error: userVoteError } = await supabase
        .from('complaint_votes')
        .select('vote_type')
        .eq('complaint_id', complaintId)
        .eq('user_id', req.user.id)
        .eq('vote_type', 'upvote')
        .maybeSingle();

      userVoted = Boolean(!userVoteError && userVote);
    }

    // Add vote information to complaint
    complaint.vote_count = voteCount;
    complaint.userVoted = userVoted;

    console.log(`✅ Found complaint: ${complaint.title} with ${voteCount} votes`);

    res.json({
      success: true,
      complaint: stripAdminOnlyFields(complaint)
    });
  } catch (error) {
    console.error('❌ Get complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Toggle vote on a complaint
 * POST /api/complaints/vote
 * Requires authentication
 * Body: { complaintId: string }
 * Toggles between upvote (vote_count: 1) and downvote (vote_count: 0)
 */
router.post('/vote', async (req, res) => {
  try {
    // Check for authenticated user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to vote on complaints'
      });
    }

    const { complaintId } = req.body || {};
    const userId = req.user.id;

    console.log('🗳️ Processing toggle vote request:', req.body);

    if (!complaintId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. Required: complaintId'
      });
    }

    // First check if the complaint exists
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('id')
      .eq('id', complaintId)
      .maybeSingle();

    if (complaintError) {
      console.error('❌ Error looking up complaint for vote:', complaintError);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while looking up complaint'
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // See services/voteService.js - also recomputes and persists
    // complaints.vote_count from complaint_votes, which this endpoint used
    // to never do (it only mutated complaint_votes, so the visible count
    // never moved even though the vote itself was correctly recorded).
    const { action, userVoted, voteCount } = await toggleUpvote(supabase, complaintId, { userId });

    return res.status(200).json({
      success: true,
      message: action === 'voted' ? 'Vote added successfully' : 'Vote removed successfully',
      data: {
        complaint_id: complaintId,
        action,
        userVoted,
        voteCount
      }
    });

  } catch (error) {
    console.error('❌ Vote processing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing vote'
    });
  }
});

/**
 * POST /api/complaints/:id/reopen
 * Lets the citizen who filed a complaint reopen it if they're not satisfied
 * with a 'resolved' outcome -- resets the resolution stage to in_progress
 * and bumps complaint_workflow.reopened_count, rather than making them file
 * a brand new complaint for the same issue.
 */
router.post('/:id/reopen', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required to reopen a complaint' });
    }

    const { id } = req.params;
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('id, user_id, status')
      .eq('id', id)
      .maybeSingle();

    if (complaintError) {
      console.error('❌ Error looking up complaint for reopen:', complaintError);
      return res.status(500).json({ success: false, message: 'Internal server error while looking up complaint' });
    }
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    if (complaint.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only reopen your own complaints' });
    }
    if (complaint.status !== 'resolved') {
      return res.status(400).json({ success: false, message: 'Only resolved complaints can be reopened' });
    }

    const nowIso = new Date().toISOString();

    const { data: updatedComplaint, error: updateError } = await supabase
      .from('complaints')
      .update({ status: 'in_progress', resolved_at: null, updated_at: nowIso })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error reopening complaint:', updateError);
      return res.status(500).json({ success: false, message: 'Failed to reopen complaint' });
    }

    // Best-effort: reset the resolution stage and bump the reopen counter.
    // reopened_count/the stage reset only exist once
    // database/create_municipal_workforce_tables.sql has been applied --
    // the complaint's own status flip above already succeeded either way.
    const { data: workflow } = await supabase
      .from('complaint_workflow')
      .select('reopened_count')
      .eq('complaint_id', id)
      .maybeSingle();

    if (workflow) {
      const { error: workflowUpdateError } = await supabase
        .from('complaint_workflow')
        .update({
          step_3_status: 'in_progress',
          step_3_completion_date: null,
          reopened_count: (workflow.reopened_count || 0) + 1,
          updated_at: nowIso,
        })
        .eq('complaint_id', id);
      if (workflowUpdateError) {
        console.warn('Failed to reset workflow on reopen (migration applied?):', workflowUpdateError.message);
      }
    }

    await supabase.from('complaint_updates').insert({
      complaint_id: id,
      updated_by_id: req.user.id,
      old_status: 'resolved',
      new_status: 'in_progress',
      update_notes: 'Citizen reopened this complaint as unresolved.',
      created_at: nowIso,
    });

    res.json({ success: true, message: 'Complaint reopened', data: updatedComplaint });
  } catch (error) {
    console.error('❌ Reopen complaint error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while reopening complaint' });
  }
});

router.post('/create', async (req, res) => {
  res.json({
    success: true,
    message: 'Legacy endpoint - use /submit for new complaint submission'
  });
});

/**
 * Calculate priority score before complaint submission
 * This allows the frontend to display the priority before final submission
 * POST /api/complaints/calculate-priority
 */
router.post('/calculate-priority', async (req, res) => {
  try {
    console.log('🧮 Pre-submission priority calculation request:', req.body);

    const {
      category,
      description,
      imageValidation,
      locationData
    } = req.body || {};

    const parseCoord = (v) => (v === null || v === undefined || v === '' || typeof v === 'boolean') ? NaN : Number(v);
    const lat = locationData ? parseCoord(locationData.latitude) : NaN;
    const lng = locationData ? parseCoord(locationData.longitude) : NaN;
    const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    // Basic validation
    if (typeof category !== 'string' || !category.trim() || !locationData || !hasValidCoords) {
      return res.status(400).json({
        success: false,
        error: 'Category and valid location coordinates are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Calculate comprehensive priority
    const priorityAnalysis = await calculateComprehensivePriority({
      imageValidation,
      locationData: { ...locationData, latitude: lat, longitude: lng },
      category: category.trim(),
      description
    });

    const reasoningText = typeof priorityAnalysis.reasoning === 'string' ? priorityAnalysis.reasoning.trim() : '';
    const firstSentence = reasoningText ? reasoningText.split('. ')[0].replace(/\.+$/, '') + '.' : '';

    // Format response for frontend
    const response = {
      success: true,
      priorityScore: Math.round((priorityAnalysis.totalScore || 0) * 100), // 0-100 scale for frontend
      priorityLevel: priorityAnalysis.priorityLevel,
      reasoningSummary: firstSentence,
      reasoning: reasoningText,
      breakdown: {
        infrastructureScore: Math.round((priorityAnalysis.breakdown?.infrastructureScore || 0) * 100),
        imageValidationScore: Math.round((priorityAnalysis.breakdown?.imageValidationScore || 0) * 100),
        facilitiesCount: priorityAnalysis.facilitiesCount || 0
      },
      detailedBreakdown: priorityAnalysis.breakdown,
      metadata: {
        processingTimeMs: priorityAnalysis.processingTime,
        timestamp: new Date().toISOString(),
        apiVersion: 'v2'
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error calculating priority:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate complaint priority',
      message: error.message
    });
  }
});

module.exports = router;
