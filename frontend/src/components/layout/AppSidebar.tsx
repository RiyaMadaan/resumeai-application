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
 * AppSidebar — the application's primary navigation.
 *
 * Every authenticated page renders beside this rail, including the editor, so
 * the product reads as one application with a changing content area rather
 * than a set of separate pages. It is mounted once by AppLayout and is not
 * re-created on navigation.
 *
 * The editor keeps its own second column for the resume's sections; that one
 * navigates *within* a document, where this one navigates between them.
 */

interface NavEntry {
  to: string
  label: string
  Icon: (props: { width?: number; height?: number }) => React.ReactElement
  /** Match nested paths too, e.g. /cover-letters/:id. */
  nested?: boolean
}

/**
 * The rail's groups.
 *
 * Only routes that genuinely stand on their own appear here. "Improve with AI"
 * and the ATS checker are deliberately absent: both act on a resume that is
 * already open and exist as panels in the editor, so a global entry would have
 * nowhere to go without inventing a picker screen. They sit in the editor's own
 * AI tools group, beside the sections they act on.
 */
const GROUPS: { label: string; entries: NavEntry[]; tinted?: boolean }[] = [
  {
    label: 'Content',
    entries: [{ to: '/dashboard', label: 'Resumes', Icon: BriefcaseIcon }],
  },
  {
    label: 'Documents',
    entries: [{ to: '/cover-letters', label: 'Cover letters', Icon: MailIcon, nested: true }],
  },
  {
    label: 'Design',
    entries: [{ to: '/templates', label: 'Templates', Icon: LayoutIcon }],
  },
  {
    label: 'AI tools',
    tinted: true,
    entries: [
      { to: '/customize', label: 'Customize for a job', Icon: TargetIcon },
      { to: '/resume/new/interview', label: 'Resume interview', Icon: ChatIcon },
    ],
  },
]

function NavRow({ entry }: { entry: NavEntry }) {
  return (
    <NavLink
      to={entry.to}
      end={!entry.nested}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          isActive
            ? 'bg-brand-50 font-semibold text-brand-700'
            : 'font-medium text-ink-muted hover:bg-slate-100 hover:text-ink',
        )
      }
    >
      <entry.Icon width={16} height={16} />
      <span className="truncate">{entry.label}</span>
    </NavLink>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
      {children}
    </p>
  )
}

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

      <nav aria-label="Main" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => (
          <div
            key={group.label}
            // The AI group is set apart: these act on a resume rather than
            // being places in the app.
            className={group.tinted ? 'rounded-xl bg-slate-50 p-2 pt-1.5 ring-1 ring-slate-100' : ''}
          >
            <GroupLabel>
              {group.tinted && <SparkleIcon width={12} height={12} className="text-brand-500" />}
              {group.label}
            </GroupLabel>
            <ul className="space-y-px">
              {group.entries.map((entry) => (
                <li key={entry.to}>
                  <NavRow entry={entry} />
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
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white"
              >
                {initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {user?.name ?? 'Account'}
                </span>
              </span>
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
                  navigate('/account')
                }}
                icon={<UserIcon width={15} height={15} />}
              >
                Profile
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  close()
                  navigate('/dashboard')
                }}
                icon={<GaugeIcon width={15} height={15} />}
              >
                My resumes
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
