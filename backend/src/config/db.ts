import mongoose from 'mongoose'
import { env } from './env.js'

/**
 * Connect to MongoDB via Mongoose.
 *
 * In development the connection is non-fatal: if MongoDB isn't running the
 * HTTP server still boots (so health checks and the frontend integration work),
 * and a clear warning is logged. Database-backed routes will error until a DB
 * is available.
 */
export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true)
    // Fail fast if no server is reachable so dev boots quickly without MongoDB.
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 })
    console.log('[db] Connected to MongoDB')
  } catch (error) {
    console.warn(
      '[db] Could not connect to MongoDB. The server will keep running, but ' +
        'database routes will fail until a connection is available.',
    )
    console.warn('[db]', (error as Error).message)
  }
}
