import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu'
import { useAuth } from '@/context/AuthContext'

/**
 * AppNavbar — top bar for the authenticated application (distinct from the
 * marketing Navbar).
 *
 * This holds the app's single global "New resume" action, so no screen needs to
 * repeat it. The account details live in one dropdown rather than an avatar,
 * a name label and a separate log-out button all competing in the bar.
 */
export function AppNavbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const firstName = user?.name?.trim().split(' ')[0] ?? 'Account'
  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-container items-center justify-between gap-3 px-5 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex items-center" aria-label="ResumeAI dashboard">
          <Logo />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button size="sm" onClick={() => navigate('/resume/new')}>
            <span aria-hidden>+</span>
            <span className="hidden sm:inline">New resume</span>
            <span className="sr-only sm:hidden">New resume</span>
          </Button>

          <Menu
            label="Account menu"
            triggerClassName="rounded-full focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            trigger={
              <span className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-slate-100">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white"
                  aria-hidden
                >
                  {initial}
                </span>
                <span className="hidden text-sm font-medium text-ink sm:block">{firstName}</span>
                <svg
                  viewBox="0 0 24 24"
                  width={14}
                  height={14}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="text-ink-subtle"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            }
          >
            {(close) => (
              <>
                <div className="px-3 pb-2 pt-1">
                  <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                  <p className="truncate text-xs text-ink-subtle">{user?.email}</p>
                </div>
                <MenuSeparator />
                <MenuItem
                  onSelect={() => {
                    close()
                    navigate('/dashboard')
                  }}
                >
                  My resumes
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    close()
                    navigate('/cover-letters')
                  }}
                >
                  Cover letters
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    close()
                    navigate('/templates')
                  }}
                >
                  Templates
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  onSelect={() => {
                    close()
                    navigate('/account')
                  }}
                >
                  Profile
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  onSelect={() => {
                    close()
                    handleLogout()
                  }}
                >
                  Log out
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>
    </header>
  )
}
