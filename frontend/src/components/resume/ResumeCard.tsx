import { Link } from 'react-router-dom'
import type { Resume } from '@/types/resume'
import { buttonClasses } from '@/components/ui/Button'
import { getTemplate } from '@/templates/catalog'
import { resumeEditPath } from '@/lib/resumeRoutes'
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu'

/** Format an ISO date into a short, friendly "Updated" label. */
function formatUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Score colour bands, matching the ATS report. */
function scoreTone(score: number): string {
  if (score >= 78) return 'text-emerald-700'
  if (score >= 62) return 'text-brand-700'
  if (score >= 45) return 'text-amber-700'
  return 'text-red-700'
}

interface ResumeCardProps {
  resume: Resume
  onRename: (resume: Resume) => void
  onDuplicate: (resume: Resume) => void
  onDelete: (resume: Resume) => void
  /** Open the ATS report for this resume. */
  onCheckAts: (resume: Resume) => void
}

/**
 * ResumeCard — one resume in the dashboard grid.
 *
 * The card has a single obvious action (Open). Rename, Duplicate and Delete
 * live behind the overflow menu, so a destructive action is never sitting one
 * pixel away from the one people click all day.
 */
export function ResumeCard({
  resume,
  onRename,
  onDuplicate,
  onDelete,
  onCheckAts,
}: ResumeCardProps) {
  const ats = resume.atsAnalysis

  // Manual resumes reopen in the step builder; everything else in the full
  // editor. Resolved once so all three links on this card always agree.
  const editPath = resumeEditPath(resume)

  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-200">
      {/* Thumbnail — also the primary navigation target. */}
      <Link
        to={editPath}
        tabIndex={-1}
        aria-hidden
        className="flex h-28 items-center justify-center rounded-lg bg-brand-gradient-soft ring-1 ring-brand-100/70"
      >
        <div className="w-20 space-y-1.5 rounded-md bg-white p-2.5 shadow-sm">
          <div className="h-1.5 w-3/4 rounded-full bg-brand-200" />
          <div className="h-1 w-full rounded-full bg-slate-200" />
          <div className="h-1 w-5/6 rounded-full bg-slate-200" />
          <div className="h-1 w-2/3 rounded-full bg-slate-200" />
        </div>
      </Link>

      {/* Title + meta */}
      <div className="mt-3.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-ink">
            {/* Stretched link makes the whole card clickable without nesting
                interactive elements inside an anchor. */}
            <Link
              to={editPath}
              className="after:absolute after:inset-0 after:content-[''] hover:text-brand-700"
            >
              {resume.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-xs text-ink-subtle">
            Updated {formatUpdated(resume.updatedAt)} ·{' '}
            <span>{getTemplate(resume.template).name}</span>
          </p>
        </div>

        <Menu
          label={`More actions for ${resume.title}`}
          className="relative z-30"
          triggerClassName="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          trigger={
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-slate-100 hover:text-ink">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
                <circle cx="12" cy="5" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="12" cy="19" r="1.6" />
              </svg>
            </span>
          }
        >
          {(close) => (
            <>
              <MenuItem
                onSelect={() => {
                  close()
                  onRename(resume)
                }}
              >
                Rename
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  close()
                  onDuplicate(resume)
                }}
              >
                Duplicate
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                tone="danger"
                onSelect={() => {
                  close()
                  onDelete(resume)
                }}
              >
                Delete
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      {/* ATS status — compact, and the same shape whether or not a score exists. */}
      <div className="relative z-10 mt-3.5 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
          ATS Score
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          {ats ? (
            <p className="text-sm text-ink">
              <span className={`font-bold tabular-nums ${scoreTone(ats.score)}`}>
                {ats.score}
              </span>
              <span className="text-ink-subtle"> / 100 · </span>
              <span className="font-medium">{ats.grade}</span>
            </p>
          ) : (
            <p className="text-sm text-ink-subtle">Not checked yet</p>
          )}
          <button
            type="button"
            onClick={() => onCheckAts(resume)}
            className="shrink-0 rounded-md text-xs font-semibold text-brand-700 transition-colors hover:text-brand-800 hover:underline"
          >
            {ats ? 'View report' : 'Check ATS'}
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-3.5">
        {/* A router Link, not an anchor: Open should not reload the app. */}
        <Link
          to={editPath}
          className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'w-full' })}
        >
          Open
        </Link>
      </div>
    </div>
  )
}
