import bcrypt from 'bcryptjs'
import { UserModel, type UserDocument } from '../models/User.js'
import { signToken } from '../utils/jwt.js'
import { ApiError } from '../utils/ApiError.js'

const SALT_ROUNDS = 10

export interface AuthResult {
  token: string
  user: UserDocument
}

/** Register a new user: hash the password, persist, and return a token. */
export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  const existing = await UserModel.findOne({ email: email.toLowerCase() })
  if (existing) {
    throw ApiError.conflict('An account with this email already exists')
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const user = await UserModel.create({ name, email, passwordHash })

  return { token: signToken({ userId: user.id }), user }
}

/** Log a user in: verify credentials and return a token. */
export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const user = await UserModel.findOne({ email: email.toLowerCase() })
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password')
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    throw ApiError.unauthorized('Invalid email or password')
  }

  return { token: signToken({ userId: user.id }), user }
}

/** Fetch the current user by id (used by the "me" endpoint). */
export async function getUserById(userId: string): Promise<UserDocument> {
  const user = await UserModel.findById(userId)
  if (!user) {
    throw ApiError.notFound('User not found')
  }
  return user
}
