import { apiClient } from './client'
import type { AtsAnalysis, Experience, Resume, ResumeInput } from '@/types/resume'

/**
 * The ATS endpoint returns exactly the analysis shape the resume stores, so the
 * dashboard can render a freshly-returned report and a saved one identically.
 */
export type AtsScoreResult = AtsAnalysis

/** Structured result returned by the Ask AI endpoint. */
export interface AiEditResult {
  /** Proposed summary text (unchanged if the instruction didn't target it). */
  summary: string
  /** Proposed skills list (unchanged if the instruction didn't target it). */
  skills: string[]
  /** Friendly, plain-language summary of what the AI changed (or why it didn't). */
  summaryOfChanges: string
  /** True when the AI needs the user to provide facts or edit elsewhere. */
  needsMoreInfo: boolean
}

/** Structured proposal returned by the job-customization endpoint. */
export interface AiCustomizeResult {
  /** The role the AI understood the posting to be for. */
  targetRole: string
  /** Proposed professional summary, rewritten for this role. */
  summary: string
  /** Proposed skills — re-prioritized for this role, never invented. */
  skills: string[]
  /**
   * The full experience list, same order and length as the resume. Only the
   * bullets may differ — company, role, dates and location are untouched.
   */
  experience: Experience[]
  /**
   * Skills the job asks for that the resume doesn't evidence. Shown to the user
   * as information only — never added to the resume automatically.
   */
  missingSkills: string[]
  /** Short plain-language notes on what was tailored and why. */
  reasoning: string[]
}

/** What the extraction managed to pull out of a natural-language description. */
export interface AiGenerateCounts {
  experience: number
  education: number
  projects: number
  skills: number
  certifications: number
  contactFields: number
}

export interface AiGenerateResult {
  /** The resume content, with anything extracted merged in. */
  resume: ResumeInput
  extracted: AiGenerateCounts
  /** True when nothing could be classified and your own words were kept. */
  keptOriginalText: boolean
}

/** One turn of the interview transcript. */
export interface InterviewMessage {
  role: 'assistant' | 'user'
  content: string
}

export interface AiInterviewResult {
  /** What the interviewer says next. */
  message: string
  /** The structured draft, with the latest answer folded in. */
  draft: ResumeInput
  /** Sections that now have content. */
  covered: string[]
  /** Standard sections still empty. */
  missing: string[]
  /** True once there is enough to build a useful resume. */
  readyToGenerate: boolean
}

/** Ask AI API calls (all require authentication). */
export const aiApi = {
  /**
   * Ask the AI to improve the resume's Summary/Skills from a natural-language
   * instruction. `resume` is the user's current (possibly unsaved) editor
   * content, sent so the AI works on exactly what the user sees. Nothing is
   * saved server-side — the caller applies and saves explicitly.
   */
  async edit(
    resumeId: string,
    resume: Resume | ResumeInput,
    instruction: string,
  ): Promise<AiEditResult> {
    const { data } = await apiClient.post<AiEditResult>('/ai/edit', {
      resumeId,
      instruction,
      resume,
    })
    return data
  },

  /**
   * Tailor one of the user's resumes to a pasted job description. The server
   * re-checks ownership of the resume before anything is sent to the AI, and
   * nothing is saved — the caller reviews, applies, then saves explicitly.
   */
  async customize(
    resumeId: string,
    resume: Resume | ResumeInput,
    jobDescription: string,
  ): Promise<AiCustomizeResult> {
    const { data } = await apiClient.post<AiCustomizeResult>('/ai/customize', {
      resumeId,
      jobDescription,
      resume,
    })
    return data
  },

  /**
   * Score a resume for ATS readiness.
   *
   * `resume` is the caller's current (possibly unsaved) editor content, so the
   * score reflects what the user is looking at; omit it to analyse the saved
   * version. `jobDescription` is optional — without one the resume is judged on
   * general ATS readiness rather than against a specific role.
   *
   * The server re-checks ownership before anything is sent to the AI, and the
   * resume's content is never modified by an analysis.
   */
  async atsScore(
    resumeId: string,
    resume?: Resume | ResumeInput,
    jobDescription?: string,
  ): Promise<AtsScoreResult> {
    const { data } = await apiClient.post<AtsScoreResult>('/ai/ats-score', {
      resumeId,
      resume,
      jobDescription,
    })
    return data
  },

  /**
   * Turn a natural-language description of someone's career into structured
   * resume sections.
   *
   * Nothing is saved server-side: the merged content comes back and the caller
   * creates or updates the resume through the normal resume endpoints. Pass
   * `resume` (and `resumeId`, which is ownership-checked) to merge into a
   * resume that already exists instead of starting from nothing.
   */
  async generate(
    story: string,
    options?: { resumeId?: string; resume?: Resume | ResumeInput },
  ): Promise<AiGenerateResult> {
    const { data } = await apiClient.post<AiGenerateResult>('/ai/generate', {
      story,
      resumeId: options?.resumeId,
      resume: options?.resume,
    })
    return data
  },

  /**
   * Run one turn of the AI resume interview.
   *
   * Pass `resumeId` to continue the interview attached to an existing resume:
   * ownership is re-checked, the saved resume seeds the draft so nothing is
   * asked twice, and the transcript is stored on that resume so the
   * conversation survives a refresh or a new session.
   */
  async interview(
    messages: InterviewMessage[],
    draft?: ResumeInput,
    resumeId?: string,
  ): Promise<AiInterviewResult> {
    const { data } = await apiClient.post<AiInterviewResult>('/ai/interview', {
      messages,
      draft,
      resumeId,
    })
    return data
  },
}
