# K-POPDLE Battle — Phase A Build Plan

> Implementation plan for the MVP specified in [`BATTLE_SPEC.md`](BATTLE_SPEC.md).
> Built as **6 vertical-slice milestones**, ordered to de-risk the hardest parts first. Each milestone is independently demoable and maps to spec requirements (FR-*).

## Locked decisions (from spec review, 2026-05-27)
- **Round mechanic:** speed-scored — both players can earn points each round (GD-3).
- **Scoring curve:** tiered 5/4/3/2/1 by time bucket (GD-5).
- **Accounts:** anonymous + display name; no login for MVP (GD-9). Identity = display name + ephemeral socket id.
- **Default scope:** All-groups, with a host override to a single group (GD-7).

## Tech choice
- **Socket.IO** (server) + **socket.io-client** (client) — chosen over raw `ws` for built-in rooms, reconnection, heartbeats, and transport fallback. Same-origin, so CSP `connect-src 'self'` and `media-src 'self'` already cover sockets **and** the audio proxy — no CSP changes.

## Core design principle (makes the hard parts testable)
Separate the **match state machine from the transport**. `Match` takes an injected **clock** and **emit** function, so round timing and scoring (FR-8) are unit-testable with a fake clock — no sockets, no real time. Sockets are a thin adapter that calls into `MatchManager`/`Match` and forwards emitted events.

---

## Milestone 0 — Socket foundation & room lifecycle ✅ DONE (2026-05-27)
**De-risks:** server wiring, shared auth, the room model.
**Built:** `realtime/{Match,MatchManager,socket}.js`, `middleware/session.js` (shared), http-server wrap in `index.js`, `/socket.io` vite proxy; client `lib/battleSocket.js`, `pages/BattlePage.jsx`, `components/battle/Lobby.jsx`, `/battle` + `/battle/:matchId` lazy routes.
**Verified:** 9 unit tests (Match/MatchManager) + 3 socket integration tests (real 2-client round-trip) green; server boots with io attached; client builds (BattlePage = separate 15 kB-gzip lazy chunk, main bundle unchanged); lint 0 errors. FR-1, FR-2, FR-3, FR-4 satisfied.
**Note:** anonymous identity path (playerToken) is fully tested; the logged-in path (`io.engine.use(session)` → `socket.request.session.passport.user`) is wired but not yet exercised by a test — irrelevant until persistence/accounts (Phase C).

**Server**
- `server/src/middleware/session.js` — **extract** the existing `session({...})` config from `index.js` into a shared module so both Express and Socket.IO use the *same* session (clean refactor, no behavior change).
- `server/src/index.js` — wrap `app.listen()` as `const server = http.createServer(app); server.listen()`; attach `io` and apply the shared session as Socket.IO middleware.
- `server/src/realtime/socket.js` — `io` setup, connection auth (session or anonymous display name), event routing.
- `server/src/realtime/MatchManager.js` — `Map<matchId, Match>`; `createMatch`, `joinMatch`, `markReady`, idle-room GC (10 min).
- `server/src/realtime/Match.js` — skeleton state machine (`WAITING → READY_CHECK`), injected clock + emit.

**Client**
- `client/src/lib/battleSocket.js` — socket.io-client wrapper + connection lifecycle.
- `client/src/pages/BattlePage.jsx` — lazy route for `/battle` and `/battle/:matchId` (matches the `/stats` lazy-load pattern); wire into the router.
- `client/src/components/battle/Lobby.jsx` — create match, copy invite link, enter display name, join, ready button, opponent presence.

**Done when:** two browsers reach the same room from a shared link, see each other's names, and both can mark Ready. **FRs:** FR-1, FR-2, FR-3, FR-4.

---

