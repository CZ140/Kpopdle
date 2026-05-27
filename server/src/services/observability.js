import pino from 'pino'
import * as Sentry from '@sentry/node'

// Structured logger. Railway captures stdout, so JSON lines are queryable there.
// Level is configurable via LOG_LEVEL (default: info).
export const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

// Log an error with structured context AND forward it to Sentry. Sentry's
// captureException is a safe no-op when SENTRY_DSN is unset, so this works
// identically with or without a configured Sentry project.
//
// Usage in a catch block:  captureError(err, { msg: 'Error fetching daily game', group })
export function captureError(err, context = {}) {
  const { msg, ...extra } = context
  logger.error({ err, ...extra }, msg || err?.message || 'error')
  Sentry.captureException(err, { extra })
}
