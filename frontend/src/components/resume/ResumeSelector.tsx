import { useId } from 'react'
import { getTemplate } from '@/templates/catalog'
import type { Resume } from '@/types/resume'

/**
 * ResumeSelector — the one way to choose which resume a tool acts on.
 *
 * Nothing is selected until the user selects it. The tools reached from the
 * global rail are general: which resume they should act on is the first
 * decision, and quietly defaulting to whichever happens to be first in the
 * list means the user can run an AI action on the wrong document without ever
 * being asked. `value` starts empty and the caller keeps its primary action
 * disabled until it isn't.
 *
 * A resume already in context — the editor, or a tool opened from one — should
 * pass that id in rather than showing this at all.
 */
export function ResumeSelector({
  resumes,
  value,
  onChange,
  label = 'Resume',
  hint,
  disabled,
}: {
  resumes: Resume[]
  /** The chosen id, or '' for nothing chosen yet. */
  value: string
  onChange: (id: string) => void
  label?: string
  hint?: string
  disabled?: boolean
}) {
  const id = useId()

  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || resumes.length === 0}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-[15px] text-ink shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
        >
          <option value="">Select a resume</option>
          {resumes.map((resume) => (
            <option key={resume._id} value={resume._id}>
              {/* Name plus template: enough to tell two "Untitled Resume"s
                  apart without the option becoming a paragraph. */}
              {resume.title || 'Untitled Resume'} · {getTemplate(resume.template).name}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
    </div>
  )
}

/** Shown in place of the selector when the account has no resumes yet. */
export function NoResumesYet({ action }: { action: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-ink">You don't have any resumes yet</p>
      <p className="mt-1 text-sm text-ink-muted">
        Create one first — these tools work on a resume you already have.
      </p>
      <div className="mt-4 flex justify-center">{action}</div>
    </div>
  )
}
