import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * requireAuth — protects routes by validating the `Authorization: Bearer <token>`
 * header. On success attaches `req.userId`; otherwise responds 401.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or invalid Authorization header')
  }

  const token = header.slice('Bearer '.length).trim()
  try {
    const payload = verifyToken(token)
    req.userId = payload.userId
    next()
  } catch {
    throw ApiError.unauthorized('Invalid or expired token')
  }
}
