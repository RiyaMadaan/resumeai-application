import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Collapsible } from '@/components/ui/Collapsible'
import type { AiCustomizeResult } from '@/api/ai.api'
import type { Experience, Resume } from '@/types/resume'

/** The parts of a proposal the user chose to keep. */
export interface CustomizeSelection {
  summary?: string
  skills?: string[]
  experience?: Experience[]
}

interface JobCustomizeReviewProps {
  /** The AI's proposal, or null when there's nothing to review. */
  proposal: AiCustomizeResult | null
  /** The resume as it currently stands in the editor (the "before" side). */
  resume: Resume
  /** Apply the chosen parts to the editor state (never saves). */
  onApply: (selection: CustomizeSelection) => void
  /** Discard the proposal and leave the resume untouched. */
  onCancel: () => void
}

type SectionKey = 'summary' | 'skills' | 'experience'
type Choice = 'current' | 'proposed'

/** True when two experience entries differ in their bullet wording. */
function bulletsDiffer(a: Experience | undefined, b: Experience | undefined): boolean {
  return (a?.bullets ?? []).join(' ') !== (b?.bullets ?? []).join(' ')
}

/** The "Updated" / "No changes" pill on a section header. */
function StatusPill({ changed }: { changed: boolean }) {
  return (
    <span
      className={
        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
        (changed ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-ink-subtle')
      }
    >
      {changed ? 'Updated' : 'No changes'}
    </span>
  )
}

/** A labelled current/proposed pair with the choice controls beneath. */
function Comparison({
  current,
  proposed,
  choice,
  onChoose,
}: {
  current: ReactNode
  proposed: ReactNode
  choice: Choice
  onChoose: (choice: Choice) => void
}) {
  return (
    <div className="space-y-2.5">
      <div
        className={
          'rounded-lg border px-3 py-2 text-sm transition-colors ' +
          (choice === 'current'
            ? 'border-brand-300 bg-white text-ink'
            : 'border-slate-200 bg-slate-50 text-ink-muted')
        }
      >
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
          Current
        </span>
        {current}
      </div>
      <div
        className={
          'rounded-lg border px-3 py-2 text-sm transition-colors ' +
          (choice === 'proposed'
            ? 'border-brand-300 bg-white text-ink'
            : 'border-slate-200 bg-slate-50 text-ink-muted')
        }
      >
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-600">
          Proposed
        </span>
        {proposed}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={choice === 'current' ? 'primary' : 'secondary'}
          onClick={() => onChoose('current')}
          aria-pressed={choice === 'current'}
        >
          Keep current
        </Button>
        <Button
          size="sm"
          variant={choice === 'proposed' ? 'primary' : 'secondary'}
          onClick={() => onChoose('proposed')}
          aria-pressed={choice === 'proposed'}
        >
          Use proposed
        </Button>
      </div>
    </div>
  )
}

/** Skill chips. */
function Chips({ items, tone }: { items: string[]; tone: 'brand' | 'neutral' }) {
  if (items.length === 0) return <em className="text-ink-subtle">Empty</em>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={
            'rounded-md px-2 py-0.5 text-xs font-medium ' +
            (tone === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-white text-ink-muted ring-1 ring-slate-200')
          }
        >
          {item}
        </span>
      ))}
    </div>
  )
}

/**
 * JobCustomizeReview — the review step for "Tailor for a job".
 *
 * Every section is collapsed to one row with its status, so the shape of the
 * proposal is readable at a glance. Each changed section is accepted or
 * rejected on its own — the user is never forced to take all of it to get any
 * of it. Nothing reaches the editor (or the database) until Apply.
 */