## Milestone 1 — Audio proxy (anti-cheat core) ✅ DONE (2026-05-27)
**De-risks:** the cheat-proofing and cross-browser audio — the riskiest backend piece.
**Built:** `realtime/songSelection.js` (poolForScope + selectRounds, 5 distinct songs/opaque clip tokens, no mutation of the memoized merged pool); `realtime/manager.js` (shared MatchManager singleton + `setEmitFactory`, used by both socket layer and HTTP route); `Match.rounds` + `roundForClipToken` (server-only, never in getState); `routes/battle.js` `GET /api/battle/:matchId/clip/:roundToken` (resolve via `getPreviewUrl`, buffer-once-per-round, stream `audio/mpeg` with HTTP Range/206 + `Cache-Control: private, no-store`); `battle:create` now selects rounds.
**Verified:** +11 tests (6 songSelection unit + 5 proxy integration via a fake upstream) → 48 server tests green. Proxy integration proves FR-17: request URL/body leak no song id, title, or Deezer host; 206 range works; 416/404 paths covered. Server boots with `/api/battle` mounted.
**Boundary note:** the *in-browser / iOS Safari* playback check rides with M2 — the client can't fetch a clip until `round_start` delivers a token. The HTTP-level Range contract iOS requires is implemented + tested now.

**Server**
- `server/src/realtime/songSelection.js` — pick N=5 distinct `deezerId`-playable songs for a match from the scope's pool (reuse `data/songIndex.js`); no in-match repeats.
- `server/src/routes/battle.js` — `GET /api/battle/:matchId/clip/:roundToken.mp3`:
  - validates the token belongs to the requesting room/round (single-use per round),
  - resolves the Deezer URL via existing `services/audioProvider.getPreviewUrl`,
  - **buffers the clip bytes once per round** (in-memory, shared to both players — aids sync, limits Deezer hits),
  - streams with `Content-Type: audio/mpeg` and **HTTP Range support (206)** ⚠️ required for iOS Safari `<audio>`.

**Client**
- Point the existing `AudioPlayer` at the opaque proxy URL.

**Done when:** a clip plays in-browser via the opaque origin URL; the network tab/headers expose **no** Deezer track id or title; plays on iOS Safari. **FRs:** FR-6 (partial), FR-17. ⚠️ **Risk:** Range/streaming correctness — test on real iOS early.

---

## Milestone 2 — One synchronized, server-authoritative round ✅ BUILT (2026-05-27, pending browser test)
**De-risks:** synchronized start (the trickiest UX) and authoritative scoring.
**Built:** `realtime/scoring.js` (pure tiered scorer); `utils/guessMatch.js` (shared label-strip matcher; kpopdle.js refactored onto it); `Match` round logic (COUNTDOWN via startAt, ROUND_ACTIVE, ROUND_REVEAL; injected scheduler+timings; server-clock elapsed; both-correct early end + window timeout; round_start/guess_result/round_reveal events, answer withheld until reveal); `socket.js` battle:guess + battle:time(clock sync); client `lib/serverTime.js`, `components/battle/RoundView.jsx` (synced 3-2-1, proxy audio + tap-to-play fallback, reused GuessInput via GroupContext, opponent status, reveal card, scoreboard), BattlePage phase routing.
**Verified (automated):** +14 server tests (scoring, guessMatch, 8 Match round-logic with fake clock/scheduler, updated socket integration proving round_start carries no answer) → 62 server tests; client 35 tests; lint 0 errors; build green (BattlePage chunk 17 kB gzip, main bundle unchanged). FR-5/7/8/9/16/18 covered at logic level.
**PENDING:** in-browser test of the synchronized round across two clients (audio sync, autoplay-after-ready-gesture, scoring feel) — the one thing automated tests can't cover.

**Server**
- `server/src/realtime/scoring.js` — pure tiered-scoring function (GD-5); unit-tested.
- `Match.js` — add `COUNTDOWN → ROUND_ACTIVE → ROUND_REVEAL`:
  - emit `round_start { roundIndex, clipToken, startAt = now + 3000ms }`,
  - validate guesses server-side (reuse the `kpopdle.js`/`game.js` title-match + label-strip logic — **extract it to a shared helper** to avoid a 3rd copy),
  - record server-side elapsed time, award points, withhold answer, emit `opponent_progress` (status only),
  - end round on both-correct or 30s window; broadcast `round_reveal` simultaneously.

