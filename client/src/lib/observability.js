import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

// No-op unless VITE_SENTRY_DSN is set at build time, so local dev and builds
// without a Sentry project are unaffected.
export function initSentry() {
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  })
}

// Sentry's ErrorBoundary doubles as a normal React error boundary even when
// Sentry isn't initialised — so wrapping the app gives users a graceful
// fallback regardless, and reports to Sentry only when a DSN is configured.
export const ErrorBoundary = Sentry.ErrorBoundary

// Safe no-op when Sentry isn't initialised.
export const captureException = Sentry.captureException
