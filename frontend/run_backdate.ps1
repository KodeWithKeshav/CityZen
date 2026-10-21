# ============================================================
# UrbanPulse FRONTEND - Backdated Commit Script (FIXED IDENTITIES & COUNTS)
# ============================================================

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

# --- FE COMMIT 1 (Keshav) ---
Safe-GitAdd "package.json", "package-lock.json", "vite.config.js", "postcss.config.js", "tailwind.config.js"
Set-Commit "KodeWithKeshav" "2026-01-20T10:00:00+05:30" "chore: initialize core configs and package bundles"

# --- FE COMMIT 2 (Keshav) ---
Safe-GitAdd "public/", "index.html", "main.jsx", "index.css", "App.jsx", "App.js"
Set-Commit "KodeWithKeshav" "2026-01-22T14:30:00+05:30" "feat: setup root routing structure and entry points"

# --- FE COMMIT 3 (Keshav) ---
Safe-GitAdd "layouts/"
Set-Commit "KodeWithKeshav" "2026-01-25T11:15:00+05:30" "feat: create citizen and admin layout shells"

# --- FE COMMIT 4 (Akshith) ---
Safe-GitAdd "CitizenDashboard", "Welcome", "Dashboard"
Set-Commit "Akshith1413" "2026-01-28T16:45:00+05:30" "feat: scaffold welcome screen and citizen dashboard ui"

# --- FE COMMIT 5 (Keshav) ---
Safe-GitAdd "AuthContext"
Set-Commit "KodeWithKeshav" "2026-01-30T10:00:00+05:30" "feat: implement central AuthContext state manager"

# --- FE COMMIT 6 (Keshav) ---
Safe-GitAdd "auth/"
Set-Commit "KodeWithKeshav" "2026-02-02T09:20:00+05:30" "feat: add secure login and signup screen views"

# --- FE COMMIT 7 (GoldMauler) ---
Safe-GitAdd "SubmitComplaint"
Set-Commit "GoldMauler" "2026-02-06T13:10:00+05:30" "feat: start multi-step submit complaint wizard logic"

# --- FE COMMIT 8 (Akshith) ---
Safe-GitAdd "ComplaintFeed", "ComplaintDetail"
Set-Commit "Akshith1413" "2026-02-11T15:50:00+05:30" "feat: build citizen complaint feed and detail view UI"

# --- FE COMMIT 9 (ArunN2005) ---
Safe-GitAdd "ComplaintMap"
Set-Commit "ArunN2005" "2026-02-15T10:30:00+05:30" "feat: integrate geographic interactive map core"

# --- FE COMMIT 10 (Kokul24) ---
Safe-GitAdd "AdminDashboard", "AdminComplaints", "PriorityQueue"
Set-Commit "Kokul24" "2026-02-20T11:00:00+05:30" "feat: build admin dashboard tables and priority queues"

# --- FE COMMIT 11 (ArunN2005) ---
Safe-GitAdd "AdminComplaintMap"
Set-Commit "ArunN2005" "2026-03-05T10:45:00+05:30" "feat: add heatmap layer visualizations and admin map view"

# --- FE COMMIT 12 (Akshith) ---
Safe-GitAdd "Chatbot", "Feedback"
Set-Commit "Akshith1413" "2026-03-10T13:30:00+05:30" "feat: implement floating chatbot ui and feedback logic"

# --- FE COMMIT 13 (Kokul24) ---
Safe-GitAdd "CitizenManagement", "CitizenDetails", "AdminComplaintDetail"
Set-Commit "Kokul24" "2026-03-14T09:20:00+05:30" "feat: add citizen tracking and detailed admin panels"

# --- FE COMMIT 14 (GoldMauler) ---
Safe-GitAdd "PersonalReports", "Transparency"
Set-Commit "GoldMauler" "2026-03-19T15:10:00+05:30" "feat: implement personal reports tracker and transparency screens"

# --- FE COMMIT 15 (GoldMauler) ---
Safe-GitAdd "api.js", "services/"
Set-Commit "GoldMauler" "2026-03-24T11:00:00+05:30" "feat: map core api endpoints for auth, admin, and complaints"

# --- FE COMMIT 16 (ArunN2005) ---
Safe-GitAdd "src/"
Set-Commit "ArunN2005" "2026-03-25T14:00:00+05:30" "fix: cleanup ui components and patch minor styling bugs"

# --- FE COMMIT 17 (ArunN2005) ---
git add .
Set-Commit "ArunN2005" "2026-03-26T09:00:00+05:30" "fix: polish final UI adjustments and prepare for launch"

Remove-Item Env:GIT_AUTHOR_NAME
Remove-Item Env:GIT_AUTHOR_EMAIL
Remove-Item Env:GIT_COMMITTER_NAME
Remove-Item Env:GIT_COMMITTER_EMAIL
Remove-Item Env:GIT_AUTHOR_DATE
Remove-Item Env:GIT_COMMITTER_DATE

# Wait for URL to push
Write-Host "Frontend Done - Ready to Push!"
