// Single source of truth for the K-POPDLE cross-group game's launch date.
// Per-group launch dates live in groups.json (`launchDate`); K-POPDLE isn't a
// group, so its launch lives here. Mirrored client-side in
// client/src/lib/constants.js (LAUNCH_DATES.kpopdle) and guarded against drift
// by scripts/validate-constants.js. Keep this file dependency-free — the CI
// guard imports it before `npm install` runs.
export const KPOPDLE_LAUNCH = '2026-05-21'
