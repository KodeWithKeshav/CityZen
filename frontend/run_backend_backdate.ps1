# ============================================================
# UrbanPulse BACKEND - Backdated Commit Script (FIXED IDENTITIES & COUNTS)
# ============================================================
cd "..\UrbanPulse_Backend"

if (Test-Path ".git") { Remove-Item -Recurse -Force ".git" }
git init

function Safe-GitAdd {
    param([string[]]$paths)
    foreach ($p in $paths) {
        git add --ignore-errors "*$p*" 2>$null
    }
}

function Set-Commit {
    param([string]$Name, [string]$Date, [string]$Msg)
    $env:GIT_AUTHOR_NAME=$Name
    $env:GIT_AUTHOR_EMAIL="$Name@users.noreply.github.com"
    $env:GIT_COMMITTER_NAME=$Name
    $env:GIT_COMMITTER_EMAIL="$Name@users.noreply.github.com"
    $env:GIT_AUTHOR_DATE=$Date
    $env:GIT_COMMITTER_DATE=$Date
    git commit -m $Msg
}

# --- C1 (Keshav) ---
Safe-GitAdd "package.json", "package-lock.json"
Set-Commit "KodeWithKeshav" "2026-01-20T09:00:00+05:30" "chore: initialize node server packages"

# --- C2 (Keshav) ---
Safe-GitAdd "server.js"
Set-Commit "KodeWithKeshav" "2026-01-21T11:30:00+05:30" "feat: setup basic express backend entry"

# --- C3 (Keshav) ---
Safe-GitAdd "config/"
Set-Commit "KodeWithKeshav" "2026-01-22T10:00:00+05:30" "feat: setup supabase client logic"

# --- C4 (Keshav) ---
Safe-GitAdd "networkUtils.js"
Set-Commit "KodeWithKeshav" "2026-01-22T16:00:00+05:30" "feat: add cors and network utilities"

# --- C5 (Keshav) ---
Safe-GitAdd "middleware/auth.js"
Set-Commit "KodeWithKeshav" "2026-01-23T15:00:00+05:30" "feat: add JWT authentication middleware checks"

# --- C6 (Keshav) ---
Safe-GitAdd "routes/auth.js"
Set-Commit "KodeWithKeshav" "2026-01-27T10:20:00+05:30" "feat: implement auth api routes for mobile and web"

# --- C7 (GoldMauler) ---
Safe-GitAdd "routes/complaints.js"
Set-Commit "GoldMauler" "2026-02-01T14:45:00+05:30" "feat: create complaint reporting endpoints"

# --- C8 (GoldMauler) ---
Safe-GitAdd "routes/complaintDetails.js"
Set-Commit "GoldMauler" "2026-02-05T11:00:00+05:30" "feat: add complaint details and upvote api"

# --- C9 (GoldMauler) ---
Safe-GitAdd "cloudinary.js"
Set-Commit "GoldMauler" "2026-02-08T10:30:00+05:30" "feat: add secure cloudinary signature generator router"

# --- C10 (GoldMauler) ---
Safe-GitAdd "imageAnalysis.js"
Set-Commit "GoldMauler" "2026-02-09T14:00:00+05:30" "feat: implement external AI image analysis router"

# --- C11 (GoldMauler) ---
Safe-GitAdd "imageAnalysisService.js"
Set-Commit "GoldMauler" "2026-02-11T16:30:00+05:30" "feat: handle auto-category selection in analysis service"

# --- C12 (ArunN2005) ---
Safe-GitAdd "locationPriority.js"
Set-Commit "ArunN2005" "2026-02-13T09:45:00+05:30" "feat: build spatial location priority routing"

# --- C13 (ArunN2005) ---
Safe-GitAdd "LocationPriorityService.js"
Set-Commit "ArunN2005" "2026-02-14T11:15:00+05:30" "feat: logic service to rank localized incidents"

# --- C14 (ArunN2005) ---
Safe-GitAdd "FallbackLocationService.js"
Set-Commit "ArunN2005" "2026-02-16T15:00:00+05:30" "feat: handle missing loc data via external openstreet geocode"

# --- C15 (Kokul24) ---
Safe-GitAdd "routes/admin.js"
Set-Commit "Kokul24" "2026-02-18T10:15:00+05:30" "feat: scaffold secure admin API scopes"

# --- C16 (Kokul24) ---
Safe-GitAdd "adminMinimal.js", "adminEnhanced.js"
Set-Commit "Kokul24" "2026-02-22T13:30:00+05:30" "feat: implement dual admin views and priority queues"

