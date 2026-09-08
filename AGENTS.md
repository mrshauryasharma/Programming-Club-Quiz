# Programming Club Quiz — Project Guidelines & Master Rules

## 1. Project Identity
- **Product Name**: Programming Club Quiz
- **Organization**: USICT GBU Programming Club (SOICT, Gautam Buddha University)
- **Tagline**: LEARN • CONNECT • EXPLORE • GROW
- **Scope**: Dedicated internal platform for Programming Club workshops, sessions, competitions, and technical quizzes. NOT a public quiz marketplace or SaaS.

## 2. Roles & Access
- **Programming Club Organizer**: Authenticated access to create, manage, preview quizzes, control live sessions, monitor participants, view analytics, and export results. Never call this role "Teacher".
- **Participant / Student**: No account required. Joins live quiz via manual Game Code or QR Code.
- **Separate Routes**:
  - Participant/Public route: `/` directly renders the Game Code / Join interface. No organizer login/dashboard exposed here.
  - Organizer routes: `/organizer/login`, `/organizer/dashboard`, `/organizer/quizzes`, etc.

## 3. Participant Information
- **Required Fields**:
  1. Name (Required)
  2. Roll No (Required)
  3. Department (Required, select dropdown)
  4. Email ID (Required)
- **Forbidden Fields**: Nickname (permanently removed), Primary Interest Area, Other Interest Area.
- **Department List**: Must use official names from `src/config/departments.ts`. Do not fabricate department names.

## 4. Database & Realtime
- **Database**: Supabase (PostgreSQL).
- **Realtime**: Supabase Realtime (Broadcast and Presence channels).
- **Socket.IO**: Permanently forbidden. Do NOT install or use Socket.IO.
- **Server Authority**: The server is authoritative for scoring, ranking, correctness, timers, anti-cheat warning counts, removals, and session lifecycle. Never trust the client for state calculations.

## 5. Scoring Rules (Absolute)
- **Correct Answer**: Exactly +2 points.
- **Wrong / Missed Answer**: 0 points.
- **No Bonus**: No speed bonus, no partial score, no streaks, no multipliers.
- **10 Questions = Maximum 20 Points**.
- **Response Time**: Recorded in milliseconds for analytics, question review, and tie-breaking on the leaderboard (faster total valid time wins tie). Response time NEVER grants bonus points.

## 6. Question & Timer Rules
- **Question Type**: Single-choice MCQ only.
- **Timer**: Per-question countdown. Maximum 120 seconds.
- **Presets**: 10s, 15s, 20s, 30s, 45s, 60s, 90s, 120s. Custom timer supported (must be <= 120s).
- Server rejects submissions after question time limit expires.

## 7. Anti-Cheat System
- Detects browser visibility change, tab switching, and window blur.
- **Violation Rules**:
  - Violation 1: Warning 1 (Participant remains in session).
  - Violation 2: Warning 2 (Participant remains in session).
  - Violation 3: Warning 3 + IMMEDIATE REMOVAL (Participant is banned from answering and session).
- **No reset**: Warnings persist server-side and never reset upon tab return, page refresh, or reconnect.
- **Network Disconnect**: Normal network disconnect is NOT cheating. Network reconnection must restore session without incrementing warning count.

## 8. Presentation & Views
- **Projector View**: Dedicated large-screen view (`/session/[code]/projector`) for classrooms/auditoriums. High contrast, large typography, minimal clutter, showing question, options, timer, live results, leaderboard, and join QR code.
- **Mobile Responsive**: Participant UI is touch-first and answer-focused.

## 9. Design System & Branding
- **Color Palette**:
  - Deep Navy: `#031246`
  - Purple: `#7F1BB0`
  - Blue/Purple: `#3C3380`
  - Light Background: `#F7F4FE`
  - Dark Surface: `#020205`
  - Light Blue/Gray: `#CBD5E3`
  - White: `#FFFFFF`
- **Themes**: Light mode, Dark mode, and System mode supported.
- **Logo**: Official Programming Club logo (`/logo.png`) displayed prominently.

## 10. Exports & Analytics
- **Exports**: CSV, Excel (.xlsx), and PDF generation with real verified data.
- **Analytics**: Question accuracy, difficulty, response time averages, fastest answer, most missed question. Real data only.

## 11. AI Integration
- **Provider**: Meta AI only (if AI quiz generation is used). No Gemini, no DeepSeek, no silent fallback.
