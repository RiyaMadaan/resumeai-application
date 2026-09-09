import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import apiRoutes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.middleware.js'

/**
 * Build and configure the Express application (no listening here — that lives
 * in index.ts so the app can be imported for testing later).
 */
export function createApp() {
  const app = express()

  app.use(cors({ origin: env.clientOrigin, credentials: true }))
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