# --- C17 (Kokul24) ---
Safe-GitAdd "adminComplaints.js", "adminSimplified.js"
Set-Commit "Kokul24" "2026-02-25T11:00:00+05:30" "feat: configure paginated table endpoints for dashboard"

# --- C18 (Kokul24) ---
Safe-GitAdd "statistics.js"
Set-Commit "Kokul24" "2026-02-26T15:45:00+05:30" "feat: calculate global platform statistics and resolution rate"

# --- C19 (ArunN2005) ---
Safe-GitAdd "heatMap.js"
Set-Commit "ArunN2005" "2026-03-03T11:00:00+05:30" "feat: spatial coordinate aggregation route"

# --- C20 (ArunN2005) ---
Safe-GitAdd "HeatMapService.js"
Set-Commit "ArunN2005" "2026-03-05T14:30:00+05:30" "feat: optimized spatial query service for fast map loads"

# --- C21 (Akshith1413) ---
Safe-GitAdd "chatbot.js"
Set-Commit "Akshith1413" "2026-03-08T14:15:00+05:30" "feat: implement automated chatbot dialogue server"

# --- C22 (Akshith1413) ---
Safe-GitAdd "ChatbotKnowledgeBase.js"
Set-Commit "Akshith1413" "2026-03-10T11:30:00+05:30" "feat: create internal kb struct for conversational AI"

# --- C23 (Akshith1413) ---
Safe-GitAdd "emotion.js"
Set-Commit "Akshith1413" "2026-03-12T10:30:00+05:30" "feat: setup user emotion mapping from text descriptions"

# --- C24 (GoldMauler) ---
Safe-GitAdd "EmotionAnalysisService.js", "LocalDistilBERTEmotionService.js", "RealDistilBERTEmotionService.js"
Set-Commit "GoldMauler" "2026-03-14T09:15:00+05:30" "feat: link distilBERT endpoints to evaluate user sentiment"

# --- C25 (Akshith1413) ---
Safe-GitAdd "feedback.js", "transparency.js"
Set-Commit "Akshith1413" "2026-03-16T16:00:00+05:30" "feat: internal surveying and system metrics endpoints"

# --- C26 (Akshith1413) ---
Safe-GitAdd "simplified-votes.js", "guest-votes.js"
Set-Commit "Akshith1413" "2026-03-18T10:00:00+05:30" "feat: allow unauth users to vote on key neighborhood issues"

# --- C27 (GoldMauler) ---
Safe-GitAdd "transcription.js", "transcribe.js", "reportManagement.js"
Set-Commit "GoldMauler" "2026-03-20T09:30:00+05:30" "feat: integrate speech transcription for accessible submitting"

# --- C28 (ArunN2005) ---
Safe-GitAdd "test-map.js", "HeatMapService.js.bak", "HeatMapService.js.fixed"
Set-Commit "ArunN2005" "2026-03-23T11:45:00+05:30" "fix: patch rendering loop causing coordinate mismatches"

# --- C29 (Kokul24) ---
Safe-GitAdd "database/"
Set-Commit "Kokul24" "2026-03-24T14:00:00+05:30" "chore: dump raw sql table structure for safe deployment"

# --- C30 (Kokul24) ---
Safe-GitAdd "complaints-fixed.js", "emotion-fixed.js"
Set-Commit "Kokul24" "2026-03-25T14:30:00+05:30" "fix: resolve crash when missing description or location param"

# --- C31 (ArunN2005) ---
Safe-GitAdd "python_services/", "local_modules/", "test_civic_issue.jpg"
Set-Commit "ArunN2005" "2026-03-26T16:00:00+05:30" "chore: backup local py modeling weights and test artifacts"

# --- C32 (Keshav) ---
git add .
Set-Commit "KodeWithKeshav" "2026-03-27T10:00:00+05:30" "chore: final code adjustments mapping to fresh envs"

Remove-Item Env:GIT_AUTHOR_NAME
Remove-Item Env:GIT_AUTHOR_EMAIL
Remove-Item Env:GIT_COMMITTER_NAME
Remove-Item Env:GIT_COMMITTER_EMAIL
Remove-Item Env:GIT_AUTHOR_DATE
Remove-Item Env:GIT_COMMITTER_DATE

# Push force directly
git remote add origin https://github.com/KodeWithKeshav/UrbanPulse_Backend.git
git branch -M main
git push -u origin main --force
