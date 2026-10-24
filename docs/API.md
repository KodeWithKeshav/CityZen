# API Reference

Base URL (local development): `http://localhost:3001`

All request and response bodies are JSON unless noted otherwise. Every
response follows the convention `{ "success": true | false, ... }`.
Endpoints that require authentication expect a header:

```
Authorization: Bearer <JWT token>
```

The JWT is issued by `POST /api/auth/login` or `POST /api/auth/signup` and
is valid for 7 days. Authentication middleware (`middleware/auth.js`) is
applied globally and is **permissive**: a missing or invalid token does not
reject the request outright — `req.user` is simply `null` and the route
decides whether anonymous access is allowed. Routes that require a
authenticated user return `401` explicitly when `req.user` is absent.

This reference documents every endpoint actually mounted in
`backend/server.js`. Two route files in the repository
(`routes/adminEnhanced.js`, `routes/adminSimplified.js`) are not mounted
anywhere and are not part of the live API — see
[`ARCHITECTURE.md — Known Legacy Code`](ARCHITECTURE.md#known-legacy-code).

## Table of Contents

- [Health & Root](#health--root)
- [Authentication](#authentication-apiauth)
- [Complaints](#complaints-apicomplaints)
- [Complaint Details](#complaint-details-apicomplaint-details)
- [Admin](#admin-apiadmin)
- [Admin (Enhanced Workflow)](#admin-enhanced-workflow-apiadmin-enhanced)
- [Image Analysis](#image-analysis-apiimage-analysis)
- [Location Priority](#location-priority-apilocation-priority)
- [Heat Map](#heat-map-apiheat-map)
- [Transcription](#transcription-apitranscribe)
- [Chatbot](#chatbot-apichatbot)
- [Statistics](#statistics-apistatistics)
- [Transparency](#transparency-apitransparency)
- [Emotion Analysis](#emotion-analysis-apiemotion)
- [Voting](#voting)
- [Feedback](#feedback-apifeedback)
- [Weather](#weather-apiweather)
- [Cloudinary](#cloudinary-cloudinary)

---

## Health & Root

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Liveness check. Returns `{ status: "OK", message, timestamp }`. |
| GET | `/` | No | API welcome message with a short list of mounted route groups. |

---

## Authentication (`/api/auth`)

### `POST /api/auth/signup`

Creates a citizen or admin account.

**Body**

```json
{
  "email": "jane@example.com",
  "password": "at-least-6-chars",
  "fullName": "Jane Doe",
  "phoneNumber": "9876543210",
  "userType": "citizen",
  "address": "optional"
}
```

**Validation**: `email` must be a valid email; `password` ≥ 6 characters;
`fullName` ≥ 2 characters; `phoneNumber` ≥ 10 characters; `userType` must be
`citizen` or `admin`.

**Response `201`**

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": { "id": "...", "email": "...", "fullName": "...", "phoneNumber": "...", "userType": "citizen", "address": null },
    "token": "<JWT>"
  }
}
```

`400` if the email already exists or validation fails.

### `POST /api/auth/login`

**Body**: `{ "email": string, "password": string }`

**Response `200`**: same `data.user` / `data.token` shape as signup.
`401` on invalid credentials.

### `GET /api/auth/profile`

Requires `Authorization: Bearer <token>`. Returns the authenticated user's
profile. `401` if the token is missing or invalid.

---

## Complaints (`/api/complaints`)

### `POST /api/complaints/analyze-text`

Pre-submission check: runs emotion + text-authenticity analysis on a draft
description so the UI can warn about a mismatch before the citizen submits.

**Body**: `{ "description": string, "category"?: string, "imagePrimaryClass"?: string, "translation"?: string, "language"?: string }`

**Response**: `{ "success": true, "emotion": {...}, "authenticity": {...} }`

### `POST /api/complaints/submit`

Creates a new complaint. This is the main write path and performs, in order:
duplicate detection (same category within ~40 m — upvotes the existing
complaint instead of creating a new one), image-category verification,
text emotion/authenticity analysis, priority scoring, and persistence.

**Body**

```json
{
  "title": "string",
  "description": "string",
  "category": "pothole",
  "imageUrl": "https://... (optional)",
  "imageValidation": { "allowUpload": true, "primaryClass": "pothole", "modelConfidence": 0.92 },
  "locationData": {
    "latitude": 13.0827,
    "longitude": 80.2707,
    "address": "optional",
    "privacyLevel": "exact | street | area",
    "accuracy": 10,
    "precision": "optional",
    "description": "optional"
  },
  "userId": "optional - defaults to a demo user if not authenticated",
  "userType": "citizen",
  "language": "en"
}
```

`title`, `description`, `category`, and `locationData` are required.

**Response `200`** (new complaint)

```json
{
  "success": true,
  "complaint": { "id": "...", "title": "...", "category": "pothole", "priorityScore": 78, "status": "pending", "submittedAt": "..." },
  "priorityAnalysis": { "totalScore": 0.78, "priorityLevel": "HIGH", "breakdown": {...}, "reasoning": "..." },
  "location": { "privacyLevel": "exact", "accuracy": "±10m", "description": "..." },
  "contentAnalysis": { "authenticityScore": 0.81, "flagged": false, "hardBlocked": false, "mismatchDetected": false, "suggestedCategory": null, "reasons": [], "emotionScore": 0.6 },
  "nextSteps": ["..."]
}
```

**Response `200`** (duplicate detected): `{ "success": true, "duplicate": true, "complaint": {...}, "voteCount": n, "alreadyVoted": bool, "message": "..." }`

**Error responses**: `400` with `code: "MISSING_REQUIRED_FIELDS"`,
`"IMAGE_CATEGORY_MISMATCH"`, or `"DESCRIPTION_CATEGORY_MISMATCH"` depending
on which validation step failed.

### `GET /api/complaints`

Paginated, filterable complaint list.

**Query params**: `page`, `limit`, `status`, `category`, `userId`, `adminId`,
`sort` (column name, default `created_at`), `order` (`asc`/`desc`),
`latitude`, `longitude`, `radius` (meters — enables a bounding-box location
filter).

**Response**: `{ "success": true, "complaints": [...], "pagination": { "total", "page", "limit", "pages" } }`

If the request is authenticated, each complaint includes `userVoted: boolean`.

### `GET /api/complaints/all`

Returns every complaint, unfiltered and unpaginated, newest first.

### `GET /api/complaints/personal-reports`

Requires authentication. Returns the authenticated citizen's own complaints
with an Amazon-style 5-stage tracking timeline (`Submitted` → `Initial
Review` → `Assessment & Planning` → `Work in Progress` → `Completed`) plus
aggregate stats (`totalComplaints`, `resolved`, `inProgress`, `pending`,
`cancelled`).

### `GET /api/complaints/:id`

Single complaint, joined with the submitting user's name/email, current
vote count, and (if authenticated) whether the caller has voted.

### `POST /api/complaints/vote`

Requires authentication. Toggles the caller's upvote on a complaint.

**Body**: `{ "complaintId": "uuid" }`

**Response**: `{ "success": true, "message": "...", "data": { "complaint_id", "action": "voted" | "unvoted", "userVoted": bool, "voteCount": number } }`

### `GET /api/complaints/vote/status`

Requires authentication. **Query**: `complaintIds` — comma-separated list of
complaint UUIDs. Returns `{ "success": true, "data": { "<id>": boolean, ... } }`.

### `POST /api/complaints/create`

Legacy stub. Always returns `{ "success": true, "message": "Legacy endpoint - use /submit for new complaint submission" }` and performs no write.

### `POST /api/complaints/calculate-priority`

Preview-only priority calculation, run before final submission so the client
can show an estimated priority without creating a complaint.

**Body**: `{ "category": string, "description"?: string, "imageValidation"?: object, "locationData": { "latitude": number, "longitude": number, ... } }`

**Response**: `{ "success": true, "priorityScore": 0-100, "priorityLevel": "...", "reasoningSummary": "...", "reasoning": "...", "breakdown": {...}, "detailedBreakdown": {...}, "metadata": {...} }`

---

## Complaint Details (`/api/complaint-details`)

A second, detail-oriented complaint API focused on the single-complaint view,
voting, nearby discovery, and progress tracking.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:id` | Optional | Full complaint detail: submitter info, vote count/status, update history, and up to 5 similar complaints within 500 m. |
| POST | `/vote` | Required | Body: `{ complaintId, voteType: "upvote" \| "downvote" }`. Lower-level vote write (direct insert/update on `complaint_votes`) distinct from `/api/complaints/vote`'s toggle semantics. |
| GET | `/nearby` | Optional | Query: `latitude`, `longitude`, `distance` (meters, default 5000), `limit` (default 20). Returns complaints sorted by vote count then distance. |
| GET | `/:id/progress` | No | Returns the complaint joined with `complaint_stages` (officer/contractor assignment, estimated/actual completion dates) and `complaint_timeline`, plus a computed `progress.percentage`. |

---

## Admin (`/api/admin`)

Core admin dashboard and complaint moderation. No route-level authorization
check is currently enforced beyond the global permissive auth middleware —
access control for the admin UI is expected to be enforced at the client
routing layer (`userType === 'admin'`).

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Aggregate complaint and user statistics: totals by status, resolution rate, average resolution time (days), citizen/admin counts. |
| GET | `/complaints` | All complaints with filters (`status`, `priority` — maps `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` to score ranges, `category`, `days`, `flagged`), sorted by priority then recency, plus computed `statistics`. |
| GET | `/complaints/:id` | Single complaint with submitter details. |
| PUT | `/complaints/:id/status` | Body: `{ status, notes?, adminId? }`. `status` must be one of `pending`, `in_progress`, `resolved`, `rejected`. Sets `resolved_at` automatically when `status` is `resolved`. |

---

## Admin (Enhanced Workflow) (`/api/admin-enhanced`)

Served by `routes/adminMinimal.js` — despite the mount path, this is the
**active, current** admin-workflow API (the similarly-named
`adminEnhanced.js` and `adminSimplified.js` files are not mounted; see
[`ARCHITECTURE.md`](ARCHITECTURE.md#known-legacy-code)).

| Method | Path | Description |
|---|---|---|
| GET | `/test` | Trivial liveness probe for this route group. |
| GET | `/dashboard/overview` | Overview stats plus the top 5 complaints by `priority_score`. |
| GET | `/complaints/priority-queue` | The AI-ranked priority queue. Query: `limit`, `page`, `search`, `location`, `category`, `status`, `flagged`. Automatically omits pothole-geometry/`language` columns if those migrations haven't been applied yet (see `docs/DATABASE.md`). |
| GET | `/citizens` | All citizen accounts with real computed complaint/resolved counts. Query: `limit`, `search`, `sort` (`name` \| `recent`). |
| GET | `/citizens/:citizenId/details` | A citizen's full profile plus their complaints with the same 5-stage tracking timeline used by `/api/complaints/personal-reports`. |
| DELETE | `/citizens/:citizenId` | **Destructive.** Deletes the citizen and cascades: their `complaint_updates`, `complaint_workflow` rows, complaints, then the user record itself. |
| GET | `/complaints/:complaintId/details` | Complaint detail enriched with the real `complaint_workflow` row, transformed into a 3-stage (`Initial Review`, `Assessment`, `Resolution`) structure. Creates a default workflow row if one doesn't exist yet. |
| PUT | `/complaints/:complaintId/stage/:stageId` | Updates one workflow stage (`stageId` ∈ `{1,2,3}`). Body: `{ status \| stage_status, notes?, assigned_officer_id?, assigned_contractor_id?, estimated_cost? }`. `status` must be `pending`, `in_progress`, `completed`, or `cancelled`. Automatically promotes the parent complaint to `resolved` once all three stages are `completed`, or to `in_progress` once any stage starts. |
| POST | `/complaints/:complaintId/stage/next` | Advances a complaint from `pending` to `in_progress` (simple status-only progression; does not touch individual workflow stages). |
| PUT | `/complaints/:complaintId/status` | Direct status override, independent of the workflow stages. |
| GET | `/officers` | Static reference list of field officers (name, department). |
| GET | `/contractors` | Static reference list of contractors (name, specialization). |

---

## Image Analysis (`/api/image-analysis`)

Wraps the Roboflow "CityZen SAM3" workflow.

| Method | Path | Description |
|---|---|---|
| GET | `/categories` | The civic issue classes the model can detect: `pothole`, `fallen_tree`, `garbage_dumping`, `stray_cattle`, `fallen_electric_pole`, `concrete_structure_damage`, `road_waterlogging`. |
| GET | `/test-connection` | Reports whether `ROBOFLOW_API_KEY`/`ROBOFLOW_WORKSPACE`/`ROBOFLOW_WORKFLOW` are configured. |
| POST | `/validate-image` | Body: `{ imageUrl: string, category?: string }`. Runs the workflow and, if `category` is supplied, rejects (`allowUpload: false`) a photo that doesn't match the declared issue type. Base64 image input (`image` field) is not implemented — returns `400`. |
| POST | `/explain` | Body: `{ imageUrl: string, category?: string, complaintId?: string }`. Re-runs the workflow and returns an annotated segmentation image (base64) plus a human-readable detection summary. If `category` is omitted but `complaintId` is given, the category is looked up from the stored complaint. |
| POST | `/estimate-geometry` | Body: `{ complaintId, imageUrl, category?, primaryClass?, deviceTilt? }`. (Re-)runs pothole footprint/depth estimation and persists the result. Returns a documented placeholder if the geometry columns (`database/add_pothole_geometry_columns.sql`) aren't migrated yet. |

---

## Location Priority (`/api/location-priority`)

Infrastructure-proximity scoring, independent of the full submission flow —
useful for previews, bulk analysis, and service diagnostics.

| Method | Path | Description |
|---|---|---|
| POST | `/calculate` | Body: `{ latitude, longitude, complaintType, locationMeta? }`. Validates coordinates are within India's bounding box and `complaintType` is one of the app's 8 known categories, then returns a location-only priority score and nearby-facility breakdown. |
| POST | `/calculate-bulk` | Body: `{ locations: [...] }` (max 10). Runs `/calculate`'s logic over each location sequentially with a 1-second delay between calls (external API rate-limit courtesy). |
| GET | `/info` | Static capability/documentation payload: supported privacy levels, complaint-type tiers, priority-level definitions, and API limits. |
| GET | `/health` | Live health check — runs one real calculation against a fixed New Delhi coordinate to verify the Google Places integration is reachable. |
| GET | `/metrics` | Placeholder metrics payload (not backed by real usage tracking yet). |
| POST | `/comprehensive` | Body includes `latitude`, `longitude`, `complaintType`, `locationMeta?`, `imageAnalysis?`, `complaintData?` (`created_at`, `votes`, `status`), `description?`. Returns the **full** blended priority score (infrastructure + image + emotion + votes) — this is the same underlying calculation `/api/complaints/submit` uses internally. |

---

## Heat Map (`/api/heat-map`)

| Method | Path | Description |
|---|---|---|
| GET | `/data` | Query: `days` (default 30), `status`, `type`. Returns complaint points for map visualization. |
| GET | `/statistics` | Query: `days` (default 30). Dashboard-oriented aggregate statistics. |
| GET | `/filtered` | Query: `days`, `status`, `type`, `priority`, `minLat`, `maxLat`, `minLng`, `maxLng`. Bounding-box-filtered point set. |
| POST | `/refresh` | Forces a fresh data fetch (bypasses any internal caching). |
| GET | `/complaint/:id` | Placeholder — not yet implemented; returns a stub message. |

---

## Transcription (`/api/transcribe`)

### `POST /api/transcribe/audio`

Multipart form upload. Field `audio` (file, ≤ 50 MB, must be an
`audio/*` MIME type) and field `language` (optional, default `en`).
Transcribes using Sarvam AI (primary) or Wit.ai (fallback) and returns the
transcript **in the spoken language** — no translation step.

**Response**: `{ "success": true, "transcript": "...", "language": "en" }`
`502` on provider failure, with a user-facing "please try again or type your
complaint" message.

---

## Chatbot (`/api/chatbot`)

| Method | Path | Description |
|---|---|---|
| POST | `/message` | Body: `{ message, conversationHistory?, userId? (default "anonymous"), language? }`. Matches the message against a curated civic-knowledge base, then (if `GROQ_API_KEY` is configured) asks Groq to produce a grounded natural-language reply from that match. Falls back to the raw knowledge-base match text if Groq is unavailable. Returns `reply`, `confidence`, `category`, `suggestedActions`, `followUpSuggestions`. |
| GET | `/history/:userId` | Last 20 messages of that user's in-memory conversation session. |
| DELETE | `/history/:userId` | Clears that user's session. |
| GET | `/analytics` | Aggregate stats across all in-memory sessions: category distribution, average confidence. |

Conversation sessions are kept in an in-process `Map` (capped at the 100 most
recent users) — they are **not persisted** and are lost on server restart.
Not suitable as-is for a multi-instance deployment without moving session
state to Redis or a database, as the code's own comments note.

---

## Statistics (`/api/statistics`)

| Method | Path | Description |
|---|---|---|
| GET | `/debug` | Per-status complaint counts plus a sample of IDs/titles per status, for debugging status-value inconsistencies. |
| GET | `/summary` | Simple `{ total, pending, inProgress, resolved }` counts. |

---

## Transparency (`/api/transparency`)

### `GET /api/transparency/dashboard`

Public-facing transparency metrics: totals, resolution rate, category
breakdown with per-category resolution rate, a 9-month trend series,
estimated citizens impacted (category-weighted, capped at 50,000), average
resolution time, and community voting engagement stats.

---

## Emotion Analysis (`/api/emotion`)

| Method | Path | Description |
|---|---|---|
| POST | `/analyze` | Body: `{ text: string, category?: string, translation?: string }`. Returns urgency/concern/anger/frustration sub-scores blended into one `emotionScore`. |
| GET | `/test` | Runs three built-in multilingual (English/Hindi/Tamil) sample complaints through the analyzer and returns the results — a quick smoke test with no request body required. |

---

## Voting

CityZen exposes **three separate** voting surfaces, reflecting different
client needs — all ultimately converge on `services/voteService.js`, which
is the only place that actually mutates `complaints.vote_count`:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/complaints/vote` | Required | Toggle semantics; recomputes and persists `vote_count`. |
| POST | `/api/complaint-details/vote` | Required | Body: `{ complaintId, voteType }`. Lower-level, direct `complaint_votes` write. |
| POST | `/api/simplified-votes` | Required | Body: `{ complaintId }`. Toggle semantics with explicit upvote/downvote state transitions. |
| POST | `/api/guest-votes` | No | Body: `{ complaintId, deviceId? }`. Anonymous voting, deduplicated per `deviceId` once `database/add_device_id_to_complaint_votes.sql` has been applied; otherwise every guest vote counts with no way to undo it. |
| GET | `/api/guest-votes/status/:complaintId` | No | Query: `deviceId?`. Reports that device's vote status, or just the total count if dedup isn't migrated yet. |

---

## Feedback (`/api/feedback`)

| Method | Path | Description |
|---|---|---|
| POST | `/submit` | Body: `{ complaintId, rating (1-5), feedback?, improvements?, submittedAt? }`. Records a citizen's rating of their complaint's resolution. Self-heals by creating the `complaint_feedback` table via RPC if it's missing. |
| GET | `/stats` | Aggregate feedback stats for the admin dashboard: total count, average rating, 1–5 rating distribution, and the 10 most recent feedback entries with text. |

---

## Weather (`/api/weather`)

### `GET /api/weather`

Query: `lat`, `lon` (both optional; default to Chennai — `13.0827, 80.2707`).
Returns current weather and forecast data, used by the mobile app's weather
widget (rainfall/flooding context is relevant to several civic-hazard
categories).

---

## Cloudinary (`/cloudinary`)

### `POST /cloudinary/delete-image`

Body: `{ "public_id": string }`. Deletes an uploaded image from Cloudinary.
Used when a citizen removes a photo during complaint submission before
final save.
