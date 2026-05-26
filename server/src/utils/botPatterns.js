// Shared bot/scanner classification, used by both the live request logger and
// the Cloudflare backfill so "is this a bot?" is decided one way everywhere.

// Vulnerability scanners and crawlers — internet background noise. Flagging them
// lets the dashboard separate real failures from automated probes.
export const SCANNER_PATH = /(wp-config|wp-admin|wp-login|xmlrpc|phpmyadmin|\.env|\.git|\.aws|\/vendor\/|\.php|credentials|\.ssh|\.docker|config\.js$|common\.js$)/i

export const BOT_UA = /(bot|crawler|spider|scan|curl|wget|python-requests|go-http|httpclient|semrush|ahrefs|mj12|dotbot|bytespider|petalbot|headless|probe|uptime|healthcheck)/i

// A path that is itself a tell-tale scan target (no user-agent needed).
export function isScannerPath(path) {
  return SCANNER_PATH.test(path)
}

// Live classification: scanner path, OR a bot user-agent. Missing UA is treated
// as a bot (real browsers always send one).
export function classifyBot(path, ua) {
  return SCANNER_PATH.test(path) || (ua ? BOT_UA.test(ua) : true)
}
