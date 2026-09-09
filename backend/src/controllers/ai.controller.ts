import type { Request, Response } from 'express'
import {
  generateResumeFromStory,
  editResumeWithInstruction,
  customizeResumeForJob,
  scoreResumeForAts,
  runInterviewTurn,
  type InterviewMessage,
} from '../services/ai.service.js'
import {
  getResume,
  saveAtsAnalysis,
  saveInterviewState,
} from '../services/resume.service.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * AI controllers delegate to the AI service layer. They enforce request
 * validation and — critically — authorization: the caller must own the resume
 * being edited before any of its content is sent to the AI provider.
 */

/** Maximum instruction length we accept (keeps prompts bounded). */
const MAX_INSTRUCTION_LENGTH = 2000

/**
 * Bounds on the free-text career description. The minimum keeps a one-word
 * message from reaching the model; the maximum keeps a pasted CV from blowing
 * up the prompt.
 */
const MIN_STORY_LENGTH = 20
const MAX_STORY_LENGTH = 5000

/**
 * Interview bounds. One answer is a chat message, not an essay, and a
 * conversation that has run this long has more than enough to build a resume.
 */
const MAX_ANSWER_LENGTH = 4000
const MAX_INTERVIEW_MESSAGES = 120

/**
 * Job-description bounds. The minimum keeps the AI from tailoring against a
 * one-line fragment; the maximum keeps a pasted careers page from blowing up
 * the prompt. Both produce a clear, actionable 400 rather than a vague failure.
 */
const MIN_JOB_DESCRIPTION_LENGTH = 40
const MAX_JOB_DESCRIPTION_LENGTH = 20000

/**
 * POST /api/ai/generate  (protected)
 *
 * Body: { story: string, resumeId?: string, resume?: object }
 *
 * Turns a natural-language description of someone's career into structured
 * resume sections.
 *
 * Nothing is persisted here. The caller gets the merged content back and
 * creates or saves the resume through the existing resume endpoints, so this
 * stays a pure transformation. When `resumeId` is supplied the resume must
 * belong to the caller — the same ownership gate as every other AI route.
 */
export async function generate(req: Request, res: Response): Promise<void> {
  const { story, resumeId, resume } = req.body ?? {}

  if (typeof story !== 'string' || !story.trim()) {
    throw ApiError.badRequest('Tell us a little about your experience to get started.')
  }
  const trimmed = story.trim()
  if (trimmed.length < MIN_STORY_LENGTH) {
    throw ApiError.badRequest(
      `That's a bit short to work with — please write at least ${MIN_STORY_LENGTH} characters about your experience.`,
    )
  }
  if (trimmed.length > MAX_STORY_LENGTH) {
    throw ApiError.badRequest(
      `That's too long (max ${MAX_STORY_LENGTH.toLocaleString()} characters). Try summarising your experience.`,
    )
  }

  // Merging into an existing resume requires owning it.
  let base = resume && typeof resume === 'object' ? resume : undefined
  if (typeof resumeId === 'string' && resumeId.trim()) {
    const owned = await getResume(req.userId!, resumeId)
    if (!base) base = owned.toJSON()
  }

  const result = await generateResumeFromStory({ story: trimmed, resume: base })
  res.json(result)
}

/**
 * POST /api/ai/edit  (protected)
 *
 * Body: { resumeId: string, instruction: string, resume?: object }
 *
 * Flow:
 *  1. Validate the instruction (non-empty, within length limits).
 *  2. Verify the resume belongs to the authenticated user (ownership gate) —
 *     `getResume` throws 404 if it isn't theirs, so no other user's resume can
 *     ever be sent to the AI.
 *  3. Ask the AI to improve the Summary/Skills of the user's current content.
 *  4. Return structured data ({ summary, skills, summaryOfChanges, needsMoreInfo }).
 *     Nothing is persisted here — the user applies + saves on the client.
 */
