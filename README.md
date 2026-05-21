<div align="center">

# K-POPDLE

**A daily K-pop music guessing game platform — Heardle-style, for 8 groups.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org)

![K-POPDLE Homepage](docs/screenshot-homepage.png)

</div>

---

## What is it?

K-POPDLE is a full-stack daily music quiz platform. Players listen to a short audio snippet and guess the song — with each wrong answer revealing a slightly longer clip. Every group has its own independent daily game, driven by a deterministic **HMAC-SHA256** algorithm so the answer is consistent for all players worldwide.

Currently supports **8 groups** and **509 songs**, all with verified 30-second Deezer preview URLs. All song titles use their English names so every song is typeable on a standard keyboard.

---

## Features

### 🎵 Multi-Group Platform
Eight K-pop groups, each with their own daily game, color theme, and branded name. The K-POPDLE homepage shows all groups at a glance with glassmorphic cards and live solved-state detection from localStorage.

| Group | Game | Songs |
|---|---|---|
| TWICE | TWICEDLE | 100 |
| NewJeans | NEWJEANDLE | 21 |
| LE SSERAFIM | SERAFIDLE | 47 |
| aespa | AESPADLE | 74 |
| Red Velvet | VELVETLE | 130 |
| KISS OF LIFE | KOLFDLE | 43 |
| IVE | IVEDLE | 58 |
| BLACKPINK | BPINKDLE | 36 |

### 🎮 Daily Game
- Up to **6 guesses**, each revealing a progressively longer audio clip
- Autocomplete search across the full group song catalog (Tab to complete, Enter to submit exact match)
- Skip to hear more, or guess early to flex
- After winning or losing, the full 30-second preview unlocks for replay
- Stats tracked locally: win rate, current streak, max streak, guess distribution
- Shareable emoji grid result (includes difficulty badge and 💡 for hints used)

![Game View](docs/screenshot-game.png)

### 💡 Hint System
Three optional hints, revealed one at a time — era (album name), release year, and first letter of the song title. Hints are tracked per game and shown in the share output and result modal. Using hints doesn't cost a guess.

### 🎚️ Difficulty Modes
Three clip-length presets selectable at any time from the header. Persists across sessions.

| Guess | Easy | Normal | Hard |
|---|---|---|---|
| 1 | 3s | 1s | 0.5s |
| 2 | 5s | 2s | 1s |
| 3 | 8s | 3s | 1.5s |
| 4 | 10s | 4s | 2s |
| 5 | 12s | 5s | 3s |
| 6 | 15s | 6s | 4s |

### 🎯 Practice Mode
After completing the daily game, switch into unlimited practice with random songs from the same group's catalog. Practice runs don't affect streaks or stats.

### 📦 Archive Mode
Replay any past daily game. The same HMAC algorithm that picks today's song works for any past date — no extra storage needed. Archive results are namespaced separately and never touch daily stats.

![Archive Modal](docs/screenshot-archive.png)

### 🌐 K-POPDLE — Cross-Group Daily Challenge
A separate daily game at `/kpopdle` that draws from the full merged catalog of all 8 active groups. The song could be from any group — players must identify it without knowing which group it's from. The autocomplete labels each song with its group (e.g. `Black Mamba (aespa)`) for disambiguation, and the group is revealed in the result. Share output correctly labels results as `K-POPDLE #N M/6`. Archive mode is fully supported — replay any past K-POPDLE game from the archive button.

### 🔐 User Accounts
Sign in with Google to sync your streaks, guess distributions, and game history across any device. Accounts are optional — the game is fully playable without signing in, with all stats kept in localStorage. On first login, existing localStorage stats are automatically imported to the cloud. After each daily game, stats are synced to the server so they're available on any device. A sign-in prompt appears once per browser session after your first completed game. Logged-in users see their Google avatar in the header and a "synced" indicator in the stats modal. Full GDPR account and data deletion available.

### 📊 Analytics Collection
Every completed daily game anonymously records: group, song, guess count, win/loss, every wrong guess made, hints used, and difficulty. Stored in a local SQLite database and queryable via API endpoints.

---

## Technical Highlights

### Deterministic Daily Song Selection
The daily song is chosen with:
```
HMAC-SHA256(secret-{groupId}, KST-date-string) mod catalog_size
```
This means:
- Every player worldwide gets the same song with no coordination
- Historical games are fully reproducible — the archive works without storing any past state
- Each group's rotation is independent (secret namespaced per group)

