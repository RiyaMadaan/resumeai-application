import type { Resume } from '@/types/resume'

/**
 * Where a resume opens.
 *
 * A saved resume always opens in the full editor. The step-by-step wizard is
 * for *creating* a resume: it walks someone through an empty document once,
 * and reopening a finished resume inside it would make an editing task look
 * like unfinished onboarding.
 *
 * The wizard still owns `/resume/builder/:id` while a resume is being created,
 * so refreshing mid-flow resumes where the user left off — but nothing outside
 * that flow ever routes there.
 *
 * Every entry point (the dashboard card, the customize picker, a post-save
 * redirect) asks this function rather than hard-coding a path, so the answer
 * is given in one place and cannot drift between screens.
 */
export function resumeEditPath(resume: Pick<Resume, '_id'>): string {
  return `/resume/${resume._id}`
}

/**
 * True when this resume was built with the step-by-step wizard.
 *
 * Provenance is still recorded — it is genuine history, and the wizard uses it
 * to resume an in-progress build — but it no longer decides where a saved
 * resume opens.
 */
export function isManualResume(
  resume: Pick<Resume, 'creationMethod'> | null | undefined,
): boolean {
  return resume?.creationMethod === 'manual'
}
