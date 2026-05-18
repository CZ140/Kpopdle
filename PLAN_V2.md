# Twicedle V2 — Planning Document

**Created:** 2026-05-17  
**Last Updated:** 2026-05-17  
**Status:** Decisions confirmed — ready to implement Phase 1  
**Goal:** Expand Twicedle from a single-group TWICE game into a full K-pop Heardle platform supporting multiple groups, new game modes, and deeper gameplay.

---

## Table of Contents

1. [Rebrand Decision](#1-rebrand-decision)
2. [Feature Roadmap](#2-feature-roadmap)
3. [Phase 1 — Multi-Group Architecture](#phase-1--multi-group-architecture)
4. [Phase 2 — Song Databases (New Groups)](#phase-2--song-databases-new-groups)
5. [Phase 3 — Practice Mode](#phase-3--practice-mode)
6. [Phase 4 — Archive Mode](#phase-4--archive-mode)
7. [Phase 5 — Hint System](#phase-5--hint-system)
8. [Phase 6 — Difficulty Modes](#phase-6--difficulty-modes)
9. [Phase 7 — Cross-Group Challenge](#phase-7--cross-group-challenge)
10. [Phase 8 — User Accounts](#phase-8--user-accounts)
11. [Technical Debt & Hardening](#technical-debt--hardening)
12. [Implementation Order](#implementation-order)

---

## 1. Rebrand Decision

**CONFIRMED:** Platform name is **K-popdle**.

Each group's individual game page keeps its own branded title:
- TWICE → **TWICEDLE** (unchanged)
- NewJeans → **NEWJEANDLE**
- LE SSERAFIM → **SERAFIDLE**
- Red Velvet → **VELVETLE**
- aespa → **AESPADLE**
- KISS OF LIFE → **KOLFDLE**
- IVE → **IVEDLE**
- BLACKPINK → **BPINKDLE**

The K-popdle homepage is the platform entry — group cards link to individual game pages. Each group page keeps its own branding, colors, and game counter.

---

## 2. Feature Roadmap

| Phase | Feature | Complexity | Impact | Dependency |
|---|---|---|---|---|
| 1 | Multi-Group Architecture | High | Critical | None |
| 2 | Song Databases (8+ groups) | Medium (data work) | High | Phase 1 |
| 3 | Practice Mode | Low | High | Phase 1 |
| 4 | Archive Mode | Low | Medium | Phase 1 |
| 5 | Hint System | Medium | Medium | Phase 1 |
| 6 | Difficulty Modes | Low | Medium | Phase 1 |
| 7 | Cross-Group Challenge | Medium | High | Phase 2 |
| 8 | User Accounts | High | Medium | Phases 1-4 |

---

## Phase 1 — Multi-Group Architecture

### What Changes

Everything TWICE-specific becomes group-parameterized. The app gets a homepage group selector.

### Backend Changes

#### File Structure — New Layout
```
server/src/
├── data/
│   ├── groups/
│   │   ├── twice/songs.json        (existing songs.json moved here)
│   │   ├── newjeans/songs.json     (added in Phase 2)
│   │   ├── lesserafim/songs.json
│   │   ├── redvelvet/songs.json
│   │   ├── aespa/songs.json
│   │   └── kissoflife/songs.json
│   ├── groups.json                  (NEW — group metadata registry)
│   └── songIndex.js                 (updated — accepts groupId)
├── routes/
│   ├── game.js     → /api/:group/game/today + /api/:group/game/guess
│   ├── songs.js    → /api/:group/songs
│   └── groups.js   (NEW — GET /api/groups — returns group list)
├── services/
│   ├── dailySong.js    (updated — accepts groupId)
│   └── audioProvider.js (unchanged)
└── index.js            (updated — mount new routes)
```

#### `groups.json` — New File
```json
[
  {
    "id": "twice",
    "displayName": "TWICE",
    "gameName": "TWICEDLE",
    "tagline": "Daily TWICE Song Quiz",
    "colors": { "primary": "#FF2D78", "secondary": "#A855F7" },
    "launchDate": "2026-02-20",
    "active": true
  },
  {
    "id": "newjeans",
    "displayName": "NewJeans",
    "gameName": "NEWJEANDLE",
    "tagline": "Daily NewJeans Song Quiz",
    "colors": { "primary": "#06B6D4", "secondary": "#8B5CF6" },
    "launchDate": "2026-05-17",
    "active": false
  }
]
```
`active: false` gates groups that have no songs yet.

#### `songIndex.js` — Updated
Current: loads `songs.json` once at module initialization.  
New: `getSongsForGroup(groupId)`, `getSongTitlesForGroup(groupId)`, `getSongCountForGroup(groupId)` — each loads the corresponding `groups/{groupId}/songs.json` file. Cache per group in a `Map` at module level.

#### `dailySong.js` — Updated
```js
// Before
export function getTodaysSong()

// After
export function getTodaysSong(groupId)
// Uses groupId to fetch that group's songs and to namespace the HMAC secret
// Secret: `${process.env.DAILY_SONG_SECRET}-${groupId}`
// This ensures each group has its own independent daily song rotation
```

#### Route Changes
```
Before:
  GET  /api/game/today
  POST /api/game/guess
  GET  /api/songs

After:
  GET  /api/groups                      (new — list all active groups)
  GET  /api/:group/game/today           (was /api/game/today)
  POST /api/:group/game/guess           (was /api/game/guess)
  GET  /api/:group/songs                (was /api/songs)
```

Route files accept `req.params.group`, validate it against the groups registry, then pass it down to service functions.

#### Validation
Add a middleware that checks `req.params.group` exists in `groups.json` and is `active: true`. Return 404 for unknown/inactive groups. This prevents probing.

### Frontend Changes

#### New Dependency
```
npm install react-router-dom
```

#### File Structure — New Layout
```
client/src/
├── pages/
│   ├── HomePage.jsx       (NEW — group selector)
│   └── GroupPage.jsx      (NEW — wraps current game for a specific group)
├── components/
│   ├── GroupCard.jsx      (NEW — card on homepage per group)
│   ├── Header.jsx         (updated — shows group name + back button)
│   └── ... (all existing components unchanged internally)
├── hooks/
│   ├── useGame.js         (updated — accepts groupId)
│   ├── useStats.js        (updated — accepts groupId for storage namespace)
│   └── useSongList.js     (updated — fetches /api/:group/songs)
├── lib/
│   ├── api.js             (updated — all calls include group in URL)
│   ├── storage.js         (updated — namespace all keys with groupId)
│   └── constants.js       (unchanged)
└── App.jsx                (updated — add Router, routes)
```

#### `App.jsx` — Updated
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import GroupPage from './pages/GroupPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:group" element={<GroupPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

#### `GroupPage.jsx` — New
Reads `:group` from URL params. Fetches group metadata to get colors/display name. Renders the existing `Header` + `Game` with group context passed via props (or a GroupContext provider).

#### `HomePage.jsx` — New
Fetches `GET /api/groups`. Renders a grid of `GroupCard` components. Each card navigates to `/:group`.

#### `GroupCard.jsx` — New
Displays: group logo/name, game name (e.g., TWICEDLE), number of songs in the catalog, "Play" CTA. Uses the group's primary/secondary colors for gradient styling.

#### `api.js` — Updated
```js
// Before
fetchDailyGame()         → GET /api/game/today
submitGuess(date, guess) → POST /api/game/guess
fetchSongList()          → GET /api/songs

// After
fetchDailyGame(group)         → GET /api/:group/game/today
submitGuess(group, date, guess) → POST /api/:group/game/guess
fetchSongList(group)          → GET /api/:group/songs
fetchGroups()                 → GET /api/groups  (new)
```

#### `storage.js` — Updated
All localStorage keys prefixed with group:
```js
// Before
const STATS_KEY = 'twicedle-stats'
const GAME_KEY_PREFIX = 'twicedle-game-'

// After
const statsKey = (group) => `${group}-stats`
const gameKey = (group, date) => `${group}-game-${date}`
```
Existing TWICE players keep their data because TWICE's group ID is `twice` → `twice-stats`. We **migrate** old keys on first load: if `twicedle-stats` exists and `twice-stats` doesn't, copy and rename.

#### Per-Group Theming
CSS custom properties set on `<body>` (or the root div) from group metadata:
```css
--color-primary: #FF2D78;
--color-secondary: #A855F7;
```
`GroupPage.jsx` applies these from the fetched group config. Tailwind classes that currently hardcode `twice-pink`/`twice-purple` are replaced with references to these CSS vars.

#### `Header.jsx` — Updated
- Shows dynamic group `gameName` instead of hardcoded "TWICEDLE"
- Shows `tagline` from group config
- Adds a back arrow `←` that navigates to `/` (homepage)
- Colors pulled from group theme vars

### Data Migration
On first load of the TWICE group page, check if old `twicedle-stats` / `twicedle-game-*` keys exist. If they do and the namespaced equivalents don't, silently migrate them. This preserves existing players' streaks and history.

---

## Phase 2 — Song Databases (New Groups)

### What to Build

Create `songs.json` files for each group in `server/src/data/groups/{groupId}/`.

### Song Data Format (same as current TWICE format)
```json
[
  {
    "id": 1,
    "title": "Attention",
    "album": "New Jeans",
    "releaseYear": 2022,
    "spotifyId": "...",
    "deezerId": 0
  }
]
```

### Groups & Catalog Sizes (estimates)

| Group | ID | Est. Songs | Notes |
|---|---|---|---|
| TWICE | `twice` | 102 (existing) | Already done |
| NewJeans | `newjeans` | ~35 | Small but growing discography |
| LE SSERAFIM | `lesserafim` | ~35 | 2022–present |
| Red Velvet | `redvelvet` | ~80 | Large 3rd-gen catalog |
| aespa | `aespa` | ~50 | 2020–present |
| KISS OF LIFE | `kissoflife` | ~30 | 2023–present, retro R&B |
| IVE | `ive` | ~30 | 2021–present |
| BLACKPINK | `blackpink` | ~25 | Smaller but iconic catalog |
| MAMAMOO | `mamamoo` | ~100 | Massive vocal catalog |
| Girls' Generation | `snsd` | ~100 | Legacy, iconic |

### How to Find IDs

**Spotify IDs:** From Spotify URL — `open.spotify.com/track/{spotifyId}`  
**Deezer IDs:** From Deezer URL — `www.deezer.com/track/{deezerId}`

For each song: search on Deezer, check the URL, grab the numeric ID. The Deezer API returns a 30s preview for every track automatically — no scraping needed, unlike Spotify.

### Confirmed Group Lineup

**Launch groups (Phase 2):** TWICE (existing) + NewJeans + LE SSERAFIM + aespa + Red Velvet + KISS OF LIFE + IVE + BLACKPINK

Mark `active: false` in `groups.json` for groups whose song data isn't ready yet — they won't appear on the homepage until fully populated. Roll them out one at a time after Phase 1 ships.

---

## Phase 3 — Practice Mode

### What It Is
After completing the daily game, a player can click "Practice" to play unlimited rounds with random songs from that group's catalog. Practice stats are tracked separately (or not at all) — they don't affect the daily streak/distribution.

### Backend Changes
New endpoint: `GET /api/:group/game/practice`

Returns a randomly selected song + preview URL. The server picks a fresh random song on each request using `Math.random()` (or a client-provided seed). Since this is practice, there's no game-state tracking server-side.

```js
router.get('/practice', async (req, res) => {
  const songs = getSongsForGroup(req.params.group)
  const song = songs[Math.floor(Math.random() * songs.length)]
  const previewUrl = await getPreviewUrl(song)
  res.json({ previewUrl, totalSongs: songs.length })
})
```

Guess validation for practice: same `POST /api/:group/game/guess` endpoint but with `gameDate: 'practice'` and the server handles that as a special case (no date mismatch check, answer always revealed on request).

Alternative: send the answer immediately hashed so the client can check locally — but this leaks the answer. Stick with server validation.

### Frontend Changes

- After `ResultModal` closes (or within it), show a "Practice Mode" button
- `usePracticeGame` hook — similar to `useGame` but calls `/practice` and doesn't write to the daily game storage
- Practice guesses stored in component state only (no localStorage)
- Separate "practice" label in the header so it's clear this isn't the daily
- Practice results don't call `recordResult` in `useStats`

---

## Phase 4 — Archive Mode

### What It Is
Play any past daily game by number. Since the daily song algorithm is deterministic (HMAC-SHA256 of date), we can compute any historical game without storing it.

### Backend Changes
New endpoint: `GET /api/:group/game/archive/:date`

Where `:date` is `YYYY-MM-DD`. The server runs `getTodaysSong(groupId, date)` — a small modification to `dailySong.js` to accept an overriding date instead of always using today.

```js
export function getSongForDate(groupId, dateString) {
  const songs = getSongsForGroup(groupId)
  const index = getDailySongIndex(songs.length, dateString, groupId)
  const gameNumber = getGameNumber(dateString, groupId)
  return { song: songs[index], dateString, gameNumber }
}
```

Guess validation: `POST /api/:group/game/guess` already accepts `gameDate` in the body, so it can validate archive games by passing the archive date. The only change needed is relaxing the "must be today" check when an archive date is provided.

### Frontend Changes

- "Archive" button in Header opens an archive modal
- Modal shows a calendar or paginated list of past games (game #1, #2, ...)
- Earliest available game is determined by each group's `launchDate` from `groups.json`
- Selecting a date loads that game in the main view
- Archive games use a separate localStorage namespace: `{group}-archive-{date}`
- Archive game state is tracked separately — does not affect daily stats
- Archive completion shows result but no "share" (since it's historical)

---

## Phase 5 — Hint System

### What It Is
Players can request optional hints at any point. Each hint used is recorded and shown in the share output as a distinct emoji. Using hints doesn't cost a "guess" but is tracked as a handicap.

### Hints Available (in order)
1. **Era hint** — "This song is from the *[Album Name]* era"
2. **Year hint** — "Released in [Year]"
3. **First letter** — "The song title starts with '[Letter]'"

### Backend Changes
None needed. Hints are derived from song metadata that's already returned with the answer at game end. Instead, send hints as part of the `GET /api/:group/game/today` response:

```json
{
  "gameDate": "2026-05-17",
  "gameNumber": 87,
  "previewUrl": "...",
  "totalSongs": 102,
  "hints": {
    "era": "Formula of Love: O+T=<3",
    "year": 2021,
    "firstLetter": "S"
  }
}
```

The hint order gives information incrementally. Sending all three in the initial payload is fine because `era` and `year` alone are often not enough to identify the exact song.

### Frontend Changes

- "Hint" button appears below the audio player (subtle, not prominent)
- Click reveals hints one at a time (era → year → first letter)
- Hints used stored in game state
- `ShareButton` includes a `💡` emoji in the share grid for each hint used
- `ResultModal` shows hints used in a summary line ("You used 2 hints")

### Scoring Impact
Hints used are shown in the share output for social context, but they don't reduce your "win" or affect guess distribution tracking. The goal is player education, not punishment.

---

## Phase 6 — Difficulty Modes

### What It Is
Three difficulty modes that change the progression of audio clip lengths.

| Mode | Clip Lengths | Intended Audience |
|---|---|---|
| Easy | 3s, 5s, 8s, 10s, 12s, 15s | Casual fans, newcomers |
| Normal | 1s, 2s, 3s, 4s, 5s, 6s | Current behavior (default) |
| Hard | 0.5s, 1s, 1.5s, 2s, 3s, 4s | Superfans |

### Backend Changes
None. Clip durations are enforced client-side in `useAudioPlayer`.

### Frontend Changes

- Difficulty picker in `HowToPlayModal` (or a settings gear icon in the header)
- Selected difficulty stored in localStorage: `{group}-difficulty` (persists across sessions)
- `SNIPPET_DURATIONS` in constants becomes a lookup:
  ```js
  export const DIFFICULTIES = {
    easy:   [3, 5, 8, 10, 12, 15],
    normal: [1, 2, 3, 4, 5, 6],
    hard:   [0.5, 1, 1.5, 2, 3, 4],
  }
  ```
- `useAudioPlayer` reads the active difficulty to know the max clip length per guess
- Share output includes difficulty badge: `[HARD]` or `[EASY]` prefix on the result line

---

## Phase 7 — Cross-Group Challenge

### What It Is
A daily bonus game where the answer could be any song from any active group. The player must guess the correct **song title** (group is revealed in the result). This is a separate game mode, not tied to any one group.

### Backend Changes
New route group: `/api/crossgroup/`

```
GET  /api/crossgroup/game/today
POST /api/crossgroup/game/guess
GET  /api/crossgroup/songs   (returns merged title list from all active groups)
```

`crossgroup` daily song service: merges all active groups' song lists into one pool, then applies the same HMAC-based selection. The result metadata includes `groupId` so the response can show which group after a correct guess or game end.

### Frontend Changes

- Homepage has a special "Cross-Group Challenge" card (different style, e.g., rainbow gradient)
- Route: `/crossgroup`
- Game UI is the same as a regular group game
- Autocomplete dropdown includes songs from all groups (labeled by group)
- On game end: reveal which group the song belongs to
- Share output: `K-podle Cross #42 3/6` (uses platform name)

---

## Phase 8 — User Accounts

### What It Is
Cloud-synced stats so streaks survive device switches. Login via email magic link (no passwords).

### Why Magic Link (Not Password)
Simpler to implement, no bcrypt, no password reset flow. User enters email → gets a one-time link → clicks it → logged in. Session stored in a JWT (httpOnly cookie or localStorage).

### Backend Changes Required

1. **Database** — Add SQLite (via `better-sqlite3`) or use a hosted Postgres (via `pg`). Schema:
   ```sql
   users (id, email, created_at)
   stats (id, user_id, group_id, games_played, games_won, current_streak, max_streak, last_played_date)
   guess_distribution (id, stats_id, guess_number, count)
   magic_links (id, user_id, token, expires_at, used)
   ```

2. **Auth routes:**
   ```
   POST /api/auth/request-link   — send magic link email
   GET  /api/auth/verify/:token  — validate token, return JWT
   POST /api/auth/logout         — clear session
   GET  /api/auth/me             — return current user
   ```

3. **Stats routes (authenticated):**
   ```
   GET  /api/:group/stats        — return user's cloud stats
   POST /api/:group/stats        — upsert after each game
   ```

4. **Email** — Use `nodemailer` + any SMTP provider (Gmail, SendGrid, Resend). One transactional email per login.

### Frontend Changes

- Login modal with email input
- After game end, prompt "Sign in to save your streak across devices" if not logged in
- Logged-in state stored in context (`AuthContext`)
- `useStats` checks if user is logged in: if yes, sync with server; if no, use localStorage only
- Stats merging: on first login, merge localStorage stats into cloud (take the higher streak/more played)

### Complexity Note
Phase 8 is a significant scope increase. Recommend doing Phases 1–7 first to prove the platform has an audience before adding auth infrastructure.

---

## Technical Debt & Hardening

These should be addressed alongside or before new features:

### 1. Audio Provider — Replace Spotify Scraping with Proper APIs

**Confirmed decision:** Spotify's `preview_url` was deprecated November 27, 2024 — it now returns `null` for most tracks via the direct track endpoint. The embed HTML scraping currently used is fragile and non-official.

**New approach — two separate APIs with distinct roles:**

#### Spotify Web API (OAuth2 Client Credentials) — Metadata Only
- **Purpose:** Album art, official track names, release metadata, link-outs to Spotify
- **Auth:** Client Credentials flow (`POST https://accounts.spotify.com/api/token` with `grant_type=client_credentials`)
- **Token management:** Server fetches a token on startup, auto-refreshes when it expires (tokens last 1 hour). Store in memory.
- **Endpoint used:** `GET https://api.spotify.com/v1/tracks/{id}` — returns `name`, `album.images`, `album.name`, `release_date`, `external_urls.spotify`
- **Resume value:** Genuine OAuth2 integration with token refresh lifecycle
- **New env vars:** `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`

#### Deezer API — Audio Previews
- **Purpose:** 30-second MP3 preview URLs for actual gameplay audio
- **Auth:** None required (free public API)
- **Endpoint:** `GET https://api.deezer.com/track/{deezerId}` → `response.preview` (direct MP3 URL)
- **Fallback:** `GET https://api.deezer.com/search?q={artistName}+{title}` → first result's `.preview`
- **Why Deezer:** Reliable, free, no auth, consistently returns previews

#### New `audioProvider.js` Flow
```
1. Deezer by ID (song.deezerId)       → returns preview MP3 URL
2. Deezer by search (artist + title)  → returns preview MP3 URL
3. null (log warning, no audio)
```

#### New `spotifyMetadata.js` Service (replaces `spotifyPreview.js`)
```
- getSpotifyToken()       — client credentials OAuth2, cached in memory
- getTrackMetadata(id)    — returns { albumArt, spotifyUrl, albumName }
- Called separately from audio — enriches ResultModal display only
```

#### `songs.json` — Remove `spotifyId` Requirement for Previews
Spotify IDs are still useful for linking to Spotify in the result modal, but they're no longer needed for audio. Songs can have a null `spotifyId` and still play fine via Deezer.

### 2. Audio Search — Add Artist Name to Groups Config
**Problem:** `searchDeezerPreview` searches by title only, which can return wrong artists' songs.  
**Fix:** Add `deezerArtistName` to `groups.json` entries (e.g., `"deezerArtistName": "TWICE"`). Use in search query: `q={deezerArtistName}+{title}`.

### 3. In-Memory Cache — Keep As-Is for Now
Current TTL cache is sufficient for a single-instance server. Only needs Redis if horizontally scaling.

### 4. LocalStorage Key Migration (one-time)
As described in Phase 1 — on first load of the TWICE group page, if `twicedle-stats` exists and `twice-stats` does not, copy and rename all `twicedle-*` keys to `twice-*`. Preserves existing players' streaks.

---

## Implementation Order

Recommended implementation sequence, one phase at a time:

```
Phase 1  → Multi-Group Architecture        (enables all other phases)
Phase 2  → Song Databases                  (data work, no code changes beyond Phase 1)
Phase 3  → Practice Mode                   (quick win, high engagement)
Phase 6  → Difficulty Modes               (one-liner config change, easy to ship)
Phase 4  → Archive Mode                   (backend tweak + simple frontend)
Phase 5  → Hint System                    (medium effort, adds depth)
Phase 7  → Cross-Group Challenge          (fun feature once 3+ groups exist)
Phase 8  → User Accounts                  (last — validate platform first)
```

Phase 2 and Phase 3 can be done in parallel after Phase 1 ships. Difficulty modes (Phase 6) can be tucked into Phase 3's PR since they're both small.

---

## Decisions Log

| Decision | Outcome | Date |
|---|---|---|
| Platform name | **K-popdle** | 2026-05-17 |
| Root URL (`/`) | **K-popdle homepage** (group selector) — TWICE is no longer the default entry point | 2026-05-17 |
| Group URL structure | `/:group` e.g. `/twice`, `/newjeans`, `/lesserafim` | 2026-05-17 |
| Initial group lineup | TWICE + NewJeans + LE SSERAFIM + aespa + Red Velvet + KISS OF LIFE + IVE + BLACKPINK | 2026-05-17 |
| Audio provider | **Deezer API** for previews (Spotify `preview_url` deprecated Nov 2024) | 2026-05-17 |
| Spotify API role | **Metadata only** via proper OAuth2 client credentials — resume-worthy integration | 2026-05-17 |
| KISS OF LIFE abbreviation | "KIOF" confirmed = KISS OF LIFE, group ID `kissoflife` | 2026-05-17 |

## Remaining Open Questions

1. **Song data sourcing** — Song databases for new groups require manually finding Deezer IDs per track. Plan to do this during Phase 2.