export async function edit(req: Request, res: Response): Promise<void> {
  const { resumeId, instruction, resume } = req.body ?? {}

  if (typeof instruction !== 'string' || !instruction.trim()) {
    throw ApiError.badRequest('An "instruction" is required')
  }
  if (instruction.trim().length > MAX_INSTRUCTION_LENGTH) {
    throw ApiError.badRequest(
      `Your instruction is too long (max ${MAX_INSTRUCTION_LENGTH} characters).`,
    )
  }
  if (typeof resumeId !== 'string' || !resumeId.trim()) {
    throw ApiError.badRequest('A "resumeId" is required')
  }

  // Ownership gate: throws 404 unless this resume belongs to req.userId.
  const owned = await getResume(req.userId!, resumeId)

  // Prefer the client's current (possibly unsaved) editor content so the AI
  // works on what the user actually sees; fall back to the stored resume.
  const content =
    resume && typeof resume === 'object' ? resume : owned.toJSON()

  const result = await editResumeWithInstruction({
    resume: content,
    instruction: instruction.trim(),
  })

  res.json(result)
}

/**
 * POST /api/ai/customize  (protected)
 *
 * Body: { resumeId: string, jobDescription: string, resume?: object }
 *
 * Tailors one of the user's own resumes to a pasted job description.
 *
 * Flow:
 *  1. Validate the job description (present, and within sane length bounds).
 *  2. Verify the resume belongs to the authenticated user (ownership gate) —
 *     `getResume` throws 404 if it isn't theirs (or the id is malformed), so no
 *     other user's resume can ever be sent to the AI.
 *  3. Ask the AI for a tailored proposal built strictly from existing facts.
 *  4. Return structured data ({ targetRole, summary, skills, experience,
 *     missingSkills, reasoning }). Nothing is persisted here — the user reviews,
 *     applies in the editor, and saves explicitly.
 */
export async function customize(req: Request, res: Response): Promise<void> {
  const { resumeId, jobDescription, resume } = req.body ?? {}

  if (typeof jobDescription !== 'string' || !jobDescription.trim()) {
    throw ApiError.badRequest('Please paste the job description you want to target.')
  }
  const trimmed = jobDescription.trim()
  if (trimmed.length < MIN_JOB_DESCRIPTION_LENGTH) {
    throw ApiError.badRequest(
      `That job description is too short to tailor against — please paste at least ${MIN_JOB_DESCRIPTION_LENGTH} characters of the posting.`,
    )
  }
  if (trimmed.length > MAX_JOB_DESCRIPTION_LENGTH) {
    throw ApiError.badRequest(
      `That job description is too long (max ${MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()} characters). Please paste just the role, responsibilities and requirements.`,
    )
  }
  if (typeof resumeId !== 'string' || !resumeId.trim()) {
    throw ApiError.badRequest('Please choose which resume to customize.')
  }

  // Ownership gate: throws 404 unless this resume belongs to req.userId.
  const owned = await getResume(req.userId!, resumeId)

  // Prefer the client's current (possibly unsaved) editor content so the AI
  // works on what the user actually sees; fall back to the stored resume.
  const content = resume && typeof resume === 'object' ? resume : owned.toJSON()

  const result = await customizeResumeForJob({
    resume: content,
    jobDescription: trimmed,
  })

  res.json(result)
}

/**
 * POST /api/ai/ats-score  (protected)
 *
 * Body: { resumeId: string, resume?: object, jobDescription?: string }
 *
 * Scores one of the user's own resumes for ATS readiness.
 *
 * Flow:
 *  1. Verify the resume belongs to the authenticated user (ownership gate) —
 *     `getResume` throws 404 if it isn't theirs, or the id is malformed, so no
 *     other user's resume can ever be analysed.
 *  2. Analyse the content with the AI service.
 *  3. Store the result as the resume's latest analysis (metadata only — the
 *     resume's own content is never touched) and return it.
 *
 * A job description is accepted but optional: without one the resume is judged
 * on general ATS readiness, which is the current product behaviour.
 */
