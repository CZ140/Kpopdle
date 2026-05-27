# K-POPDLE Battle — Real-Time Multiplayer Spec

> **Status:** Draft for review (2026-05-27). Requirements are intended to be *locked* before any implementation.
> **Scope of this doc:** Phase A (MVP) is specified in full. Phases B/C are sketched as explicit out-of-scope.
> Decisions marked **[default]** are my recommended call — redline them in review and I'll re-lock.

---

## 1. Goal

A live, head-to-head music-guessing mode: two players, one match, real-time. First viral entry point is a **"challenge a friend" invite link** — no matchmaking lobby, and the link-sharing *is* the growth loop. This is the first stateful feature in an otherwise stateless codebase (see `docs/ARCHITECTURE.md`), and building it correctly also closes the long-standing answer-oracle gap (`AUDIT_ACTION_PLAN.md` 3.1) for this mode.

**One-sentence test of success:** two people on different devices can, from a shared link, play 5 synchronized rounds of guess-the-song against each other and see a winner — with neither able to read the answer from their browser.

---

## 2. Player experience (MVP flow)

1. Player A opens `/battle`, optionally enters a display name (no login required), optionally picks a **scope** (All groups *[default]* or one group), and clicks **Create match**.
2. A gets a room with a shareable link (`/battle/:matchId`) and a "waiting for opponent" screen.
3. Player B opens the link, enters a display name, lands in the same room. Both see each other; either taps **Ready**.
4. When both ready → server runs a **3-2-1 countdown** synced to a server timestamp.
5. **Round (×5):** the same clip plays for both, starting together and lengthening over a fixed window. Each player types guesses (reusing the existing autocomplete). A correct guess locks in your time; points scale with speed. Round ends when both are correct or the window expires.
6. **Between rounds:** a reveal card shows the answer + both players' results + running score.
7. After 5 rounds (sudden-death round if tied *[default]*): a winner screen + **Rematch** and **Share result**.

---

## 3. Locked gameplay decisions

| # | Decision | Value |
|---|---|---|
| GD-1 | Players per match | Exactly **2** (MVP) |
| GD-2 | Rounds per match | **5** (+1 sudden-death on tie) **[default]** |
| GD-3 | Round mechanic | Shared continuous clip, both race; **speed-scored**, both can earn points **[default]** |
| GD-4 | Per-round window | **30s** (Deezer preview length cap) **[default]** |
| GD-5 | Scoring | Correct in 0–3s=**5**, 3–8s=**4**, 8–15s=**3**, 15–25s=**2**, 25–30s=**1**, miss=**0** **[default, tunable]** |
| GD-6 | Wrong guesses | Unlimited within the window; only the first correct guess counts; cost is lost time **[default]** |
| GD-7 | Song scope | Host picks **All groups** *[default]* or a single group; cross-group rounds label the group on reveal |
| GD-8 | Song selection | Random per match from `deezerId`-playable pool; **no repeats within a match**; not date-deterministic |
| GD-9 | Accounts | **Not required** for MVP — display-name only, lowers friction for the share loop. (Persistence/leaderboards need accounts → Phase C) |

---

## 4. Functional requirements (Phase A / MVP)

Each is falsifiable. **AC** = acceptance criterion.

### Rooms & matchmaking
- **FR-1 — Create match.** `POST`/socket creates a room with a unique unguessable `matchId` (≥ 128-bit random, URL-safe). **AC:** two creates never collide; IDs aren't enumerable.
- **FR-2 — Join via link.** A second player opening `/battle/:matchId` joins the room as opponent. **AC:** a 2-player room rejects a 3rd joiner with a clear "match full" message.
- **FR-3 — Ready gate.** A match starts only when both players signal ready. **AC:** the round never starts with one player.
- **FR-4 — Room lifetime.** An unjoined or idle room is garbage-collected after **10 min** *[default]*. **AC:** stale rooms don't accumulate in memory.

