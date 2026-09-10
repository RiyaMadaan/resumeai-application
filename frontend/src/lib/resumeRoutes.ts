import type { Resume } from '@/types/resume'

/**
 * Where a resume opens.
 *
 * A resume can now be edited in two places — the step-by-step builder and the
 * full editor — so "open this resume" has to resolve to one of them. Every
 * entry point (the dashboard card, the customize picker, a post-save redirect)
 * asks this function rather than hard-coding a path, so the answer can only be
 * given in one place and cannot drift between screens.
 *
 * The rule is deliberately conservative: only a resume explicitly recorded as
 * built with the step flow reopens there. Everything else — including every
 * resume created before the builder existed, which carries the historic
 * default of `scratch` — keeps opening in the full editor exactly as before.
 * Nothing is inferred from the shape of the data, so no existing resume can
 * have its editor changed underneath the user.
 */
export function resumeEditPath(resume: Pick<Resume, '_id' | 'creationMethod'>): string {
  return resume.creationMethod === 'manual'
    ? `/resume/builder/${resume._id}`
    : `/resume/${resume._id}`
}

/** True when this resume's home is the step-by-step builder. */
export function isManualResume(
  resume: Pick<Resume, 'creationMethod'> | null | undefined,
): boolean {
  return resume?.creationMethod === 'manual'
}