**Client**
- `serverTime` offset sync (one round-trip) so the countdown aligns to `startAt`.
- `client/src/components/battle/RoundView.jsx` — synced 3-2-1 countdown, audio playback, reused `GuessInput`, opponent status indicator, reveal card.

**Done when:** both players play one synced round (start within <500 ms), guess, get speed-scored, and see the reveal at the same time; the answer is absent from the client before reveal. **FRs:** FR-5, FR-7, FR-8, FR-9, FR-16, FR-18.

---

## Milestone 3 — Full 5-round match + resolution ✅ BUILT (2026-05-27, pending browser test)
**Built (server):** `Match` auto-advances through 5 scored rounds after a reveal dwell; winner = higher total; tie → sudden-death using pre-selected spare rounds (socket picks 7 = 5 + 2 spares), first decisive overtime round wins, spares exhausted → draw; `battle:match_over {winnerId, draw, scores, rounds[]}` with per-round history; `requestRematch`/`startRematch` (both opt in → fresh songs → restart).
**Built (client):** BattlePage captures match_over + routes to ResultScreen on FINISHED; `ResultScreen.jsx` (winner/draw headline, final score, per-round breakdown, Rematch with waiting state, spoiler-free Share via copyToClipboard, New match); RoundView reveal shows "next round / tallying", sudden-death header label.
**Verified (automated):** +4 Match resolution tests (full match→winner, tie→sudden-death decisive, draw when no spares, rematch reset+fresh songs) → 66 server tests; client 35; lint clean; build green.
**PENDING:** browser test of a full 5-round match end-to-end — pacing/reveal dwell, winner screen, rematch, share, and a forced tie → sudden-death.

**FRs:** FR-10, FR-11, FR-12.

---

## Milestone 4 — Connection robustness ✅ BUILT (2026-05-27, pending browser test)
**Built (server):** 15s reconnect grace — `setConnected(false)` during a live round schedules a forfeit timer (injected scheduler); reconnect cancels it; expiry or explicit `battle:leave` → `_endByForfeit` awards the opponent (`match_over { forfeit:true, forfeitedBy }`). Lobby disconnects don't forfeit. `getResumeEvents()` replays the current phase (round_start / reveal / match_over) to a (re)joining socket — `enterRoom` emits them, so a mid-round reconnect or refresh resumes. Graceful SIGTERM/SIGINT in index.js broadcasts a `server_restart` message then closes.
**Built (client):** generalized terminal error screen (covers not_found, server_restart, full, no_songs) with a "start a new battle" CTA; ResultScreen shows "Opponent left — you win" on `forfeit`; reconnect resume flows through existing round/reveal/match_over handlers.
**Verified (automated):** +5 Match tests (forfeit on grace expiry, cancel on reconnect, immediate forfeit on leave, no forfeit in lobby, resume events) → 71 server tests; client 35; lint clean; build green.
**PENDING:** browser test — close/kill one tab mid-match → opponent sees forfeit win; refresh a tab mid-round → resumes; (restart safety also covered by reconnect→not_found).

**FRs:** FR-13, FR-14, FR-15.

---

## Milestone 5 — Hardening, tests & polish ✅ DONE (2026-05-27)
- **Abuse/limits:** per-socket sliding-window rate limiter on create/join/guess/ready/rematch/time (generous; drops excess) (NFR-5); display names strip control chars + cap at 24; `MatchManager` caps concurrent matches at 1000 → friendly `busy` error (NFR-2).
- **Observability:** `match_over` (winner/forfeit/draw) logged via the emitFactory; match created already logged; errors via `captureError` (NFR-4).
- **Tests:** scoring, song selection, `Match` state machine/timing (fake clock + manual scheduler), guess matcher, audio-proxy opacity, forfeit/reconnect/resume, capacity cap, **and a real socket guess→reveal round-trip** → 75 server tests + 35 client; lint clean; build green.
- **CI:** new tests run in the existing job (vitest auto-discovers).