### Round gameplay
- **FR-5 — Synchronized start.** Server emits round start with `startAt = serverNow + 3000ms`; both clients begin playback and the visible countdown against that timestamp. **AC:** measured client start times differ by < 500 ms on normal connections.
- **FR-6 — Identical clip.** Both players receive the same song's clip for a given round. **AC:** the round answer is identical for both; verified server-side from one source.
- **FR-7 — Guess validation.** Guesses are validated **server-side** (reusing the existing title-match logic). **AC:** a correct guess returns correct; a wrong one returns wrong **without** revealing the answer.
- **FR-8 — Speed scoring.** On a correct guess, the server records the elapsed time from `startAt` and awards points per GD-5. **AC:** identical-time correct guesses score identically; later guesses never outscore earlier ones.
- **FR-9 — Round end.** A round ends when both players are correct **or** the 30s window expires. The reveal (answer + per-player result + scores) is broadcast to both **simultaneously**. **AC:** neither client can display the answer before round end.

### Match resolution
- **FR-10 — Winner.** After the final round, the higher total wins; a tie triggers one sudden-death round (GD-2). **AC:** every completed match yields exactly one winner (or a recorded mutual-forfeit).
- **FR-11 — Rematch.** Both players can start a new match in the same room with fresh songs. **AC:** rematch shares no songs with the just-played match where pool size allows.
- **FR-12 — Share.** The winner screen produces a spoiler-free share string (Wordle-style) plus the room link. **AC:** the share text contains no song titles.

### Connection handling
- **FR-13 — Reconnect grace.** A dropped player has **15s** *[default]* to reconnect and resume the in-progress match. **AC:** a brief network blip mid-round doesn't end the match.
- **FR-14 — Forfeit.** If a player leaves and doesn't return within grace, the opponent wins by forfeit and is told so. **AC:** the remaining player never hangs on a dead opponent.
- **FR-15 — Restart safety.** A server restart with in-flight matches ends them gracefully client-side ("match ended — server updated"), not a frozen screen. **AC:** killing the server mid-match shows a clean terminal state, not a hang.

### Anti-cheat (critical — see §6)
- **FR-16 — Answer withheld.** The answer is never sent to either client before round end. **AC:** inspecting all network traffic before the reveal yields no song title/id.
- **FR-17 — Opaque audio.** Clips are served through an origin proxy under a per-round opaque token; no Deezer-identifying URL reaches the client. **AC:** the audio request URL and headers contain no Deezer track id or title.
- **FR-18 — Server clock.** Scoring uses server-received guess time, not any client-supplied timestamp. **AC:** a client sending a forged early timestamp gains no advantage.

---

## 5. Event protocol (Socket.IO, same origin)

Authenticated via the shared Express session middleware; anonymous players carry a per-tab display name + ephemeral id.

**Client → Server**
| Event | Payload | Notes |
|---|---|---|
| `battle:join` | `{ matchId, displayName }` | join/rejoin a room |
| `battle:ready` | `{}` | signal ready |
| `battle:guess` | `{ roundIndex, guess }` | validated + timed server-side |
| `battle:rematch` | `{}` | both must send to restart |
| `battle:leave` | `{}` | explicit quit |

**Server → Client**
| Event | Payload |
|---|---|
| `battle:state` | full room snapshot on join/reconnect (players, scope, scores, phase) |
| `battle:opponent` | `{ displayName, connected }` |
| `battle:countdown` | `{ startAt }` |
| `battle:round_start` | `{ roundIndex, clipToken, startAt }` |
| `battle:guess_result` | `{ correct, points? }` (to the guesser only) |
| `battle:opponent_progress` | `{ status: 'guessing' \| 'correct' }` (no answer) |
| `battle:round_reveal` | `{ answer, results, scores }` |
| `battle:match_over` | `{ winner, scores, shareText }` |
| `battle:error` | `{ code, message }` |

---

## 6. Anti-cheat design (the load-bearing part)

Three server-authoritative pillars + an audio proxy:

1. **Answer withheld (FR-16):** the room's per-round answer lives only on the server until `round_reveal`.
2. **Server clock (FR-18):** `round_start.startAt` and guess arrival times are the server's; client timestamps are ignored for scoring.
3. **Opaque audio proxy (FR-17):** new route `GET /api/battle/:matchId/clip/:roundToken.mp3`. The server resolves the Deezer URL via the existing `audioProvider.getPreviewUrl`, then **streams the bytes** to the client. The client only ever sees the opaque origin URL; the Deezer URL (which would reveal the title via lookup) never leaves the server. `roundToken` is single-use per round and only valid for the requesting room member.
   - *Cost:* added origin egress for audio. Acceptable; clips are ~30s/≈0.5 MB and cacheable per-match server-side.

