import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Logo } from '@/components/ui/Logo'

/**
 * AppLayout — the one shell every authenticated page renders inside.
 *
 * The navigation rail is constant: it does not unmount or re-render when the
 * route changes, so moving between the dashboard, a resume, the templates and
 * the AI tools reads as switching tools inside one product rather than opening
 * a series of separate pages. Only the content area changes.
 *
 * There is deliberately no separate top bar on desktop. The brand and the
 * account menu live at the two ends of the rail, as the reference shows, and
 * each page supplies its own contextual header — a second global bar would
 * take vertical space from the resume preview without adding navigation that
 * the rail doesn't already carry.
 */
export function AppLayout() {
  const { pathname } = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  // A drawer that stayed open across a navigation would cover the page the
  // user just asked for.
  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  // The drawer is a layer over the page; don't let the page scroll behind it.
  useEffect(() => {
    if (!navOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [navOpen])

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* The rail. Fixed, so it stays put while the content area scrolls, with
          a spacer of the same width holding the content off it. */}
      <div className="hidden w-60 flex-shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 z-30 w-60">
          <AppSidebar />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Below `lg` the rail becomes a drawer behind a compact bar. */}
        <header className="sticky top-0 z-20 flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Logo />
        </header>

        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setNavOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 w-64 animate-fade-in">
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
