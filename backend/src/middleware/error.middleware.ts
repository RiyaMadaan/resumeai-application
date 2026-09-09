import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../utils/ApiError.js'
import { isProd } from '../config/env.js'

/** 404 handler for unmatched routes. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`))
}

/** Central error handler — converts thrown errors into clean JSON. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const status = err instanceof ApiError ? err.status : 500
  const message =
    err instanceof Error ? err.message : 'Something went wrong on the server'

  if (status >= 500) {
    console.error('[error]', err)
  }

  res.status(status).json({
    error: message,
    ...(isProd ? {} : { status }),
  })
}