> Building all three is exactly what `AUDIT_ACTION_PLAN.md` item 3.1 asked for, scoped to this mode.

---

## 7. Architecture & components

**Server**
- Wrap `app.listen()` as `const server = http.createServer(app); server.listen()` and attach Socket.IO to `server` (same port; CSP `connect-src 'self'` already permits same-origin `wss://`).
- **`MatchManager`** — in-memory `Map<matchId, Match>`; `Match` is a state machine (§8) with per-round server timers. Designed behind a small interface so a Redis-backed store can replace it when scaling past one instance.
- Reuse `data/songIndex.js` pools, `services/dailySong.js` title-match logic, `services/audioProvider.js` for clip resolution.
- New **audio proxy** route (§6.3).
- Socket auth via the shared `session` + `passport` middleware.

**Client**
- New **`BattlePage`** route (`/battle`, `/battle/:matchId`), lazy-loaded (keeps the daily-game bundle lean, matching the `/stats` + `/admin` pattern).
- Reuse `GuessInput` (autocomplete), `AudioPlayer` (pointed at the proxy URL), and share utilities.
- A small socket client module; synced countdown driven by `startAt` vs server-time offset.

---

## 8. Match state machine

```
WAITING ──both joined──► READY_CHECK ──both ready──► COUNTDOWN
   ▲                                                    │
   │                                                    ▼
FINISHED ◄──last round / forfeit── ROUND_REVEAL ◄── ROUND_ACTIVE
                                        │                ▲
                                        └── next round ──┘
```
- Each non-terminal state has a **timeout** (ready-check, round window, reveal dwell, reconnect grace).
- Transitions are server-driven and broadcast; clients are pure renderers of server state.

---

## 9. Data model

- **MVP runs matches ephemerally** (in memory). No DB writes required to ship Phase A.
- **When persistence is added (Phase C):** `battle_matches(id, mode, group_scope, created_at, winner_id)` and `battle_results(match_id, player_id, score, rounds_won)` in the existing `better-sqlite3` DB — enables history, leaderboards, and ELO-style rating, and feeds the existing admin pipeline.

---

## 10. Non-functional requirements

- **NFR-1 Latency tolerance:** correctness/scoring tolerate ≤ ~250 ms network jitter; no rhythm-grade precision required.
- **NFR-2 Concurrency cap:** a configurable max of concurrent active matches guards memory; excess create-requests get a friendly "try again shortly."
- **NFR-3 Single-instance assumption:** documented; horizontal scaling requires sticky sessions or a Socket.IO Redis adapter + shared room store (out of scope, interface-ready).
- **NFR-4 Observability:** match lifecycle + forfeits logged via `pino`; errors via `captureError` (consistent with the rest of the server).
- **NFR-5 Abuse:** socket events rate-limited; display names length-capped and sanitized.

---

## 11. Out of scope (future phases)

- **Phase B:** random matchmaking queue; "play someone now"; richer reconnection.
- **Phase C:** persisted results → leaderboards + ELO rating; spectate; party mode (>2 players, Kahoot-style); battle across other game types (album-cover, guess-the-group).

---

## 12. Open decisions for review

These are the **[default]** calls above most worth a second look before locking:
1. **GD-5 scoring curve** — tiered buckets vs continuous formula. Tiered is more legible/shareable; happy to switch.
2. **GD-9 no-login MVP** — frictionless + viral, but means no persistent record until Phase C. Acceptable?
3. **GD-3 round mechanic** — speed-scored (both can earn) vs sudden-death (first-correct-takes-the-point). Speed-scored is more forgiving; sudden-death is more tense.
4. **GD-7 default scope** — All-groups vs forcing a group choice on create.

---

## 13. Definition of done (MVP)

Phase A ships when: two devices, from a shared link, complete a full 5-round match with synchronized audio, server-authoritative speed scoring, a correct winner, working rematch + share — and a security check confirms the answer and Deezer identity are unobtainable from the client before each reveal (FR-16/17/18). All new server logic unit-tested; the happy-path match covered by an integration test; lint/build green.
