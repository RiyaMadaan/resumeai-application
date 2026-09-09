import { isValidObjectId } from 'mongoose'
import {
  CREATION_METHODS,
  ResumeModel,
  type CreationMethod,
  type ResumeContent,
  type ResumeDocument,
} from '../models/Resume.js'
import type { AtsScoreResult } from './ai.service.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * Fields a client is allowed to set/update on a resume.
 *
 * Built from the model's plain `ResumeContent` shape rather than the hydrated
 * document type, so services can pass ordinary objects and arrays around.
 */
export type ResumeInput = Partial<ResumeContent>

/** List all resumes belonging to a user, newest first. */
export async function listResumes(userId: string): Promise<ResumeDocument[]> {
  return ResumeModel.find({ userId }).sort({ updatedAt: -1 })
}

/**
 * What may be supplied when a resume is first created.
 *
 * Provenance is declared here and only here: how a resume came to exist is
 * fixed at birth, so `updateResume` strips these fields rather than letting a
 * later edit rewrite history.
 */
export type ResumeCreateInput = ResumeInput & {
  creationMethod?: CreationMethod
  aiInterview?: InterviewState
}

/** Keep only a well-formed transcript; anything else is dropped. */
function sanitizeInterview(value: unknown): InterviewState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as { status?: unknown; messages?: unknown }
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .filter(
          (m): m is { role: 'assistant' | 'user'; content: string } =>
            !!m &&
            typeof m === 'object' &&
            ((m as { role?: unknown }).role === 'assistant' ||
              (m as { role?: unknown }).role === 'user') &&
            typeof (m as { content?: unknown }).content === 'string',
        )
        .map((m) => ({ role: m.role, content: m.content }))
    : []
  return {
    status: raw.status === 'completed' ? 'completed' : 'in-progress',
    messages,
  }
}

/** Create a new resume for a user. */
export async function createResume(
  userId: string,
  data: ResumeCreateInput,
): Promise<ResumeDocument> {
  const { creationMethod, aiInterview, ...content } = data
  const method =
    typeof creationMethod === 'string' &&
    (CREATION_METHODS as readonly string[]).includes(creationMethod)
      ? creationMethod
      : 'scratch'
  const interview = sanitizeInterview(aiInterview)

  return ResumeModel.create({
    ...content,
    userId,
    creationMethod: method,
    ...(interview
      ? { aiInterview: { ...interview, updatedAt: new Date().toISOString() } }
      : {}),
  })
}

/**
 * Get a single resume, ensuring it belongs to the requesting user.
 *
 * A malformed id is treated as 'not found' rather than allowed to blow up as a
 * Mongoose CastError — and the query is always scoped by userId, so one user
 * can never read another user's resume by guessing an id.
 */
export async function getResume(userId: string, id: string): Promise<ResumeDocument> {
  if (!isValidObjectId(id)) {
    throw ApiError.notFound('Resume not found')
  }
  const resume = await ResumeModel.findOne({ _id: id, userId })
  if (!resume) {
    throw ApiError.notFound('Resume not found')
  }
  return resume
}

/** Update a resume the user owns. */
export async function updateResume(
  userId: string,
  id: string,
  data: ResumeInput,
): Promise<ResumeDocument> {
  if (!isValidObjectId(id)) {
    throw ApiError.notFound('Resume not found')
  }
  // `atsAnalysis` is metadata written only by the ATS endpoint — a client can't
  // hand itself a score by including it in a normal update.
  const {
    atsAnalysis: _ats,
    aiInterview: _interview,
    creationMethod: _method,
    ...content
  } = data as ResumeInput & {
    atsAnalysis?: unknown
    aiInterview?: unknown
    creationMethod?: unknown
  }
  const resume = await ResumeModel.findOneAndUpdate({ _id: id, userId }, content, {
    new: true,
    runValidators: true,
  })
  if (!resume) {
    throw ApiError.notFound('Resume not found')
  }
  return resume
}

/** Delete a resume the user owns. */
export async function deleteResume(userId: string, id: string): Promise<void> {
  if (!isValidObjectId(id)) {
    throw ApiError.notFound('Resume not found')
  }
  const result = await ResumeModel.findOneAndDelete({ _id: id, userId })
  if (!result) {
    throw ApiError.notFound('Resume not found')
  }
}

/**
 * Store the latest ATS analysis for a resume the user owns.
 *
 * The query is scoped by both `_id` and `userId`, so one user can never attach
 * an analysis to another user's resume. The previous analysis is replaced —
 * we keep the latest result, not a history. A failure here is deliberately not
 * fatal to the caller: the analysis itself is still returned to the user.
 */
export async function saveAtsAnalysis(
  userId: string,
  id: string,
  analysis: AtsScoreResult,
): Promise<void> {
  if (!isValidObjectId(id)) return
  await ResumeModel.updateOne({ _id: id, userId }, { $set: { atsAnalysis: analysis } })
}

/** The transcript and status stored alongside a resume. */
export interface InterviewState {
  status: 'in-progress' | 'completed'
  messages: { role: 'assistant' | 'user'; content: string }[]
}

/**
 * Record how a resume was created. Set once, when it is created — a resume
 * that was written from scratch does not become an interview resume just
 * because an interview was later run on it.
 */
export async function setCreationMethod(
  userId: string,
  id: string,
  method: CreationMethod,
): Promise<void> {
  if (!isValidObjectId(id)) return
  await ResumeModel.updateOne({ _id: id, userId }, { $set: { creationMethod: method } })
}

/**
 * Store the interview attached to a resume the user owns.
 *
 * Scoped by `_id` and `userId` together, so one user can never write a
 * transcript onto another user's resume. Only the conversation and its status
 * are written — the resume's own content is untouched until the user applies
 * what the interview found.
 */
export async function saveInterviewState(
  userId: string,
  id: string,
  state: InterviewState,
): Promise<void> {
  if (!isValidObjectId(id)) return
  await ResumeModel.updateOne(
    { _id: id, userId },
    {
      $set: {
        aiInterview: {
          status: state.status,
          messages: state.messages,
          updatedAt: new Date().toISOString(),
        },
      },
    },
  )
}
