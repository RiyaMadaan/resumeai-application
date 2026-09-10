import type { Request, Response, NextFunction } from 'express'
import { Error as MongooseError } from 'mongoose'
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
  /**
   * A schema validator rejecting a value is the client sending something
   * invalid, not the server failing — so it is a 400, not a 500. The
   * field-level messages in the models are written for users, so they are
   * safe to pass on; the wrapper text Mongoose adds around them is not
   * useful, so only the individual messages are returned.
   */
  if (err instanceof MongooseError.ValidationError) {
    const detail = Object.values(err.errors)
      .map((fieldError) => fieldError.message)
      .filter(Boolean)
      .join('; ')
    res.status(400).json({
      error: detail || "Some of that information isn't valid.",
      ...(isProd ? {} : { status: 400 }),
    })
    return
  }

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
