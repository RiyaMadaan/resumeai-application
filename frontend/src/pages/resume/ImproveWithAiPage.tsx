import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell, Panel } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { AiToolsPanel } from '@/components/resume/AiToolsPanel'
import { PanelHeader } from '@/components/layout/PageShell'
import { NoResumesYet, ResumeSelector } from '@/components/resume/ResumeSelector'
import { resumesApi } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'
import { useReturnTo } from '@/lib/returnTo'
import type { Resume } from '@/types/resume'

/**
 * ImproveWithAiPage — Ask AI, reached from the global rail.
 *
 * The rail's version of this tool has no resume in context, so the first thing
 * it asks is which one. Nothing is selected by default and the resume is only
 * fetched once the user picks it — opening the page makes one request, for the
 * list, and no AI request at all.
 *
 * The assistant itself is the same component the editor's drawer renders, so
 * there is one implementation of Ask AI and its review step.
 */
export function ImproveWithAiPage() {
  const navigate = useNavigate()
  const back = useReturnTo({ to: '/dashboard', label: 'Back to resumes' })

  const [resumes, setResumes] = useState<Resume[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [selected, setSelected] = useState<Resume | null>(null)
  const [loadingResume, setLoadingResume] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState('')

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

  /** Load the full resume only once one has actually been chosen. */
  useEffect(() => {
    if (!selectedId) {
      setSelected(null)
      return
    }
    let active = true
    setLoadingResume(true)
    setError('')
    resumesApi
      .get(selectedId)
      .then((data) => active && setSelected(data))
      .catch((err) => active && setError(getApiErrorMessage(err, 'Could not load that resume')))
      .finally(() => active && setLoadingResume(false))
    return () => {
      active = false
    }
  }, [selectedId])

  /** Apply an accepted suggestion and persist it, as the editor would. */
  const handleApply = async ({ summary, skills }: { summary: string; skills: string[] }) => {
    if (!selected) return
    setError('')
    try {
      const updated = await resumesApi.update(selected._id, { summary, skills })
      setSelected(updated)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save that change'))
    }
  }

  if (resumes === null && !error) return <LoadingState label="Loading your resumes…" fullscreen />

  return (
    <PageShell
      back={back}
      title="Improve with AI"
      description="Ask AI to rewrite your summary or tidy your skills. You review every suggestion before anything is applied."
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
        <div className="space-y-4">
          <Panel>
            <ResumeSelector
              resumes={resumes ?? []}
              value={selectedId}
              onChange={setSelectedId}
              hint="Choose which resume you want AI to work on."
            />
          </Panel>

          <Panel>
            {!selectedId ? (
              <p className="py-6 text-center text-sm text-ink-subtle">
                Select a resume to continue.
              </p>
            ) : loadingResume || !selected ? (
              <LoadingState label="Loading that resume…" />
            ) : (
              <>
                <PanelHeader
                  title="What would you like to improve?"
                  description="Pick one to fill it in, or describe the change yourself."
                />
                <AiToolsPanel
                  resumeId={selected._id}
                  resume={selected}
                  onApply={handleApply}
                  section="summary"
                />
                {savedAt && (
                  <p role="status" className="mt-3 text-xs text-emerald-700">
                    Applied and saved at {savedAt}.
                  </p>
                )}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/resume/${selected._id}`)}
                  >
                    Open in the editor
                  </Button>
                </div>
              </>
            )}
          </Panel>
        </div>
      )}
    </PageShell>
  )
}
