import { DEFAULT_TEMPLATE_ID, isKnownTemplate } from '@/templates/catalog'

/**
 * The template a new resume starts in.
 *
 * Choosing a template in the gallery before you have a resume to attach it to
 * has nowhere on the server to live, so the choice is remembered in the browser
 * and applied when the resume is created. From that point on the template is a
 * field on the resume itself — this is only the starting point, never the
 * source of truth for an existing resume.
 */
const KEY = 'resumeai_preferred_template'

/** The remembered template id, or the default when there is no valid one. */
export function getPreferredTemplate(): string {
  try {
    const stored = localStorage.getItem(KEY)
    // Guard against an id from an older catalog that no longer exists.
    if (isKnownTemplate(stored)) return stored as string
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — fall back.
  }
  return DEFAULT_TEMPLATE_ID
}

/** Remember a template for the next resume created. */
export function setPreferredTemplate(id: string): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Not being able to remember the choice is harmless; the default applies.
  }
}
