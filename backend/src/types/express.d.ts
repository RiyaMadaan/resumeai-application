import 'express'

/**
 * Augment Express's Request so authenticated routes can read `req.userId`
 * after the auth middleware has verified the JWT.
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export {}
