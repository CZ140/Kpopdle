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

## Milestone 3 — Full 5-round match + resolution
**Server:** `Match.js` loops 5 rounds with running score; sudden-death round on tie; `match_over { winner, scores, shareText }`; `rematch` (both must opt in; fresh songs).
**Client:** `Scoreboard.jsx` between rounds; `ResultScreen.jsx` with winner, spoiler-free share string (reuse share utils), rematch button.

**Done when:** a full match plays end-to-end to a correct winner, with working rematch and share. **FRs:** FR-10, FR-11, FR-12.

---

## Milestone 4 — Connection robustness
**Server:** 15 s reconnect grace (resume in-progress match via `battle:state` snapshot); forfeit-on-leave awards the opponent; per-state timeouts (ready-check, round window, reveal dwell); graceful match-end broadcast on shutdown.
**Client:** rejoin flow restores live state; clear terminal screens for forfeit / "match ended — server updated" (no hangs).

**Done when:** a mid-round network blip recovers; an opponent leaving ends the match cleanly with a forfeit result; a server restart shows a clean terminal state. **FRs:** FR-13, FR-14, FR-15.

---

## Milestone 5 — Hardening, tests & polish
- **Abuse/limits:** rate-limit socket events; sanitize + length-cap display names; concurrency cap on active matches (NFR-2).
- **Observability:** match lifecycle + forfeits via `pino`; errors via `captureError` (NFR-4).
- **Tests:**
  - *Unit:* scoring curve, song selection (distinct/playable), `Match` state machine + timing with a fake clock, shared title-match helper.
  - *Integration:* full happy-path match driven by an in-process `socket.io-client` (connect → ready → 5 rounds → winner).
  - *Manual security check:* confirm FR-16/17/18 — answer and Deezer identity unobtainable pre-reveal.
- **CI:** new server tests run in the existing job; lint + build green.

**Done = spec §13 Definition of Done.** **FRs:** NFR-1…5 + security verification.

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
