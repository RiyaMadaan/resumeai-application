import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/ui/Logo'
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu'
import {
  BriefcaseIcon,
  ChatIcon,
  GaugeIcon,
  LayoutIcon,
  MailIcon,
  SparkleIcon,
  TargetIcon,
  UserIcon,
} from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'

/**
 * AppSidebar — the application's only vertical navigation.
 *
 * Every authenticated page renders beside this, the editor included; the
 * editor's own sections are a horizontal band under its header rather than a
 * second rail. It is mounted once by AppLayout and is not re-created on
 * navigation.
 */

interface NavEntry {
  label: string
  Icon: (props: { width?: number; height?: number }) => React.ReactElement
  /** A route, for tools that stand on their own. */
  to: string
  /** Match nested paths too, e.g. /cover-letters/:id. */
  nested?: boolean
}

const GROUPS: { label: string; entries: NavEntry[] }[] = [
  { label: 'Content', entries: [{ to: '/dashboard', label: 'Resumes', Icon: BriefcaseIcon }] },
  {
    label: 'Documents',
    entries: [{ to: '/cover-letters', label: 'Cover letters', Icon: MailIcon, nested: true }],
  },
  { label: 'Design', entries: [{ to: '/templates', label: 'Templates', Icon: LayoutIcon }] },
  {
    label: 'AI tools',
    entries: [
      { to: '/customize', label: 'Customize for a job', Icon: TargetIcon },
      { to: '/resume/new/interview', label: 'Resume interview', Icon: ChatIcon },
      { to: '/ats', label: 'ATS checker', Icon: GaugeIcon },
      { to: '/improve', label: 'Improve with AI', Icon: SparkleIcon },
      { to: '/cover-letters/new', label: 'Cover letter', Icon: MailIcon },
    ],
  },
]

const ROW =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
const ROW_IDLE = 'font-medium text-ink-muted hover:bg-slate-100 hover:text-ink'
const ROW_ACTIVE = 'bg-brand-50 font-semibold text-brand-700'

export function AppSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 flex-shrink-0 items-center px-4">
        <NavLink to="/dashboard" aria-label="ResumeAI home" className="flex items-center">
          <Logo />
        </NavLink>
      </div>

      {/* Groups are separated by their labels and spacing alone — a box around
          each one would add three borders to a panel that already has one. */}
      <nav aria-label="Main" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              {group.label}
            </p>
            <ul className="space-y-px">
              {group.entries.map((entry) => (
                <li key={entry.label}>
                  <NavLink
                    to={entry.to}
                    end={!entry.nested}
                    className={({ isActive }) => cn(ROW, isActive ? ROW_ACTIVE : ROW_IDLE)}
                  >
                    <entry.Icon width={16} height={16} />
                    <span className="truncate">{entry.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Account */}
      <div className="flex-shrink-0 border-t border-slate-200 p-3">
        <Menu
          label="Account menu"
          className="relative w-full"
          triggerClassName="w-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          trigger={
            <span className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-100">
              <span
                aria-hidden
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white"
              >
                {initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {user?.name ?? 'Account'}
                </span>
                <span className="block truncate text-[11px] text-ink-subtle">
                  {user?.email ?? ''}
                </span>
              </span>
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
                className="flex-shrink-0 text-ink-subtle"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          }
        >
          {(close) => (
            <>
              <MenuItem
                onSelect={() => {
                  close()
                  navigate('/account')
                }}
                icon={<UserIcon width={15} height={15} />}
              >
                Profile
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                onSelect={() => {
                  close()
                  logout()
                  navigate('/login')
                }}
              >
                Log out
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </aside>
  )
}
