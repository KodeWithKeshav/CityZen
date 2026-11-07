/**
 * Lets routes that explicitly SELECT the pothole geometry columns
 * (estimated_width_cm etc. - see database/add_pothole_geometry_columns.sql)
 * degrade gracefully instead of hard-failing with a Postgres "column does
 * not exist" error on any Supabase project the migration hasn't been run
 * on yet.
 *
 * Cheap existence probe (SELECT of one column, LIMIT 1) cached briefly in
 * memory. Short TTL rather than "check once and remember forever" so that
 * running the migration is picked up on its own within a minute, with no
 * server restart needed.
 */

const CHECK_TTL_MS = 60_000;

const caches = {
  geometry: { available: null, checkedAt: 0 },
  deviceId: { available: null, checkedAt: 0 },
  language: { available: null, checkedAt: 0 },
  contentFlag: { available: null, checkedAt: 0 },
  workflowDepartment: { available: null, checkedAt: 0 },
};

async function probeColumnAvailable(supabase, table, column, cacheKey) {
  const now = Date.now();
  const entry = caches[cacheKey];
  if (entry.available !== null && now - entry.checkedAt < CHECK_TTL_MS) {
    return entry.available;
  }
  if (!supabase) return false;

  try {
    const { error } = await supabase.from(table).select(column).limit(1);
    // Any error here is treated as "not available" -- the caller falls back
    // to placeholders either way, and a transient/unrelated error will just
    // be re-checked on the next request after the TTL expires.
    const available = !error;
    caches[cacheKey] = { available, checkedAt: now };
    return available;
  } catch {
    caches[cacheKey] = { available: false, checkedAt: now };
    return false;
  }
}

async function geometryColumnsAvailable(supabase) {
  return probeColumnAvailable(supabase, 'complaints', 'geometry_status', 'geometry');
}

// Same probe-and-cache pattern as geometryColumnsAvailable, for
// complaint_votes.device_id (database/add_device_id_to_complaint_votes.sql)
// -- lets routes/guest-votes.js dedupe guest votes per-device once the
// migration has run, while degrading gracefully (no dedup, today's
// behavior) beforehand.
async function deviceIdColumnAvailable(supabase) {
  return probeColumnAvailable(supabase, 'complaint_votes', 'device_id', 'deviceId');
}

// Null placeholders for every geometry column, keyed the same as the real
// row shape, so callers can spread this onto a complaint object selected
// without those columns and keep a consistent response shape for clients.
// geometry_status deliberately stays null (not 'not_applicable') -- that
// value already means something specific (category doesn't support
// geometry estimation) and would be misleading here; both the mobile and
// web admin UIs only render the estimate line when geometry_status ===
// 'completed', so null renders identically to "no data yet" either way.
const GEOMETRY_PLACEHOLDER = {
  estimated_width_cm: null,
  estimated_length_cm: null,
  estimated_area_cm2: null,
  estimated_depth_cm: null,
  geometry_confidence: null,
  geometry_method: null,
  geometry_assumptions: null,
  geometry_status: null,
  geometry_error: null,
  geometry_computed_at: null,
};

// Same probe-and-cache pattern, for complaints.language
// (database/add_language_column_to_complaints.sql) -- lets routes that
// explicitly SELECT a column list (routes/adminMinimal.js's priority queue)
// include it once the migration has run, while degrading gracefully
// beforehand.
async function languageColumnAvailable(supabase) {
  return probeColumnAvailable(supabase, 'complaints', 'language', 'language');
}

async function contentFlagColumnsAvailable(supabase) {
  return probeColumnAvailable(supabase, 'complaints', 'content_flagged', 'contentFlag');
}

// Same probe-and-cache pattern, for complaint_workflow.department_id (and,
// by extension, the sla_deadline/escalation_level/reopened_count columns
// added by the same ALTER in
// database/create_municipal_workforce_tables.sql) -- lets routes/
// adminMinimal.js's workflow creation/update/escalation logic degrade
// gracefully (skip department routing & SLA tracking) until that migration
// has run.
async function workflowDepartmentColumnsAvailable(supabase) {
  return probeColumnAvailable(supabase, 'complaint_workflow', 'department_id', 'workflowDepartment');
}

module.exports = {
  geometryColumnsAvailable,
  GEOMETRY_PLACEHOLDER,
  deviceIdColumnAvailable,
  languageColumnAvailable,
  contentFlagColumnsAvailable,
  workflowDepartmentColumnsAvailable,
};