### Audio Pipeline
Songs play as 30-second MP3 previews via the **Deezer public API** — no auth required. The server resolves preview URLs with a two-step fallback:
1. Direct lookup by stored Deezer track ID
2. Artist + title search fallback

On startup the server pre-warms the preview URL cache for all 8 active groups sequentially, so the first player each day never waits on Deezer.

### Analytics Database
Game results are written to a SQLite database (`better-sqlite3`) at the end of every daily game. Three query endpoints expose aggregated insights:

| Endpoint | Returns |
|---|---|
| `GET /api/stats/summary` | Per-group win rate, avg guesses, hint usage, difficulty split |
| `GET /api/stats/songs/:group` | Song difficulty ranking — hardest songs first |
| `GET /api/stats/confusion/:group` | Most common wrong guesses per song (confusion matrix) |

The POST is fire-and-forget from the client — it never blocks or affects gameplay. The record endpoint has its own tighter rate limit (10/min) and full input validation to prevent analytics pollution.

### Security
- Content-Security-Policy header restricts script, style, media, font, and image sources
- Per-route rate limiting on sensitive endpoints (tighter than the global 100/15min baseline)
- All DB writes use parameterized queries (no SQL injection surface)
- `httpOnly` session cookies with `sameSite: lax` and `secure` in production
- `ON DELETE CASCADE` throughout the user tables for clean GDPR erasure

### Multi-Group Architecture
All routes are parameterised: `/api/:group/game/today`, `/api/:group/songs`, etc. A `validateGroup` middleware guards every route — inactive or unknown group IDs return 404, preventing catalog probing before a group launches.

### React Context for Shared State
A single `GroupContext` carries the active `groupId`, `archiveDate`, `practiceMode`, and `difficulty`. All hooks (`useGame`, `useSongList`, `useStats`) read from this context — no prop drilling through the component tree.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, React Router v6, Tailwind CSS v4, Vite 7 |
| Backend | Node.js, Express |
| Database | SQLite via `better-sqlite3` (analytics + user accounts) |
| Auth | Google OAuth2 via Passport.js, server-side sessions |
| Audio | Deezer Public API (free, no auth) |
| Client storage | localStorage — namespaced per group (stats, streaks, game state) |
| Fonts | Poppins (UI), JetBrains Mono (data labels) |

---

## Project Structure

```
├── client/                        # React frontend (Vite)
│   └── src/
│       ├── components/            # AudioPlayer, GuessInput, ArchiveModal, ...
│       ├── hooks/                 # useGame, useSongList, useStats, useAudioPlayer
│       ├── lib/                   # api.js, storage.js, GroupContext.js, share.js
│       └── pages/                 # HomePage, GroupPage
│
└── server/                        # Express backend
    └── src/
        ├── data/
        │   ├── groups.json        # Group registry (8 groups, colors, launchDate)
        │   ├── groups/{id}/
        │   │   └── songs.json     # Per-group song catalog with Deezer IDs
        │   └── stats.db           # SQLite analytics database (git-ignored)
        ├── middleware/            # validateGroup, cors, rateLimit
        ├── routes/                # groups, game, songs, stats
        └── services/              # dailySong, audioProvider, deezerPreview, statsDb
```

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
# Clone
git clone https://github.com/CZ140/Twicedle.git
cd Twicedle

# Install all dependencies
npm run install:all

# Configure environment
cp server/.env.example server/.env
# Edit server/.env — set DAILY_SONG_SECRET to any random string

# Start both client and server
npm run dev
# Client → http://localhost:3000
# API    → http://localhost:3001
```

On first start the server warms the Deezer preview cache for all 8 groups before serving requests — you'll see `Cache warm.` in the terminal when it's ready.

---

## Roadmap

- [x] Phase 1 — Multi-group architecture & K-POPDLE homepage
- [x] Phase 2 — Song databases for all 8 groups (509 songs, Deezer-verified)
- [x] Phase 3 — Practice mode (unlimited random rounds, no stats impact)
- [x] Phase 4 — Archive mode (replay any past daily game)
- [x] Phase 5 — Hint system (era / year / first letter, tracked in share output)
- [x] Phase 6 — Difficulty modes (Easy / Normal / Hard clip lengths)
- [x] Phase 7 — K-POPDLE cross-group challenge (daily game drawn from all 8 catalogs, group revealed on finish)
- [x] Phase 8 — User accounts (Google OAuth, cloud streak + stats sync, GDPR account deletion)

---

<div align="center">
  <sub>Built by <a href="https://github.com/CZ140">Chris</a> &nbsp;·&nbsp; A new song every day at midnight KST ♥</sub>
</div>
