import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Logo } from '@/components/ui/Logo'

/**
 * AppLayout — the shell for authenticated pages.
 *
 * The app has two modes. Browsing surfaces — resumes, templates, cover
 * letters, account — sit beside the navigation rail, so there is always one
 * obvious way around. Working surfaces — the editor, the creation wizard and
 * the resume tools — take the whole window: they carry their own contextual
 * navigation and a "back" that returns to where you came from, and a second
 * sidebar would only take width from the resume itself.
 */

/**
 * Paths that open in focused mode.
 *
 * Matched as prefixes, with `/resume/new` listed after its children so the
 * creation *choice* screen keeps the rail while the flows it starts don't.
 */
const FOCUSED_PREFIXES = [
  '/resume/new/',
  '/resume/builder/',
  '/customize',
  '/cover-letters/new',
]

function isFocused(pathname: string): boolean {
  // A single resume: /resume/<id>, but not /resume/new or /resume/builder.
  if (/^\/resume\/[^/]+$/.test(pathname) && pathname !== '/resume/new') return true
  // A single cover letter: /cover-letters/<id>, but not the list.
  if (/^\/cover-letters\/[^/]+$/.test(pathname)) return true
  return FOCUSED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function AppLayout() {
  const { pathname } = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  if (isFocused(pathname)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop rail */}
      <div className="hidden w-60 flex-shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 w-60">
          <AppSidebar />
        </div>
      </div>

      {/* Mobile: a compact bar that opens the same rail as a drawer. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Logo />
        </header>

        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setNavOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 w-64" onClick={() => setNavOpen(false)}>
              <AppSidebar />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
