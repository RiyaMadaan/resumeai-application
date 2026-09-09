import type { Request, Response } from 'express'
import { registerUser, loginUser, getUserById } from '../services/auth.service.js'
import { ApiError } from '../utils/ApiError.js'

/** POST /api/auth/register */
export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body ?? {}

  if (!name || !email || !password) {
    throw ApiError.badRequest('name, email and password are required')
  }
  if (String(password).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters')
  }

  const { token, user } = await registerUser(name, email, password)
  res.status(201).json({ token, user })
}

/** POST /api/auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body ?? {}

  if (!email || !password) {
    throw ApiError.badRequest('email and password are required')
  }

  const { token, user } = await loginUser(email, password)
  res.json({ token, user })
}

/** GET /api/auth/me  (protected) */
export async function me(req: Request, res: Response): Promise<void> {
  const user = await getUserById(req.userId!)
  res.json({ user })
}
