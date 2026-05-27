# Architecture Decision Records

Short ADRs for the two least-obvious decisions in K-POPDLE — the ones a future
change could easily break without realising *why* they're shaped the way they
are. Everything else in the codebase is conventional enough to read directly.

---

## ADR 1 — Daily songs are derived from an HMAC, not stored

**Status:** Accepted · **Where:** `server/src/services/dailySong.js`

### Context

Every game (each group, plus the cross-group K-POPDLE) needs exactly one song
per calendar day, the same for all players, deterministically — including past
days, so the archive works. The obvious design is a table mapping
`(group, date) → songId`, pre-generated or filled in daily.

### Decision

There is **no schedule table**. The song for a given day is computed on demand:

```
index = HMAC_SHA256(`${SECRET}-${groupId}`, dateString)  // first 8 hex chars → int
        % playableSongs.length
```

The date string is the KST calendar date (`getKSTDateString`). The pool is the
group's songs filtered to those with a valid Deezer ID (`deezerId` truthy and
≠ 0), so the chosen song always has playable audio. K-POPDLE uses the same
formula over a merged, group-sorted pool with a `-kpopdle` secret suffix.

### Why this matters (don't break it)

- **The archive is free.** Any past date reproduces its song with zero storage —
  that's the whole point. A "cleanup" that introduces a stored schedule would
  make today's logic and the archive diverge.
- **The pool order and contents are part of the key space.** Reordering a
  group's `songs.json`, or changing the `deezerId !== 0` filter, **re-rolls every
  past day's answer** because the modulo lands on a different element. The
  archive is only stable as long as the playable-song list is append-mostly.
  Treat song-list edits to *existing* entries as archive-affecting.
- **The KST date is canonical.** Client and server must compute the same
  `dateString` or they disagree on "today" near KST midnight. Both use a
  TZ-independent formula (`Date.now() + 9h`, slice to `YYYY-MM-DD`); keep them in
  lockstep (`server/src/utils/dateUtils.js` ↔ `client/src/lib/dateUtils.js`).
- **`DAILY_SONG_SECRET` is load-bearing, not just a secret.** Changing it
  re-rolls *all* days for *all* groups. It defaults to an insecure value with a
  startup warning — production must set it, and then never change it.

### Consequences

- No DB dependency for core gameplay; the answer key can't drift out of sync
  with itself.
- The trade-off is the **answer oracle** (see the audit's Tier 3.1): because the
  answer is a pure function the client can't see the secret, but the `/guess`
  endpoint reveals the answer when the game ends. This is fine for casual play;
  a competitive leaderboard would require server-authoritative game tokens.

---

## ADR 2 — Deezer preview URLs are cached until just before they expire

**Status:** Accepted · **Where:** `server/src/services/audioProvider.js`, `deezerPreview.js`

### Context

Audio comes from Deezer's public API as a preview URL. Deezer is the single
external dependency and signs each preview URL with a **short, baked-in expiry**
(~29 minutes) encoded as an `exp=<unix-seconds>` query param. Serve a cached URL
past that expiry and playback silently fails for the user.

### Decision

Cache the resolved preview URL keyed by `deezerId` (globally unique, so two
groups sharing a local `song.id` don't collide), but set the cache TTL from the
URL's *own* expiry rather than a fixed duration:

```
ttl = (exp * 1000) - now - 5min      // expire 5 min early as a safety margin
ttl = max(ttl, 1min)                 // never cache for less than a minute
// if no exp param is found: fall back to 20 min
```

### Why this matters (don't break it)

- **A fixed TTL is the bug this avoids.** A naive `cache.set(key, url, 60min)`
  would serve dead URLs for half an hour. The TTL must track the URL's embedded
  expiry, not wall-clock convenience.
- **The 5-minute margin is deliberate.** It absorbs clock skew and in-flight
  requests so a URL handed to a client is still valid when the audio element
  actually fetches it. Don't shave it to zero.
- **HTTP cache headers are tuned to this too.** `/game/today` sends a short
  CDN-only `s-maxage` (~60s) precisely because the body embeds a
  soon-to-expire URL — a long edge cache would serve stale audio. The two cache
  layers (in-process map + CDN header) must stay consistent with the ~29-min
  Deezer window.

### Consequences

- Most requests hit the warm cache; we re-resolve from Deezer only as URLs near
  expiry, minimising calls to our one external dependency.
- If Deezer changes its expiry scheme or drops the `exp` param, the 20-minute
  fallback keeps things working but loses the precision — worth a log/alert
  (Deezer failures already emit structured warns via `observability.js`).
