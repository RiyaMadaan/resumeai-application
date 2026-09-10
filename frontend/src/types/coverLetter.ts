/**
 * Cover letter types — mirror the backend Mongoose schema so the whole app
 * speaks one shape, exactly as the resume types do.
 */

export interface CoverLetter {
  _id: string
  userId: string
  /** The resume this letter was written from, when one is attached. */
  resumeId?: string
  /** The user's own name for the letter — only they see it. */
  title: string
  company: string
  jobTitle: string
  jobDescription: string
  /** The letter body: plain-text paragraphs separated by blank lines. */
  body: string
  /** Set the first time AI produced a draft. */
  generatedAt?: string
  createdAt: string
  updatedAt: string
}

/** Fields a client may set. The server fills the rest with defaults. */
export type CoverLetterInput = Partial<
  Pick<CoverLetter, 'resumeId' | 'title' | 'company' | 'jobTitle' | 'jobDescription' | 'body'>
>

/** The ways an existing letter can be refined. */
export type CoverLetterRefinement = 'improve' | 'concise' | 'professional'
