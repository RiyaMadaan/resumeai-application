import { isValidObjectId } from 'mongoose'
import {
  CoverLetterModel,
  MAX_BODY_LENGTH,
  type CoverLetterDocument,
} from '../models/CoverLetter.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * Cover letter persistence.
 *
 * Mirrors the resume service: every read and write is scoped to the owning
 * user, so an id alone is never enough to reach someone else's letter. A
 * missing document and a document belonging to another user both surface as
 * 404, which avoids confirming that an id exists.
 */

/** Fields a client may set on a cover letter. */
export interface CoverLetterInput {
  resumeId?: string
  title?: string
  company?: string
  jobTitle?: string
  jobDescription?: string
  body?: string
}

/** Keep only the fields a client is allowed to write, trimmed and bounded. */
function sanitize(input: CoverLetterInput): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  const text = (value: unknown, max: number): string | undefined =>
    typeof value === 'string' ? value.slice(0, max) : undefined

  const title = text(input.title, 200)
  if (title !== undefined) clean.title = title.trim()

  const company = text(input.company, 200)
  if (company !== undefined) clean.company = company.trim()

  const jobTitle = text(input.jobTitle, 200)
  if (jobTitle !== undefined) clean.jobTitle = jobTitle.trim()

  const jobDescription = text(input.jobDescription, 20000)
  if (jobDescription !== undefined) clean.jobDescription = jobDescription

  const body = text(input.body, MAX_BODY_LENGTH)
  if (body !== undefined) clean.body = body

  // An invalid resume reference is dropped rather than rejected: the letter
  // itself is still perfectly usable without one.
  if (input.resumeId !== undefined) {
    clean.resumeId = isValidObjectId(input.resumeId) ? input.resumeId : undefined
  }

  return clean
}

/** List a user's cover letters, most recently updated first. */
export async function listCoverLetters(userId: string): Promise<CoverLetterDocument[]> {
  return CoverLetterModel.find({ userId }).sort({ updatedAt: -1 })
}

/** Fetch one cover letter the user owns. */
export async function getCoverLetter(userId: string, id: string): Promise<CoverLetterDocument> {
  if (!isValidObjectId(id)) {
    throw ApiError.notFound('Cover letter not found')
  }
  const letter = await CoverLetterModel.findOne({ _id: id, userId })
  if (!letter) {
    throw ApiError.notFound('Cover letter not found')
  }
  return letter
}

/** Create a cover letter for a user. */
export async function createCoverLetter(
  userId: string,
  input: CoverLetterInput,
  options: { generated?: boolean } = {},
): Promise<CoverLetterDocument> {
  return CoverLetterModel.create({
    ...sanitize(input),
    userId,
    ...(options.generated ? { generatedAt: new Date() } : {}),
  })
}

/** Update a cover letter the user owns. */
export async function updateCoverLetter(
  userId: string,
  id: string,
  input: CoverLetterInput,
  options: { generated?: boolean } = {},
): Promise<CoverLetterDocument> {
  if (!isValidObjectId(id)) {
    throw ApiError.notFound('Cover letter not found')
  }
  const letter = await CoverLetterModel.findOneAndUpdate(
    { _id: id, userId },
    {
      ...sanitize(input),
      // Only ever set on an actual generation, so a hand edit doesn't look
      // like the AI wrote it.
      ...(options.generated ? { generatedAt: new Date() } : {}),
    },
    { new: true, runValidators: true },
  )
  if (!letter) {
    throw ApiError.notFound('Cover letter not found')
  }
  return letter
}

/** Delete a cover letter the user owns. */
export async function deleteCoverLetter(userId: string, id: string): Promise<void> {
  if (!isValidObjectId(id)) {
    throw ApiError.notFound('Cover letter not found')
  }
  const result = await CoverLetterModel.findOneAndDelete({ _id: id, userId })
  if (!result) {
    throw ApiError.notFound('Cover letter not found')
  }
}
