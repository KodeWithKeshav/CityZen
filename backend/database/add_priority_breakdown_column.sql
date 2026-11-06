-- Persists the full "how was this score calculated" explanation that
-- LocationPriorityService.calculateComprehensivePriority() already computes
-- at submission time (per-signal scores, AHP-derived weights, weighted
-- contributions, human-readable reasoning, nearby facility analysis) --
-- previously only returned in the submit-time API response and then
-- discarded, so admins had no way to see why a complaint landed at a given
-- priority_score.
--
-- Run this manually in the Supabase SQL editor for your project - same
-- ad-hoc pattern as the other files in this database/ folder (complaints
-- was created directly in the Supabase dashboard, not via tracked
-- migrations).
--
-- Backing feature: services/LocationPriorityService.js + routes/complaints.js
-- (persists it on insert) + the admin "Score Breakdown" panel on the
-- complaint detail page. Until this is run, the column simply doesn't
-- exist and `priority_breakdown` is dropped before insertion by
-- filterComplaintDataForInsertion() (routes/complaints.js) rather than
-- erroring -- the breakdown panel just has nothing to show for complaints
-- submitted before the migration.

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS priority_breakdown JSONB;
