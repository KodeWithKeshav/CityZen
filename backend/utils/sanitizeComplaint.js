/**
 * Strips admin-only fields from a complaint row before it reaches a
 * citizen-facing response. `priority_breakdown` (see
 * services/LocationPriorityService.js + database/add_priority_breakdown_
 * column.sql) carries the full "how was this score calculated" internals
 * -- per-signal scores, AHP weights, nearby facility analysis -- which is
 * meant for the admin "Score Breakdown" panel only, not a citizen's own
 * complaint view or the public/nearby complaint feeds. Several citizen-
 * facing routes `select('*')` the complaints table and spread the raw row
 * into their response, so this is applied once at each of those response
 * boundaries rather than relying on every future `select` staying
 * column-scoped.
 */
function stripAdminOnlyFields(complaint) {
  if (!complaint || typeof complaint !== 'object') return complaint;
  const { priority_breakdown, ...rest } = complaint;
  return rest;
}

function stripAdminOnlyFieldsFromList(complaints) {
  if (!Array.isArray(complaints)) return complaints;
  return complaints.map(stripAdminOnlyFields);
}

module.exports = { stripAdminOnlyFields, stripAdminOnlyFieldsFromList };
