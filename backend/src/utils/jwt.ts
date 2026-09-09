import jwt, { type SignOptions } from 'jsonwebtoken'
import { env } from '../config/env.js'

export interface JwtPayload {
  userId: string
}

/** Sign a short user payload into a JWT. */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  })
}

/** Verify a JWT and return its payload, or throw if invalid/expired. */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload
}
