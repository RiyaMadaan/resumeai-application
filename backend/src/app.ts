import express, { type Request, type Response } from 'express'
import cors, { type CorsOptions } from 'cors'
import { env } from './config/env.js'
import apiRoutes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.middleware.js'

/**
 * Build and configure the Express application (no listening here — that lives
 * in index.ts so the app can be imported for testing later).
 */
export function createApp() {
  const app = express()

  /**
   * CORS. `credentials: true` is required because the app authenticates, so a
   * wildcard origin is not permissible — the browser rejects `*` alongside
   * credentials. Instead we reflect back any origin on the configured
   * allowlist (see CLIENT_ORIGIN).
   */
  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      // Requests with no Origin header (curl, health checks, server-to-server)
      // aren't browser cross-origin requests, so there is nothing to block.
      if (!origin || env.clientOrigins.includes(origin)) {
        return callback(null, true)
      }
      // Deny by omitting the CORS headers rather than throwing: the browser
      // blocks the response, and the API doesn't emit a spurious 500.
      console.warn(`[cors] Blocked origin: ${origin}`)
      return callback(null, false)
    },
    credentials: true,
  }

  // A single CORS registration, applied to preflight and actual requests alike,
  // so no route can emit a second, conflicting set of CORS headers.
  app.use(cors(corsOptions))
  app.options('*', cors(corsOptions))
  app.use(express.json({ limit: '1mb' }))

  // Lightweight health check (no DB required).
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'resumeai-api' })
  })

  // Feature routes.
  app.use('/api', apiRoutes)

  // 404 + centralized error handling (must be last).
  app.use(notFound)
  app.use(errorHandler)

  return app
}