**Done = spec §13.** **FRs:** NFR-1…5 + security verified (FR-16/17/18 covered by unit + proxy integration tests).

---

## ✅ Phase A complete (2026-05-27)
All six milestones built, tested, and (M0–M4) browser-verified. Battle is feature-complete for MVP: create → invite → lobby → 5 synced server-authoritative rounds → winner/draw (with sudden-death) → rematch + share, with reconnect/forfeit robustness and abuse guards. Commits: 72a4486 (M0–M2), f0656bd (M3), fc32197 (M4), + M5. **Remaining before ship:** README update (deferred until merge) and merge to `main`. Deferred by design: Phase B (matchmaking queue), Phase C (accounts/leaderboards/ELO, spectate, party mode).

---

## ✅ Design restyle — Battle.html port (2026-05-27)
Ported the Claude Design `game-plans/coverdle-design/k-popdle/project/Battle.html` mockup onto the Phase-A components. Same convention as the homepage and account-page ports — namespaced CSS block in `client/src/index.css` (`.btl-*`), data-driven JSX, shared `.kp-backdrop` orbs. Logic and component structure unchanged (mobile-first single-column `max-w-md` shell preserved).

**Visual language brought in:** you-pink `#FF2D78→#A855F7` / foe-cyan `#06B6D4→#6366F1` dual identity, `.btl-arena` specular hairline glass with dual radial wash, BAT vs TLE gradient wordmark on the create screen, JetBrains-Mono eyebrow chips, round pips, VS pill divider between dual you/foe score numbers, gradient primary button (pink → purple → cyan), gradient countdown digit and progress bar, victory/defeat gradient headlines.

**Files touched:** `client/src/index.css` (+369 lines `.btl-*` block), `pages/BattlePage.jsx` (shell + create/join/error screens), `components/battle/{Lobby,RoundView,ResultScreen}.jsx`, new `lib/initials.js` (word-boundary initials so "Player One"/"Player Two" → PO/PT, not both PL).

**Not built** — the mockup also shows Phase B/C features (matchmaking queue, ranked, ELO, open-rooms list, leaderboards). Those stay deferred per spec §11; the restyle only touches the MVP screens.

**Verified:** lint 0 errors, 35 client tests green, build clean (BattlePage chunk 18.93 kB gzip, CSS 11.49 kB gzip — +1.3 kB total). Visual capture across create / join / lobby (both perspectives) / countdown / active round / reveal / win / loss confirmed against the mockup.

---

## New dependencies
- server: `socket.io`
- client: `socket.io-client`

## Files at a glance
**New (server):** `realtime/socket.js`, `realtime/MatchManager.js`, `realtime/Match.js`, `realtime/scoring.js`, `realtime/songSelection.js`, `routes/battle.js`, `middleware/session.js`, plus a shared title-match helper (extracted from `game.js`/`kpopdle.js`).
**New (client):** `pages/BattlePage.jsx`, `lib/battleSocket.js`, `lib/serverTime.js`, `components/battle/{Lobby,RoundView,Scoreboard,ResultScreen}.jsx`.
**Modified:** `server/src/index.js` (http server + io), router (battle routes), `AudioPlayer` (proxy URL). No CSP change.

## Sequencing & risk
- **Critical path:** M0 → M1 → M2 are the de-risking core; M2 proves the whole concept. M3 completes the loop; M4/M5 make it production-grade.
- **Top risks:** (1) audio Range/streaming on iOS (mitigated by testing in M1); (2) clock-sync drift (mitigated by server-authoritative timing + offset sync, tolerant scoring per NFR-1); (3) statefulness vs deploys (accepted for MVP — graceful end in M4).
- **Deferred to Phase B/C:** matchmaking queue, persistence/leaderboards/ELO, spectate, party mode, battle on other game types (spec §11).

## Definition of done (MVP)
Two devices, from a shared link, complete a full 5-round speed-scored match with synchronized audio, a correct winner, working rematch + share — and a security check confirms the answer/Deezer identity are unobtainable client-side before each reveal. New server logic unit-tested; happy-path match integration-tested; lint + build green.
