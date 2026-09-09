import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { ResumeCardSkeleton } from '@/components/ui/Skeleton'
import { ResumeCard } from '@/components/resume/ResumeCard'
import { AtsScoreModal } from '@/components/resume/AtsScoreModal'
import { resumesApi } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import type { Resume } from '@/types/resume'

/**
 * DashboardPage — the list of the user's resumes.
 *
 * The global "New resume" action lives in the navbar, so this screen doesn't
 * repeat it; the only action here is the one the navbar can't offer — tailoring
 * a resume you already have. Rename and Duplicate reuse the existing CRUD
 * endpoints, so no new API surface was needed.
 */
export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [pendingDelete, setPendingDelete] = useState<Resume | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renaming, setRenaming] = useState<Resume | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState('')
  // The resume whose ATS report is open, if any.
  const [atsTarget, setAtsTarget] = useState<Resume | null>(null)

  useEffect(() => {
    let active = true
    resumesApi
      .list()
      .then((data) => active && setResumes(data))
      .catch((err) => active && setError(getApiErrorMessage(err, 'Could not load your resumes')))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  // Confirmations are transient so they never become permanent page furniture.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await resumesApi.remove(pendingDelete._id)
      setResumes((prev) => prev.filter((r) => r._id !== pendingDelete._id))
      setNotice(`"${pendingDelete.title}" was deleted.`)
      setPendingDelete(null)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete resume'))
    } finally {
      setDeleting(false)
    }
  }

  const startRename = (resume: Resume) => {
    setRenaming(resume)
    setRenameValue(resume.title)
  }

  const saveRename = async () => {
    if (!renaming) return
    const title = renameValue.trim()
    if (!title) return
    setSavingName(true)
    try {
      const updated = await resumesApi.update(renaming._id, { title })
      setResumes((prev) => prev.map((r) => (r._id === updated._id ? updated : r)))
      setRenaming(null)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not rename this resume'))
    } finally {
      setSavingName(false)
    }
  }

  const duplicate = async (resume: Resume) => {
    setDuplicatingId(resume._id)
    setError('')
    try {
      // Copy the content only — the server owns ids, timestamps and ownership.
      const copy = await resumesApi.create({
        title: `${resume.title} (copy)`,
        personalInfo: resume.personalInfo,
        summary: resume.summary,
        experience: resume.experience,
        education: resume.education,
        skills: resume.skills,
        projects: resume.projects,
        certifications: resume.certifications,
        template: resume.template,
      })
      setResumes((prev) => [copy, ...prev])
      setNotice(`"${resume.title}" was duplicated.`)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not duplicate this resume'))
    } finally {
      setDuplicatingId('')
    }
  }

  return (
    <Container className="py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Your resumes</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            {user ? `Welcome back, ${user.name.split(' ')[0]}. ` : ''}
            Continue editing an existing resume or create one tailored to your next opportunity.
          </p>
        </div>
        {resumes.length > 0 && (
          <Button variant="secondary" onClick={() => navigate('/customize')}>
            Tailor for a job
          </Button>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {/* Content */}
      <div className="mt-8">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <ResumeCardSkeleton key={i} />
            ))}
          </div>
        ) : resumes.length === 0 ? (
          <EmptyState
            title="No resumes yet"
            description="Create your first resume, or upload one you already have to make it editable."
            action={
              <Button size="lg" onClick={() => navigate('/resume/new')}>
                Create your first resume
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {resumes.map((resume) => (
              <div
                key={resume._id}
                className={duplicatingId === resume._id ? 'pointer-events-none opacity-60' : ''}
              >
                <ResumeCard
                  resume={resume}
                  onRename={startRename}
                  onDuplicate={duplicate}
                  onDelete={setPendingDelete}
                  onCheckAts={setAtsTarget}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ATS report — read-only, never edits the resume */}
      {atsTarget && (
        <AtsScoreModal
          open
          onClose={() => setAtsTarget(null)}
          resumeId={atsTarget._id}
          resumeTitle={atsTarget.title}
          onAnalyzed={(analysis) =>
            setResumes((prev) =>
              prev.map((r) => (r._id === atsTarget._id ? { ...r, atsAnalysis: analysis } : r)),
            )
          }
        />
      )}

      {/* Rename */}
      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename resume"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)} disabled={savingName}>
              Cancel
            </Button>
            <Button onClick={saveRename} disabled={savingName || !renameValue.trim()}>
              {savingName ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <Input
          label="Resume name"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void saveRename()
          }}
          autoFocus
          hint="Only you see this — it isn't printed on the resume."
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete this resume?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">{pendingDelete?.title}</span> will be permanently
          removed. This can't be undone.
        </p>
      </Modal>
    </Container>
  )
}
