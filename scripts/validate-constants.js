/**
 * Guards against silent drift between the server's group metadata and the
 * client's hardcoded mirror of it.
 *
 * The client and server are separate builds, so the client can't import
 * server/src/data/groups.json at runtime — it keeps its own copies of launch
 * dates, game names, display names, and taglines in client/src/lib/constants.js.
 * Those copies must match the server, or a group's archive range / SEO titles /
 * cross-group launch silently diverge. This script makes that divergence a hard
 * CI failure instead.
 *
 * Pure Node, no deps — safe to run before `npm install` in CI.
 *
 * Colors are intentionally NOT checked: the game-UI palette legitimately differs
 * from the social-card palette (see GroupPage.jsx GROUP_GAME_COLORS).
 *
 * Usage: node scripts/validate-constants.js  (exits non-zero on any mismatch)
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const groups = JSON.parse(
  readFileSync(join(root, 'server', 'src', 'data', 'groups.json'), 'utf-8')
)
// import() needs a file:// URL on Windows (bare drive paths are rejected).
const { KPOPDLE_LAUNCH } = await import(
  pathToFileURL(join(root, 'server', 'src', 'data', 'launch.js')).href
)
const { LAUNCH_DATES, GAME_NAMES, GROUP_META } = await import(
  pathToFileURL(join(root, 'client', 'src', 'lib', 'constants.js')).href
)

const errors = []
const err = (m) => errors.push(m)

// Every group the server knows about must have matching client metadata.
for (const g of groups) {
  const at = `client constants for "${g.id}"`
  if (LAUNCH_DATES[g.id] !== g.launchDate) {
    err(`${at}: LAUNCH_DATES = ${LAUNCH_DATES[g.id]} but groups.json launchDate = ${g.launchDate}`)
  }
  if (GAME_NAMES[g.id] !== g.gameName) {
    err(`${at}: GAME_NAMES = ${GAME_NAMES[g.id]} but groups.json gameName = ${g.gameName}`)
  }
  if (GROUP_META[g.id]?.displayName !== g.displayName) {
    err(`${at}: GROUP_META.displayName = ${GROUP_META[g.id]?.displayName} but groups.json displayName = ${g.displayName}`)
  }
  if (GROUP_META[g.id]?.tagline !== g.tagline) {
    err(`${at}: GROUP_META.tagline = ${GROUP_META[g.id]?.tagline} but groups.json tagline = ${g.tagline}`)
  }
}

// The cross-group K-POPDLE launch lives in two source-of-truth files.
if (LAUNCH_DATES.kpopdle !== KPOPDLE_LAUNCH) {
  err(`kpopdle launch drift: client LAUNCH_DATES.kpopdle = ${LAUNCH_DATES.kpopdle} but server KPOPDLE_LAUNCH = ${KPOPDLE_LAUNCH}`)
}

if (errors.length) {
  console.log(`\n${errors.length} error(s):`)
  for (const e of errors) console.log(`  ✗ ${e}`)
  console.log('\n✗ Client/server metadata is out of sync.')
  process.exit(1)
}
console.log(`✓ Client mirror matches server metadata for ${groups.length} groups + K-POPDLE.`)
