import type { Request, Response } from 'express'
import {
  COVER_LETTER_REFINEMENTS,
  generateCoverLetter,
  refineCoverLetter,
  type CoverLetterRefinement,
} from '../services/ai.service.js'
import {
  createCoverLetter,
  deleteCoverLetter,
  getCoverLetter,
  listCoverLetters,
  updateCoverLetter,
} from '../services/coverLetter.service.js'
import { getResume } from '../services/resume.service.js'
import { MAX_BODY_LENGTH } from '../models/CoverLetter.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * Cover letter controllers.
 *
 * CRUD lives alongside the AI actions so ownership is enforced in exactly one
 * place: every handler resolves the letter (and, for generation, the resume)
 * through a service call scoped to `req.userId`. A letter or resume belonging
 * to someone else is a 404 before any content reaches the AI provider.
 */

/**
 * Job-description bounds. The minimum stops the AI tailoring against a
 * one-line fragment — which is where generic, invented-sounding letters come
 * from — and the maximum keeps a pasted careers page out of the prompt.
 */
const MIN_JOB_DESCRIPTION_LENGTH = 40
const MAX_JOB_DESCRIPTION_LENGTH = 20000

/** Validate the job description, with a message the user can act on. */
function requireJobDescription(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw ApiError.badRequest('Paste the job description you want this letter written for.')
  }
  const trimmed = value.trim()
  if (trimmed.length < MIN_JOB_DESCRIPTION_LENGTH) {
    throw ApiError.badRequest(
      `That job description is too short to work with — please paste at least ${MIN_JOB_DESCRIPTION_LENGTH} characters.`,
    )
  }
  if (trimmed.length > MAX_JOB_DESCRIPTION_LENGTH) {
    throw ApiError.badRequest(
      `That job description is too long (max ${MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()} characters).`,
    )
  }
  return trimmed
}

/** An optional short text field (company, job title). */
function optionalText(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** GET /api/cover-letters  (protected) */
export async function list(req: Request, res: Response): Promise<void> {
  const letters = await listCoverLetters(req.userId!)
  res.json({ coverLetters: letters })
}

/** GET /api/cover-letters/:id  (protected) */
export async function getOne(req: Request, res: Response): Promise<void> {
  const letter = await getCoverLetter(req.userId!, req.params.id)
  res.json({ coverLetter: letter })
}

/**
 * POST /api/cover-letters  (protected)
 *
 * Creates an empty letter the user can fill in and generate into. Kept
 * separate from generation so the record exists (and is saved) before any AI
 * call — a failed generation then never loses the user's inputs.
 */
export async function create(req: Request, res: Response): Promise<void> {
  const letter = await createCoverLetter(req.userId!, req.body ?? {})
  res.status(201).json({ coverLetter: letter })
}

/** PUT /api/cover-letters/:id  (protected) — save manual edits. */
export async function update(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {}
  if (typeof body.body === 'string' && body.body.length > MAX_BODY_LENGTH) {
    throw ApiError.badRequest('That cover letter is too long to save.')
  }
  const letter = await updateCoverLetter(req.userId!, req.params.id, body)
  res.json({ coverLetter: letter })
}

/** DELETE /api/cover-letters/:id  (protected) */
export async function remove(req: Request, res: Response): Promise<void> {
  await deleteCoverLetter(req.userId!, req.params.id)
  res.status(204).send()
}

/**
 * POST /api/cover-letters/:id/generate  (protected)
 *
 * Body: { resumeId, jobDescription, company?, jobTitle? }
 *
 * Writes a first draft (or replaces the current one on a regenerate). The
 * inputs are saved alongside the result so reopening the letter later shows
 * what it was written against, and so a regenerate needs no re-entry.
 */
export async function generate(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  // Ownership gate on the letter itself before anything else happens.
  const letter = await getCoverLetter(userId, req.params.id)

  const body = req.body ?? {}
  const jobDescription = requireJobDescription(body.jobDescription ?? letter.jobDescription)
  const company = optionalText(body.company ?? letter.company)
  const jobTitle = optionalText(body.jobTitle ?? letter.jobTitle)

  const resumeId =
    typeof body.resumeId === 'string' && body.resumeId
      ? body.resumeId
      : letter.resumeId?.toString()
  if (!resumeId) {
    throw ApiError.badRequest('Choose which resume this cover letter should be based on.')
  }

  // Ownership gate on the resume — its content is what reaches the AI.
  const resume = await getResume(userId, resumeId)

  const result = await generateCoverLetter({
    resume: resume.toJSON(),
    jobDescription,
    company,
    jobTitle,
  })

  const updated = await updateCoverLetter(
    userId,
    req.params.id,
    { resumeId, jobDescription, company, jobTitle, body: result.body },
    { generated: true },
  )
  res.json({ coverLetter: updated })
}

/**
 * POST /api/cover-letters/:id/refine  (protected)
 *
 * Body: { refinement: 'improve' | 'concise' | 'professional', body?: string }
 *
 * Rewrites the letter in one direction. `body` is the client's current text —
 * possibly hand-edited and not yet saved — so a refinement always acts on what
 * the user is actually looking at.
 */
export async function refine(req: Request, res: Response): Promise<void> {
  const userId = req.userId!
  const letter = await getCoverLetter(userId, req.params.id)

  const payload = req.body ?? {}
  const refinement = payload.refinement as CoverLetterRefinement
  if (!COVER_LETTER_REFINEMENTS.includes(refinement)) {
    throw ApiError.badRequest('Unknown cover letter action.')
  }

  const current = typeof payload.body === 'string' && payload.body.trim() ? payload.body : letter.body
  if (!current?.trim()) {
    throw ApiError.badRequest('Generate a cover letter first, then refine it.')
  }
  if (current.length > MAX_BODY_LENGTH) {
    throw ApiError.badRequest('That cover letter is too long to refine.')
  }

  const resumeId = letter.resumeId?.toString()
  if (!resumeId) {
    throw ApiError.badRequest('Choose which resume this cover letter should be based on.')
  }
  const resume = await getResume(userId, resumeId)

  const result = await refineCoverLetter({
    resume: resume.toJSON(),
    jobDescription: letter.jobDescription ?? '',
    company: letter.company ?? '',
    jobTitle: letter.jobTitle ?? '',
    body: current,
    refinement,
  })

  // A refinement is still a save: the user sees the new text and it persists.
  const updated = await updateCoverLetter(userId, req.params.id, { body: result.body })
  res.json({ coverLetter: updated })
}