export function JobCustomizeReview({
  proposal,
  resume,
  onApply,
  onCancel,
}: JobCustomizeReviewProps) {
  const changed = useMemo(() => {
    if (!proposal) return { summary: false, skills: false, experience: false }
    return {
      summary: proposal.summary !== resume.summary,
      skills: proposal.skills.join('|') !== resume.skills.join('|'),
      experience: proposal.experience.some((exp, i) => bulletsDiffer(exp, resume.experience[i])),
    }
  }, [proposal, resume])

  // Changed sections start selected; the user can drop any of them.
  const [choices, setChoices] = useState<Record<SectionKey, Choice>>({
    summary: 'proposed',
    skills: 'proposed',
    experience: 'proposed',
  })

  // Reset the per-section choices whenever a new proposal arrives, so an
  // earlier "keep current" never silently carries over.
  useEffect(() => {
    if (proposal) setChoices({ summary: 'proposed', skills: 'proposed', experience: 'proposed' })
  }, [proposal])

  if (!proposal) return null

  const changedCount = Number(changed.summary) + Number(changed.skills) + Number(changed.experience)
  const hasChanges = changedCount > 0

  const buildSelection = (all = false): CustomizeSelection => {
    const take = (key: SectionKey) => changed[key] && (all || choices[key] === 'proposed')
    return {
      ...(take('summary') ? { summary: proposal.summary } : {}),
      ...(take('skills') ? { skills: proposal.skills } : {}),
      ...(take('experience') ? { experience: proposal.experience } : {}),
    }
  }

  const selectedCount = Object.keys(buildSelection()).length
  const changedExperience = proposal.experience
    .map((exp, index) => ({ exp, index }))
    .filter(({ exp, index }) => bulletsDiffer(exp, resume.experience[index]))

  const choose = (key: SectionKey) => (choice: Choice) =>
    setChoices((prev) => ({ ...prev, [key]: choice }))

  return (
    <Modal
      open
      onClose={onCancel}
      title="Tailored resume"
      className="max-w-2xl"
      footer={
        hasChanges ? (
          <>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => onApply(buildSelection())} disabled={selectedCount === 0}>
              {selectedCount === 0
                ? 'Nothing selected'
                : `Apply ${selectedCount} ${selectedCount === 1 ? 'change' : 'changes'}`}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onCancel}>
            Close
          </Button>
        )
      }
    >
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        {/* Summary of the proposal */}
        <div className="rounded-xl border border-brand-100 bg-brand-gradient-soft px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                <span aria-hidden className="mr-1 text-brand-500">
                  ✦
                </span>
                Tailored for {proposal.targetRole}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {hasChanges
                  ? `${changedCount} ${changedCount === 1 ? 'section' : 'sections'} updated${
                      proposal.missingSkills.length > 0
                        ? ` · ${proposal.missingSkills.length} to review`
                        : ''
                    }`
                  : 'Your resume already reads well against this posting.'}
              </p>
            </div>
            {hasChanges && (
              <Button size="sm" onClick={() => onApply(buildSelection(true))}>
                Apply all changes
              </Button>
            )}
          </div>
        </div>

        {/* Why these changes */}
        {proposal.reasoning.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted marker:text-brand-400">
            {proposal.reasoning.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        )}

        {/* Section-by-section */}
        <div className="space-y-2">
          <Collapsible
            title="Professional summary"
            badge={<StatusPill changed={changed.summary} />}
            defaultOpen={changed.summary}
          >
            {changed.summary ? (
              <Comparison
                current={resume.summary || <em className="text-ink-subtle">Empty</em>}
                proposed={proposal.summary}
                choice={choices.summary}
                onChoose={choose('summary')}
              />
            ) : (
              <p className="text-sm text-ink-muted">The AI left your summary as it is.</p>
            )}
          </Collapsible>

          <Collapsible title="Skills" badge={<StatusPill changed={changed.skills} />}>
            {changed.skills ? (
              <Comparison
                current={<Chips items={resume.skills} tone="neutral" />}
                proposed={<Chips items={proposal.skills} tone="brand" />}
                choice={choices.skills}
                onChoose={choose('skills')}
              />
            ) : (
              <p className="text-sm text-ink-muted">Your skills are already in a good order.</p>
            )}
          </Collapsible>

          <Collapsible
            title="Experience"
            summary={
              changed.experience
                ? `${changedExperience.length} ${changedExperience.length === 1 ? 'role' : 'roles'} reworded`
                : undefined
            }
            badge={<StatusPill changed={changed.experience} />}
          >
            {changed.experience ? (
              <div className="space-y-4">
                {changedExperience.map(({ exp, index }) => (
                  <div key={index}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                      {exp.role || 'Role'}
                      {exp.company ? ` · ${exp.company}` : ''}
                    </p>
                    <div className="space-y-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                          Current
                        </span>
                        <ul className="list-disc space-y-1 pl-4 text-sm text-ink-muted">
                          {(resume.experience[index]?.bullets ?? []).map((bullet, i) => (
                            <li key={i}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-brand-200 bg-white px-3 py-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                          Proposed
                        </span>
                        <ul className="list-disc space-y-1 pl-4 text-sm text-ink">
                          {exp.bullets.map((bullet, i) => (
                            <li key={i}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={choices.experience === 'current' ? 'primary' : 'secondary'}
                    onClick={() => choose('experience')('current')}
                    aria-pressed={choices.experience === 'current'}
                  >
                    Keep current
                  </Button>
                  <Button
                    size="sm"
                    variant={choices.experience === 'proposed' ? 'primary' : 'secondary'}
                    onClick={() => choose('experience')('proposed')}
                    aria-pressed={choices.experience === 'proposed'}
                  >
                    Use proposed
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                Your experience bullets already suit this role.
              </p>
            )}
          </Collapsible>

          {/* The AI never rewrites these — say so plainly rather than hiding them. */}
          <Collapsible title="Projects" badge={<StatusPill changed={false} />}>
            <p className="text-sm text-ink-muted">
              Tailoring doesn't change your projects. Edit them directly in the editor.
            </p>
          </Collapsible>
          <Collapsible title="Education" badge={<StatusPill changed={false} />}>
            <p className="text-sm text-ink-muted">
              Tailoring never changes education — those are facts, not wording.
            </p>
          </Collapsible>
        </div>

        {/* Honest gaps — never applied to the resume */}
        {proposal.missingSkills.length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-amber-900">Skills mentioned in the job</h3>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
              These skills appear in the job description but aren't currently on your resume. We
              didn't add them automatically — only add skills you actually have.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {proposal.missingSkills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}
