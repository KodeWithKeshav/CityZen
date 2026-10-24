# Database Reference

CityZen uses [Supabase](https://supabase.com) (managed PostgreSQL) as its
single data store. The core tables (`users`, `complaints`, `complaint_votes`,
`complaint_updates`, `complaint_workflow`) were created directly in the
Supabase dashboard rather than through tracked migration files, and the
backend discovers the live `complaints` schema at runtime
(`checkComplaintsTableSchema()` in `backend/routes/complaints.js`) so that
inserts only send columns that actually exist.

Everything under `backend/database/*.sql` is a hand-run, idempotent patch
(`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and similar guards)
applied through the Supabase SQL editor — not an automated migration chain.
Apply them in the order listed below on a fresh project.

## Core Tables (pre-existing)

These are assumed to already exist in any Supabase project this backend
connects to:

| Table | Purpose |
|---|---|
| `users` | Citizen and admin accounts. Key columns: `id` (UUID), `email`, `password` (bcrypt hash), `full_name`, `phone_number`, `user_type` (`citizen` \| `admin`), `address`, `is_active`, `created_at`, `last_login`. |
| `complaints` | The central complaint record. Key columns: `id`, `title`, `description`, `category`, `status` (`pending` → `in_progress` → `resolved` / `rejected` / `cancelled`), `user_id`, `location_latitude`, `location_longitude`, `location_address`, `priority_score`, `location_sensitivity_score`, `emotion_score`, `ai_confidence_score`, `text_authenticity_score`, `content_flagged`, `content_flag_reason`, `verification_status`, `image_urls`, `audio_url`, `vote_count`, `assigned_admin_id`, `resolution_notes`, `resolved_at`, `created_at`, `updated_at`. |
| `complaint_votes` | One row per citizen (or guest device) upvote. Key columns: `complaint_id`, `user_id` (nullable for guests), `device_id` (added by migration, see below), `vote_type` (`upvote` \| `downvote`), `vote_count`, `created_at`. A database trigger/consumer keeps `complaints.vote_count` in sync — see `services/voteService.js`. |
| `complaint_updates` | Append-only audit log of status transitions and admin notes per complaint. |
| `complaint_workflow` | One row per complaint describing the three-stage resolution pipeline (`step_1`/`step_2`/`step_3`: `status`, `officer_id`, `contractor_id`, `notes`, `timestamp`, plus stage-specific fields like `step_2_estimated_cost` and `step_3_completion_photos`). |
| `complaint_stages` / `complaint_timeline` | Richer per-stage and per-event tracking surfaced through `GET /api/complaint-details/:id/progress`, joined against `officers` and `contractors` reference tables. |

## Migration Files (`backend/database/*.sql`)

Apply in this order on a new Supabase project (all are safe to re-run):

1. **`create_feedback_table.sql`** — creates `complaint_feedback`
   (post-resolution citizen feedback: `complaint_id`, `user_id` nullable,
   `rating` 1–5, `feedback_text`, `improvement_suggestions`), with indexes,
   an `updated_at` trigger, and Row Level Security policies restricting
   writes/reads to the submitting user, guests, or admins.
2. **`add_language_column_to_complaints.sql`** — adds `complaints.language`
   (`TEXT DEFAULT 'en'`) to record which of the six supported languages a
   complaint's description was captured in.
3. **`add_pothole_geometry_columns.sql`** — adds the pothole footprint/depth
   estimation columns to `complaints`: `estimated_width_cm`,
   `estimated_length_cm`, `estimated_area_cm2`, `estimated_depth_cm`,
   `geometry_confidence`, `geometry_method`, `geometry_assumptions` (JSONB),
   `geometry_status` (`pending` \| `completed` \| `failed` \|
   `not_applicable`), `geometry_error`, `geometry_computed_at`.
4. **`add_device_id_to_complaint_votes.sql`** — adds
   `complaint_votes.device_id` plus two partial unique indexes that enforce
   "one vote per user" and "one vote per device" at the database level, and
   cleans up any pre-existing duplicate vote rows before creating the
   per-user unique index.
5. **`create_social_signals_table.sql`** — creates
   `complaint_social_signals`, which stores public social-media posts
   (currently X/Twitter) matched to a complaint for cross-validation, with
   per-post match/text/location/recency/engagement sub-scores.
6. **`alter_social_signals_table_for_cross_validation.sql`** — extends
   `complaint_social_signals` with `image_url`, `classification_verified`,
   `correlation_status`, `roboflow_class`, and `roboflow_confidence`, used
   once the matched post's image is itself run through the SAM3 workflow.

## Schema Availability Probing

Because columns 2–4 above are optional, hand-applied patches, the backend
never assumes they exist. `backend/services/schemaAvailability.js` probes the
live schema once per process (`geometryColumnsAvailable`,
`languageColumnAvailable`, `deviceIdColumnAvailable`) and the calling code —
`routes/complaints.js`, `routes/adminMinimal.js`, `routes/imageAnalysis.js`,
`routes/guest-votes.js` — degrades to a documented placeholder or
pre-migration behavior instead of letting a raw Postgres "column does not
exist" error reach the client.

## Setting Up a New Supabase Project

1. Create a new Supabase project and note its **Project URL** and **anon
   public key** (Project Settings → API) — these become `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` (see `docs/ENVIRONMENT.md`).
2. Create the `users` and `complaints` tables (and `complaint_votes`,
   `complaint_updates`, `complaint_workflow`) matching the columns described
   above, either by hand in the Table Editor or by importing an existing
   project's schema.
3. Open the Supabase SQL Editor and run each file in `backend/database/` in
   the order listed above.
4. Verify Row Level Security policies match your deployment's trust model —
   the backend currently authenticates with the anonymous key and enforces
   authorization in the Express layer (`middleware/auth.js`) rather than in
   Postgres RLS for most tables, with the exception of `complaint_feedback`.
