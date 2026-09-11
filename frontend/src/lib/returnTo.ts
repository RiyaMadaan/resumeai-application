import { useSearchParams } from 'react-router-dom'

/**
 * Parent-context navigation.
 *
 * Several tools — customize for a job, cover letters — are reachable both from
 * a specific resume and from a global list. "Back" has to mean different
 * things in those two cases, and a hardcoded destination can only ever be
 * right for one of them.
 *
 * The originating page is carried in a query parameter rather than router
 * state, because it has to survive a refresh and a shared link. A tool URL
 * opened directly, with no parameter, falls back to its global parent.
 */
const RETURN_PARAM = 'from'

/**
 * Accept only an internal, absolute path.
 *
 * The value reaches us from the URL, so it is user input: anything with a
 * scheme, or the protocol-relative `//host` form, would turn "Back" into a
 * redirect off the app. Rejecting those leaves an in-app path or nothing.
 */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  // A backslash can be normalised to a forward slash by some browsers.
  if (value.includes('\\')) return null
  return value
}

/** Add a return target to a tool's URL. */
export function withReturnTo(path: string, returnTo?: string | null): string {
  const target = sanitizeReturnTo(returnTo)
  if (!target) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}${RETURN_PARAM}=${encodeURIComponent(target)}`
}

/** A human label for a destination, so Back says where it actually goes. */
function labelFor(path: string): string | null {
  if (/^\/resume\/[^/]+$/.test(path)) return 'Back to resume'
  if (path.startsWith('/cover-letters')) return 'Back to cover letters'
  if (path.startsWith('/dashboard')) return 'Back to resumes'
  return null
}

export interface ReturnTarget {
  /** Where Back should go. */
  to: string
  /** What the Back control should say. */
  label: string
}

/**
 * Where this page's Back control should lead.
 *
 * Pass the global parent as the fallback — it is used whenever the page was
 * opened directly rather than from somewhere specific.
 */
export function useReturnTo(fallback: ReturnTarget): ReturnTarget {
  const [searchParams] = useSearchParams()
  const target = sanitizeReturnTo(searchParams.get(RETURN_PARAM))
  if (!target) return fallback
  return { to: target, label: labelFor(target) ?? fallback.label }
}

/**
 * The raw return parameter, for pages that need to pass it onward — the cover
 * letter setup page hands it to the editor it creates, so the whole chain
 * leads back to the resume it started from.
 */
export function useRawReturnTo(): string | null {
  const [searchParams] = useSearchParams()
  return sanitizeReturnTo(searchParams.get(RETURN_PARAM))
}
