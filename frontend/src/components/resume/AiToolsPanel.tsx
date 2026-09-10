import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/LoadingState'
import { aiApi, type AiEditResult } from '@/api/ai.api'
import { getApiErrorMessage } from '@/api/client'
import type { Resume } from '@/types/resume'

/** Example instructions that show what "Ask AI" is for. */
const SUGGESTIONS = [
  'Make my summary more concise',
  'Make my summary more professional',
  'Tidy up and reorder my skills',
]

interface AiToolsPanelProps {
  /** The id of the resume being edited (used for the server ownership check). */
  resumeId: string
  /** The current (unsaved) resume content — sent to the AI as context. */
  resume: Resume
  /** Called when the user applies a proposed change. */
  onApply: (proposal: { summary: string; skills: string[] }) => void
  /** Open the tailor-for-a-job flow. */
  onTailor: () => void
  /** Open the AI interview for this resume. */
  onInterview: () => void
  /** Open the cover letter flow for this resume. */
  onCoverLetter: () => void
  /** True when this resume already has an interview behind it. */
  hasInterview: boolean
}

/**
 * AiToolsPanel — the editor's two AI actions, side by side so the difference
 * between them is obvious.
 *
 *   Ask AI       — rewrites content you already have.
 *   Tailor       — reads a job description and optimises the resume for it.
 *
 * They used to sit in two separate purple cards that read as the same feature
 * twice. Now they share one quiet container, and purple is spent only on the
 * actions themselves.
 */
export function AiToolsPanel({
  resumeId,
  resume,
  onApply,
  onTailor,
  onInterview,
  onCoverLetter,
  hasInterview,
}: AiToolsPanelProps) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState<AiEditResult | null>(null)
  const [asking, setAsking] = useState(false)

  const canSubmit = instruction.trim().length > 0 && !loading

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
    setAsking(false)
  }

  // Which fields actually changed, so the review only shows what's relevant.
  const summaryChanged = !!proposal && proposal.summary !== resume.summary
  const skillsChanged = !!proposal && proposal.skills.join('|') !== resume.skills.join('|')

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="text-brand-500" aria-hidden>
          ✦
        </span>
        <h2 className="text-sm font-semibold text-ink">AI tools</h2>
      </div>

      <div className="divide-y divide-slate-100">
        {/* ── Improve existing content ── */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-ink">Improve your resume</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            Improve wording, shorten sections, or strengthen your summary.
          </p>

          {asking ? (
            <div className="mt-3">
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
                rows={2}
                autoFocus
                placeholder="e.g. Make my summary more concise"
                disabled={loading}
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
              />

              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInstruction(s)}
                    disabled={loading}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={handleAsk} disabled={!canSubmit} aria-busy={loading}>
                  {loading ? (
                    <>
                      <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                      Thinking…
                    </>
                  ) : (
                    'Ask AI'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAsking(false)
                    setError('')
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" className="mt-3" onClick={() => setAsking(true)}>
              Ask AI
            </Button>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        {/* ── Tailor to a job description ── */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-ink">Tailor for a job</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            Customize this resume for a specific job description.
          </p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={onTailor}>
            Tailor resume
          </Button>
        </div>

        {/* ── Cover letter ── */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-ink">Cover letter</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            Write a letter for a specific job, using only what's on this resume.
          </p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={onCoverLetter}>
            Write cover letter
          </Button>
        </div>

        {/* ── Conversational interview ── */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-ink">
            {hasInterview ? "AI Resume Interview" : "Build with AI"}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            Have a conversation with AI to add missing resume details.
          </p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={onInterview}>
            {hasInterview ? "Continue interview" : "Start interview"}
          </Button>
        </div>
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
