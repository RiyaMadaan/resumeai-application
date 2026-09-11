import { Link } from 'react-router-dom'
import type { Resume } from '@/types/resume'

import { getTemplate } from '@/templates/catalog'
import { TemplateThumbnail } from '@/templates/TemplateThumbnail'
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
      {/* The resume itself, in its own template — the card's main content and
          its primary navigation target. Rendered through the same component
          the editor and the PDF use, so the card can't show a design the
          resume doesn't have. */}
      <Link
        to={editPath}
        tabIndex={-1}
        aria-hidden
        className="block overflow-hidden rounded-lg bg-slate-100 p-2 ring-1 ring-slate-200/80"
      >
        <div className="overflow-hidden rounded ring-1 ring-slate-200">
          {/* Cropped to a letterbox: the top of a resume is the part worth
              recognising at this size. */}
          <div className="h-32 overflow-hidden">
            <TemplateThumbnail spec={getTemplate(resume.template)} resume={resume} />
          </div>
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
            Updated {formatUpdated(resume.updatedAt)}
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

      {/* Template and ATS as two quiet pills. The card itself is the Open
          action — a stretched link on the title — so a separate button would
          just be the same action twice. */}
      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
          {getTemplate(resume.template).name}
        </span>
        <button
          type="button"
          onClick={() => onCheckAts(resume)}
          title={ats ? `ATS ${ats.score} / 100 · ${ats.grade}` : 'Check this resume against ATS'}
          className={
            'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ' +
            (ats
              ? `bg-slate-100 hover:bg-slate-200 ${scoreTone(ats.score)}`
              : 'bg-slate-100 text-ink-subtle hover:bg-slate-200 hover:text-ink')
          }
        >
          {ats ? `ATS ${ats.score}%` : 'Check ATS'}
        </button>
      </div>

    </div>
  )
}
