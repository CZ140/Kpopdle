<div align="center">

# K-POPDLE

**A daily K-pop music guessing game platform — Heardle-style, for 8 groups.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

![K-POPDLE Homepage](docs/screenshot-homepage.png)

</div>

---

## What is it?

K-POPDLE is a full-stack daily music quiz platform. Players listen to a short audio snippet and guess the song — with each wrong answer revealing a slightly longer clip. Every group has its own independent daily game, driven by a deterministic **HMAC-SHA256** algorithm so the answer is consistent for all players worldwide without any database.

Currently supports **8 groups** and **509 songs**, all with verified 30-second Deezer preview URLs.

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
- Up to **6 guesses**, each revealing a progressively longer audio clip (1s → 2s → 3s → 4s → 5s → 6s)
- Autocomplete search across the full group song catalog
- Skip to hear more time, or guess early to flex
- Stats tracked locally: win rate, current streak, max streak, guess distribution
- Shareable emoji grid result

![Game View](docs/screenshot-game.png)

### 📦 Archive Mode
Replay any past daily game. The same HMAC algorithm that picks today's song works for any past date — no extra storage needed. Archive results live in a separate localStorage namespace and never touch daily stats.

![Archive Modal](docs/screenshot-archive.png)

---

## Technical Highlights

### Stateless Daily Song Selection
The daily song is chosen with:
```
HMAC-SHA256(secret-{groupId}, KST-date-string) mod catalog_size
```
This means:
- Every player worldwide gets the same song with no coordination
- Historical games are fully reproducible without a database
- Each group's rotation is independent (secret namespaced per group)

### Audio Pipeline
Songs play as 30-second MP3 previews via the **Deezer public API** — no auth required. The server resolves a preview URL on each game load with a two-step fallback:
1. Direct lookup by stored Deezer track ID
2. Search fallback: `artist:"Name" title` query

Resolved URLs are held in a TTL memory cache to avoid redundant API calls on replays.

### Multi-Group Architecture
All routes are parameterised: `/api/:group/game/today`, `/api/:group/songs`, etc. A `validateGroup` middleware guards every route — inactive or unknown group IDs return 404, preventing catalog probing before a group launches.

### React Context for Shared Game State
A single `GroupContext` carries both the active `groupId` and `archiveDate` (`null` = today's game). All hooks (`useGame`, `useSongList`, `useStats`) read from this context — no prop drilling through the component tree. Switching archive dates remounts the `Game` component cleanly via a `key` prop.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, React Router v6, Tailwind CSS v4, Vite 7 |
| Backend | Node.js, Express |
| Audio | Deezer Public API (free, no auth) |
| Fonts | Poppins (UI), JetBrains Mono (data labels) |
| Storage | localStorage — namespaced per group + archive |

---

## Project Structure

```
├── client/                        # React frontend (Vite)
│   └── src/
│       ├── components/            # AudioPlayer, GuessInput, ArchiveModal, ...
│       ├── hooks/                 # useGame, useSongList, useStats, useAudioPlayer
│       ├── lib/                   # api.js, storage.js, GroupContext.js
│       └── pages/                 # HomePage, GroupPage
│
└── server/                        # Express backend
    └── src/
        ├── data/
        │   ├── groups.json        # Group registry (8 groups, colors, launchDate)
        │   └── groups/{id}/
        │       └── songs.json     # Per-group song catalog with Deezer IDs
        ├── middleware/            # validateGroup, cors, rateLimit
        ├── routes/                # /api/groups  /api/:group/game  /api/:group/songs
        └── services/              # dailySong, audioProvider, deezerPreview
```

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
# Clone
git clone https://github.com/CZ140/Twicedle.git
cd Twicedle

# Install dependencies
cd server && npm install
cd ../client && npm install

# Configure environment
cp server/.env.example server/.env
# Edit server/.env — set DAILY_SONG_SECRET to any random string

# Start (two terminals)
cd server && npm run dev    # API  → http://localhost:3001
cd client && npm run dev    # App  → http://localhost:5173
```

---

## Roadmap

- [x] Phase 1 — Multi-group architecture & K-POPDLE homepage
- [x] Phase 2 — Song databases for all 8 groups (509 songs, Deezer-verified)
- [x] Phase 4 — Archive mode (replay any past daily game)
- [ ] Phase 3 — Practice mode (unlimited random rounds, no stats)
- [ ] Phase 5 — Hint system (era / year / first letter)
- [ ] Phase 6 — Difficulty modes (Easy / Normal / Hard clip lengths)
- [ ] Phase 7 — Cross-group challenge (daily game drawn from all 8 catalogs)
- [ ] Phase 8 — User accounts (magic-link auth, cloud streak sync)

---

<div align="center">
  <sub>Built by Chris &nbsp;·&nbsp; A new song every day at midnight KST ♥</sub>
</div>
