import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'

/**
 * User model.
 * Only the password *hash* is stored — never a plaintext password.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
)

// Never leak the password hash in JSON responses.
userSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash
    delete ret.__v
    return ret
  },
})

export type User = InferSchemaType<typeof userSchema>
export type UserDocument = HydratedDocument<User>

export const UserModel = model('User', userSchema)
