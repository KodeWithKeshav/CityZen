# Environment Variable Reference

This document lists every environment variable read by the CityZen backend,
web client, and mobile client, what it configures, and whether it is
required. No real credentials are included anywhere in this document —
replace every value with your own before running the project.

> Security note: `backend/.env` and `frontend/urbanpulse-web/.env` are
> git-ignored by this repository and should never be committed. If a key is
> ever committed by mistake, treat it as compromised, rotate it immediately
> at the provider, and remove it from git history.

## Backend (`backend/.env`)

### Core server

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `NODE_ENV` | No | `development` | `development` or `production`. Controls logging verbosity, CORS strictness, and error detail in responses. |
| `PORT` | No | `3001` | Port the Express server listens on. |
| `JWT_SECRET` | Yes in production | dev fallback | Secret used to sign and verify authentication tokens. The server throws on startup if this is unset in production. |
| `FRONTEND_URL` | No | — | Additional origin to allow in CORS, beyond the built-in localhost/Netlify/Vercel defaults. |

### Supabase (database and auth storage)

| Variable | Required | Description |
|---|:---:|---|
| `SUPABASE_URL` | Yes | Project URL from your Supabase dashboard. |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key. |

### Roboflow (AI image segmentation — "CityZen SAM3" workflow)

| Variable | Required | Description |
|---|:---:|---|
| `ROBOFLOW_API_KEY` | For image features | API key for your Roboflow account. |
| `ROBOFLOW_WORKSPACE` | For image features | Roboflow workspace slug that hosts the workflow. |
| `ROBOFLOW_WORKFLOW` | For image features | Slug of the deployed image-validation/segmentation workflow. |
| `ROBOFLOW_GEOMETRY_WORKFLOW` | For geometry estimation | Slug of the workflow used for pothole footprint/depth estimation. |
| `ROBOFLOW_API_URL` | No | Defaults to `https://serverless.roboflow.com`. |

Without these set, `services/imageAnalysisService.js` fails closed with an
explicit "Roboflow is not configured" error rather than silently skipping
validation.

### Speech-to-text and chatbot

| Variable | Required | Description |
|---|:---:|---|
| `SARVAM_API_KEY` | For voice-to-text | API key for Sarvam AI's multilingual speech-to-text provider. |
| `WIT_AI_TOKEN` | For voice-to-text (fallback provider) | Access token for the Wit.ai speech provider, used in `services/stt/providers`. |
| `GROQ_API_KEY` | For the AI chatbot | API key for Groq's LPU inference endpoint. |
| `GROQ_API_BASE` | No | Override for the Groq API base URL. |
| `GROQ_MODEL` | No | Override for the Groq model name used for grounded chatbot replies. |

### Content authenticity / NLP

| Variable | Required | Description |
|---|:---:|---|
| `HUGGING_FACE_API_KEY` / `HUGGINGFACE_API_TOKEN` | For zero-shot authenticity checks | Hugging Face Inference API token used by the multilingual zero-shot authenticity model. |
| `HF_AUTHENTICITY_MODEL` | No | Overrides the default zero-shot NLI model used for category-match/spam detection. |
| `DISTILBERT_SERVICE_URL` | For local emotion service | Base URL of the optional Python DistilBERT microservice (see `python_services/`). |

### Media storage

| Variable | Required | Description |
|---|:---:|---|
| `CLOUDINARY_CLOUD_NAME` | For image uploads | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | For image deletion endpoint | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | For image deletion endpoint | Cloudinary API secret. |

### Location / mapping

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `GOOGLE_PLACES_API_KEY` | For infrastructure-proximity scoring | — | Used by `LocationPriorityService` to find nearby hospitals, schools, police stations, etc. |
| `GOOGLE_GEOCODING_API_KEY` | Optional | — | Used for reverse geocoding where enabled. |
| `USE_OPENSTREETMAP` | No | `true` | Enables the OpenStreetMap/Nominatim/Overpass fallback path when Google Places is unavailable or unconfigured. |
| `NOMINATIM_URL` | No | `https://nominatim.openstreetmap.org` | Geocoding fallback endpoint. |
| `OVERPASS_URL` | No | `https://overpass-api.de/api/interpreter` | OSM facility-query endpoint. |
| `OSRM_URL` | No | `https://router.project-osrm.org` | Routing/distance fallback endpoint. |
| `PLACES_SEARCH_RADIUS` | No | `1000` | Default search radius (meters) for nearby-facility queries. |
| `MAX_PLACES_RESULTS` | No | `20` | Cap on facilities returned per query. |
| `LOCATION_CACHE_DURATION` | No | `86400` | Cache TTL (seconds) for location/facility lookups. |
| `ENABLE_LOCATION_FALLBACK` | No | `true` | Whether to fall back to OSM-based services if Google Places fails. |
| `PLACES_API_RATE_LIMIT` / `GEOCODING_API_RATE_LIMIT` | No | — | Soft rate-limit hints used internally. |

### Deployment metadata

| Variable | Required | Description |
|---|:---:|---|
| `SERVER_HOST` / `SERVER_URL` | No | Overrides for the host/URL reported in startup logs (`utils/networkUtils.js`). |
| `RENDER_EXTERNAL_URL` | No | Automatically set by Render; used to detect the public URL when deployed there. |

## Web client (`frontend/urbanpulse-web/.env`)

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `VITE_API_BASE_URL` | No | inferred from hostname | Base URL of the backend API. If unset, the client tries `http://{current-hostname}:3001`, falling back to `http://localhost:3001`. |
| `VITE_CLOUDINARY_URL` | For client-side uploads | — | Cloudinary unsigned-upload endpoint, e.g. `https://api.cloudinary.com/v1_1/<cloud_name>/image/upload`. |
| `VITE_CLOUDINARY_PRESET` | For client-side uploads | — | Cloudinary unsigned upload preset name. |
| `VITE_MAP_DEFAULT_LAT` | No | `20.5937` | Default map center latitude (India) shown before a user location is available. |
| `VITE_MAP_DEFAULT_LNG` | No | `78.9629` | Default map center longitude. |
| `VITE_MAP_DEFAULT_ZOOM` | No | `5` | Default Leaflet zoom level. |

A template is provided at `frontend/urbanpulse-web/.env.example` — copy it to
`.env` and fill in real values.

## Mobile client (`frontend/app`)

The Expo app reads its Supabase configuration from `frontend/app/config/supabase.js`
and the backend URL from its own config/service layer. When pointing the
mobile app at a deployed backend, set:

| Variable | Required | Description |
|---|:---:|---|
| `EXPO_PUBLIC_API_URL` | No | Overrides the backend base URL baked into the Expo build. |

## Summary: minimum viable local setup

To run the backend and web client locally with core complaint-management
features (auth, submission, voting, dashboards) working, you need at minimum:

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
JWT_SECRET=...
```

AI-dependent features (image validation, voice-to-text, the chatbot,
infrastructure-proximity scoring) degrade gracefully but will log explicit
"not configured" messages until their respective keys above are supplied.
