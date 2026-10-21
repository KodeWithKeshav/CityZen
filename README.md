# 🏙️ CityZen (UrbanPulse) Monorepo

> **Intelligent, AI-Powered Civic Engagement & Incident Resolution Platform**

CityZen bridges the gap between citizens and municipal authorities with multimodal complaint reporting (image segmentation, speech-to-text, and natural language understanding), automated severity prioritization, and real-time civic dashboards.

---

## 📁 Repository Structure

```
CityZen/
├── backend/                       # Node.js Express API & AI Service Pipeline
│   ├── config/                   # Supabase & Cloudinary configurations
│   ├── database/                 # SQL schemas & migration scripts
│   ├── routes/                   # RESTful API endpoints (complaints, admin, chatbot, transcribe)
│   ├── services/                 # AI, priority engine, STT, and emotion analysis services
│   ├── utils/                    # Common utilities & logger
│   └── server.js                 # Express server entrypoint
│
└── frontend/                      # Unified Client Applications
    ├── app/                      # React Native / Expo Mobile Application
    │   ├── src/screens/          # Citizen & Admin mobile screens
    │   ├── src/i18n/             # Multilingual translations (6 languages)
    │   └── src/services/         # Mobile client services (Speech, Location, Supabase)
    │
    └── urbanpulse-web/           # Vite + React Web Application
        ├── src/pages/            # Citizen & Admin web portals
        ├── src/layouts/          # Responsive application layouts
        ├── src/i18n/             # Web i18n locale dictionaries
        └── src/services/         # API client layer
```

---

## 🌟 Key Features

* **Multimodal Issue Reporting**: Report civic issues using photos, voice recordings (multilingual STT via Sarvam / Qwen), and text.
* **AI Image Segmentation & Validation**: SAM3-based zero-shot instance segmentation for civic infrastructure issues (potholes, garbage, waterlogging, fallen poles).
* **Automated Priority Engine**: Analytic Hierarchy Process (AHP) multi-criteria priority scoring factoring issue severity, location criticality, authenticity, and emotion.
* **Multilingual Zero-Shot Content Authenticity**: DistilBERT & mDeBERTa zero-shot NLI models to prevent spam and detect category mismatch.
* **Civic Chatbot**: Knowledge-grounded civic assistant powered by Groq LPU inference.
* **Multilingual Localization**: Complete support for **6 languages**: English (`en`), Hindi (`hi`), Tamil (`ta`), Telugu (`te`), Kannada (`kn`), and Malayalam (`ml`).
* **Interactive GIS Maps**: Real-time incident heatmaps and cluster visualization using Leaflet / OpenStreetMap.

---

## 🚀 Quick Start

### 1. Prerequisites
* **Node.js**: `v18+` or `v20+`
* **npm**: `v9+`
* **Python**: `3.10+` (for optional Python AI microservices)

### 2. Environment Variables
* Configure `backend/.env` (Supabase credentials, Cloudinary, Groq, Sarvam, HuggingFace API keys).
* Configure `frontend/urbanpulse-web/.env` (`VITE_API_BASE_URL` or default to local/Render backend).

### 3. Installation
Install dependencies in workspaces:
```bash
# Install backend dependencies
cd backend && npm install

# Install web frontend dependencies
cd ../frontend/urbanpulse-web && npm install

# Install mobile app dependencies
cd ../app && npm install
```

### 4. Running the Platform
From the root directory:
```bash
# Start backend API (port 3001)
npm run dev:backend

# Start web client (port 5173)
npm run dev:web

# Start mobile Expo client
npm run start:mobile
```

---

## 📜 Commit History
This monorepo preserves the complete, unaltered commit history of both the backend and frontend repositories with their historical timelines intact.
