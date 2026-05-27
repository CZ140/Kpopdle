// Sentry must initialise before the rest of the app loads so its automatic
// instrumentation can hook into http/express. This module is therefore the
// VERY FIRST import in index.js. No-op unless SENTRY_DSN is set, so local dev
// and anyone without a Sentry project is completely unaffected.
import 'dotenv/config'
import * as Sentry from '@sentry/node'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  })
}

// Registers the Express error handler only when Sentry is active.
export function setupSentryErrorHandler(app) {
  if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app)
}
