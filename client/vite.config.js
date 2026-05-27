import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Source-map upload only runs when SENTRY_AUTH_TOKEN is present in the build
// environment (set as a Railway variable for production builds). Local
// `npm run dev` / `npm run build` skip it entirely — no token, no upload.
const uploadSourcemaps = !!process.env.SENTRY_AUTH_TOKEN

export default defineConfig({
  // Strip Sentry's optional code paths at build time (we use neither client-side
  // performance tracing nor debug logging). Without this the SDK ships its full
  // tracing/debug code in every local build. Done via `define` so it applies
  // regardless of whether the source-map plugin is active.
  define: {
    __SENTRY_DEBUG__: false,
    __SENTRY_TRACING__: false,
  },
  plugins: [
    react(),
    tailwindcss(),
    uploadSourcemaps && sentryVitePlugin({
      org: 'chris-marrero',
      project: 'kpopdle-client',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Delete the .map files after upload so original source isn't served from dist/.
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      // A Sentry/network hiccup during upload must never fail the production deploy.
      errorHandler: (err) => console.warn('[sentry-vite-plugin]', err.message),
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Only emit source maps when we're going to upload + delete them, so they're
    // never left publicly served when Sentry upload is off.
    sourcemap: uploadSourcemaps,
  },
})
