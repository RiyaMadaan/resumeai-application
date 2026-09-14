import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell, Panel } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { AtsScoreModal } from '@/components/resume/AtsScoreModal'
import { NoResumesYet, ResumeSelector } from '@/components/resume/ResumeSelector'
import { resumesApi } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'
import { useReturnTo } from '@/lib/returnTo'
import type { Resume } from '@/types/resume'

/**
 * AtsCheckerPage — the ATS report, reached from the global rail.
 *
 * Loading this page makes exactly one request: the resume list. The analysis
 * runs only when the user presses Check ATS, which opens the shared report
 * modal — the same one the editor uses, including its in-flight guard, so a
 * deliberate click is one request and an impatient double-click is still one.
 */
export function AtsCheckerPage() {
  const navigate = useNavigate()
  const back = useReturnTo({ to: '/dashboard', label: 'Back to resumes' })

  const [resumes, setResumes] = useState<Resume[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [error, setError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    let active = true
    resumesApi
      .list()
      .then((list) => active && setResumes(list))
      .catch((err) => active && setError(getApiErrorMessage(err, 'Could not load your resumes')))
    return () => {
      active = false
    }
  }, [])

  const selected = (resumes ?? []).find((r) => r._id === selectedId) ?? null

  if (resumes === null && !error) return <LoadingState label="Loading your resumes…" fullscreen />

  return (
    <PageShell
      back={back}
      title="ATS checker"
      description="See how well a resume reads to the automated systems most employers screen with."
    >
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {resumes && resumes.length === 0 ? (
        <NoResumesYet
          action={<Button onClick={() => navigate('/resume/new')}>Create a resume</Button>}
        />
      ) : (
        <Panel>
          <ResumeSelector
            resumes={resumes ?? []}
            value={selectedId}
            onChange={setSelectedId}
            hint="Choose which resume to check."
          />

          {selected?.atsAnalysis && (
            <p className="mt-3 text-xs text-ink-muted">
              Last checked:{' '}
              <span className="font-semibold text-ink">{selected.atsAnalysis.score}</span> / 100 ·{' '}
              {selected.atsAnalysis.grade}
            </p>
          )}

          {/* Optional. With a posting the score is targeted at that role;
              without one it measures general ATS readiness. */}
          <div className="mt-5">
            <Textarea
              label="Job description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={6}
              placeholder="Paste the job description here…"
              hint="Optional — add one to score against a specific role instead of general ATS readiness."
              disabled={!selectedId}
            />
          </div>

          <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
            <Button onClick={() => setReportOpen(true)} disabled={!selectedId || reportOpen}>
              {reportOpen ? 'Checking…' : 'Check ATS'}
            </Button>
            {!selectedId && (
              <span className="text-sm text-ink-subtle">Select a resume to continue.</span>
            )}
          </div>
        </Panel>
      )}

      {/* The analysis starts when this opens, and not before. */}
      {selected && (
        <AtsScoreModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          resumeId={selected._id}
          resumeTitle={selected.title}
          resume={selected}
          jobDescription={jobDescription}
          onAnalyzed={(result) =>
            setResumes((current) =>
              (current ?? []).map((r) =>
                r._id === selected._id ? { ...r, atsAnalysis: result } : r,
              ),
            )
          }
        />
      )}
    </PageShell>
  )
}
