import { createApp } from './app.js'
import { connectDatabase } from './config/db.js'
import { env } from './config/env.js'

/**
 * Boot the API. The HTTP server starts listening immediately so the backend is
 * responsive even if MongoDB isn't running; the DB connection is attempted in
 * the background (non-fatal in development).
 */
function start(): void {
  const app = createApp()
  app.listen(env.port, () => {
    console.log(`[server] ResumeAI API listening on http://localhost:${env.port}`)
    console.log(`[server] Environment: ${env.nodeEnv}`)
  })

  void connectDatabase()
}

start()