export async function atsScore(req: Request, res: Response): Promise<void> {
  const { resumeId, resume, jobDescription } = req.body ?? {}

  if (typeof resumeId !== 'string' || !resumeId.trim()) {
    throw ApiError.badRequest('Please choose which resume to analyze.')
  }
  if (jobDescription !== undefined && typeof jobDescription !== 'string') {
    throw ApiError.badRequest('The job description must be text.')
  }
  const targeting = typeof jobDescription === 'string' ? jobDescription.trim() : ''
  if (targeting.length > MAX_JOB_DESCRIPTION_LENGTH) {
    throw ApiError.badRequest(
      `That job description is too long (max ${MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()} characters).`,
    )
  }

  // Ownership gate: throws 404 unless this resume belongs to req.userId.
  const owned = await getResume(req.userId!, resumeId)

  // Prefer the client's current (possibly unsaved) editor content so the score
  // reflects what the user is actually looking at; fall back to what's stored.
  const content = resume && typeof resume === 'object' ? resume : owned.toJSON()

  const result = await scoreResumeForAts({
    resume: content,
    jobDescription: targeting || undefined,
  })

  // Keep the latest score on the resume so the dashboard can show it. This is
  // metadata — the resume's content is untouched — and a storage hiccup must
  // not cost the user the analysis they just waited for.
  try {
    await saveAtsAnalysis(req.userId!, resumeId, result)
  } catch (err) {
    console.error('[ai] Could not store the ATS analysis:', err)
  }

  res.json(result)
}

/**
 * POST /api/ai/interview  (protected)
 *
 * Body: {
 *   messages: [{ role: 'assistant' | 'user', content: string }],
 *   draft?: object,
 *   resumeId?: string,
 * }
 *
 * Runs one turn of the resume interview: folds the latest answer into the
 * structured draft and returns the next question.
 *
 * With a `resumeId` the interview is attached to an existing resume — the
 * ownership gate applies, the resume's own content seeds the draft so the
 * interviewer never asks for what is already there, and the transcript is
 * stored on that resume so the conversation survives a refresh, a logout, or
 * coming back days later. The resume's *content* is not touched here; that
 * only changes when the user applies what was found, through the normal
 * resume update endpoint.
 *
 * Without a `resumeId` (a brand-new interview) nothing is persisted at all —
 * there is no resume yet to attach anything to.
 */
export async function interview(req: Request, res: Response): Promise<void> {
  const { messages, draft, resumeId } = req.body ?? {}

  if (!Array.isArray(messages) || messages.length === 0) {
    throw ApiError.badRequest('The interview needs at least one message.')
  }
  if (messages.length > MAX_INTERVIEW_MESSAGES) {
    throw ApiError.badRequest(
      'This conversation has gone on long enough — generate your resume and refine it in the editor.',
    )
  }

  const cleaned: InterviewMessage[] = []
  for (const raw of messages) {
    const role = (raw as { role?: unknown })?.role
    const content = (raw as { content?: unknown })?.content
    if (role !== 'assistant' && role !== 'user') {
      throw ApiError.badRequest('Each message must come from the assistant or the user.')
    }
    if (typeof content !== 'string') {
      throw ApiError.badRequest('Each message must have text content.')
    }
    const trimmed = content.trim()
    if (!trimmed) continue
    if (trimmed.length > MAX_ANSWER_LENGTH) {
      throw ApiError.badRequest(
        `That answer is too long (max ${MAX_ANSWER_LENGTH.toLocaleString()} characters). Try splitting it up.`,
      )
    }
    cleaned.push({ role, content: trimmed })
  }

  if (cleaned.length === 0) {
    throw ApiError.badRequest('The interview needs at least one message.')
  }
  if (!cleaned.some((m) => m.role === 'user')) {
    throw ApiError.badRequest('Answer the first question to get started.')
  }

  // Continuing on an existing resume: prove ownership, then let what is
  // already saved seed the draft so nothing gets asked twice.
  let base = draft && typeof draft === 'object' ? draft : undefined
  let owned: Awaited<ReturnType<typeof getResume>> | undefined
  if (typeof resumeId === 'string' && resumeId.trim()) {
    owned = await getResume(req.userId!, resumeId)
    if (!base) base = owned.toJSON()
  }

  const result = await runInterviewTurn({ messages: cleaned, draft: base })

  // Keep the conversation with the resume it belongs to. A storage hiccup
  // must not cost the user the answer they just waited for.
  if (owned) {
    try {
      await saveInterviewState(req.userId!, resumeId, {
        status: 'in-progress',
        messages: [...cleaned, { role: 'assistant', content: result.message }],
      })
    } catch (err) {
      console.error('[ai] Could not store the interview transcript:', err)
    }
  }

  res.json(result)
}
