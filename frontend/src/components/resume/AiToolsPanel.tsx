import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/LoadingState'
import { SparkleIcon } from '@/components/ui/icons'
import { aiApi, type AiEditResult } from '@/api/ai.api'
import { getApiErrorMessage } from '@/api/client'
import type { Resume } from '@/types/resume'

/**
 * Suggested instructions, grouped by the section being edited.
 *
 * Every one of these is ordinary text sent to the same `/ai/edit` endpoint the
 * free-text box uses — they are shortcuts, not features.
 *
 * They are also bounded by what that endpoint can actually apply: it proposes a
 * new summary and a new skills list, and answers `needsMoreInfo` for anything
 * else. So there is no "rewrite my bullet points" chip, however natural it
 * would look on the Experience tab — it would fail every time. Sections the
 * endpoint can't rewrite get the general set plus a line saying what Ask AI
 * changes, and the free-text box still accepts anything.
 */
const SUGGESTIONS: Record<string, string[]> = {
  summary: [
    'Make my summary more concise',
    'Make my summary more professional',
    'Make my summary more ATS-friendly',
    'Use stronger action words in my summary',
  ],
  skills: [
    'Tidy up and reorder my skills',
    'Group my skills by type',
    'Put my most relevant skills first',
  ],
  default: [
    'Make my summary more concise',
    'Make my summary more professional',
    'Tidy up and reorder my skills',
  ],
}

interface AiToolsPanelProps {
  /** The id of the resume being edited (used for the server ownership check). */
  resumeId: string
  /** The current (unsaved) resume content — sent to the AI as context. */
  resume: Resume
  /** Called when the user applies a proposed change. */
  onApply: (proposal: { summary: string; skills: string[] }) => void
  /** The editor section currently open, so the suggestions can match it. */
  section?: string
}

/**
 * AiToolsPanel — the contextual AI assistant for the resume being edited.
 *
 * Deliberately not a navigation surface. Customize for a job, the resume
 * interview, the ATS checker and cover letters are application-level tools and
 * live in the global rail; repeating them here made the drawer a second menu
 * and buried the one thing it is for — asking the AI to rewrite what you are
 * looking at.
 */
export function AiToolsPanel({ resumeId, resume, onApply, section }: AiToolsPanelProps) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState<AiEditResult | null>(null)

  const canSubmit = instruction.trim().length > 0 && !loading
  const suggestions = SUGGESTIONS[section ?? ''] ?? SUGGESTIONS.default
  // Only two sections are ones the endpoint can rewrite directly.
  const sectionIsWritable = section === 'summary' || section === 'skills'

  const handleAsk = async () => {
    const trimmed = instruction.trim()
    if (!trimmed) {
      setError('Tell the AI what you want to change.')
      return
    }
    setLoading(true)
    setError('')
    try {
      setProposal(await aiApi.edit(resumeId, resume, trimmed))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Sorry, the AI could not process that. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!proposal || proposal.needsMoreInfo) return
    onApply({ summary: proposal.summary, skills: proposal.skills })
    setProposal(null)
    setInstruction('')
  }

  // Which fields actually changed, so the review only shows what's relevant.
  const summaryChanged = !!proposal && proposal.summary !== resume.summary
  const skillsChanged = !!proposal && proposal.skills.join('|') !== resume.skills.join('|')

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
        >
          <SparkleIcon width={17} height={17} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Improve this resume with AI</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            {sectionIsWritable
              ? 'Ask for a rewrite of the section you\'re editing, or describe any change in your own words.'
              : 'Ask AI rewrites your summary and skills. Describe what you want changed and review it before anything is applied.'}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="ai-instruction" className="sr-only">
          Tell AI what you want to change
        </label>
        <textarea
          id="ai-instruction"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleAsk()
          }}
          rows={3}
          placeholder="e.g. Make my summary more concise"
          disabled={loading}
          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
        />

        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          Suggestions
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInstruction(s)}
              disabled={loading}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <Button
          className="mt-4 w-full"
          onClick={handleAsk}
          disabled={!canSubmit}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <Spinner className="h-4 w-4 border-white/40 border-t-white" />
              Thinking…
            </>
          ) : (
            <>
              <SparkleIcon width={16} height={16} />
              Ask AI
            </>
          )}
        </Button>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-ink-subtle">
          Nothing changes until you review the suggestion and choose to apply it.
        </p>
      </div>

            {/* Review modal */}
      <Modal
        open={!!proposal}
        onClose={() => setProposal(null)}
        title={proposal?.needsMoreInfo ? 'AI needs a bit more from you' : 'Review AI suggestion'}
        className="max-w-lg"
        footer={
          proposal?.needsMoreInfo ? (
            <Button variant="secondary" onClick={() => setProposal(null)}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setProposal(null)}>
                Keep current
              </Button>
              <Button onClick={handleApply}>Use proposed</Button>
            </>
          )
        }
      >
        {proposal && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg bg-brand-50 px-3 py-2 text-brand-800">
              {proposal.summaryOfChanges}
            </div>

            {!proposal.needsMoreInfo && !summaryChanged && !skillsChanged && (
              <p className="text-ink-muted">
                The AI didn't find anything to change for that instruction.
              </p>
            )}

            {!proposal.needsMoreInfo && summaryChanged && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  Summary
                </h3>
                <div className="space-y-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-ink-muted">
                    <span className="mb-0.5 block text-[11px] font-medium uppercase text-ink-subtle">
                      Current
                    </span>
                    {resume.summary || <em className="text-ink-subtle">Empty</em>}
                  </div>
                  <div className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-ink">
                    <span className="mb-0.5 block text-[11px] font-medium uppercase text-brand-600">
                      Proposed
                    </span>
                    {proposal.summary}
                  </div>
                </div>
              </div>
            )}

            {!proposal.needsMoreInfo && skillsChanged && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  Skills
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {proposal.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
