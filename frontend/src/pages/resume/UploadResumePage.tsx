import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ToolPage } from '@/components/layout/ToolPage'
import { Spinner } from '@/components/ui/LoadingState'
import { resumesApi, ACCEPTED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'

/** The stages an import moves through, in order. */
type Stage = 'idle' | 'uploading' | 'reading' | 'creating'

const STAGE_LABEL: Record<Exclude<Stage, 'idle'>, string> = {
  uploading: 'Uploading your resume…',
  reading: 'Reading your resume…',
  creating: 'Creating your editable resume…',
}

const MAX_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))
const ACCEPT_ATTR = ACCEPTED_UPLOAD_EXTENSIONS.join(',')

/** Roughly how long extraction runs before AI parsing takes over. */
const READING_STAGE_MS = 5000

/** Human-readable file size. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Check a file before it leaves the browser, so obvious problems are caught
 * instantly. The server re-validates everything regardless.
 */
function validateFile(file: File): string | null {
  const name = file.name.toLowerCase()
  const accepted = ACCEPTED_UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext))
  if (!accepted) {
    if (name.endsWith('.doc')) {
      return "Older .doc files aren't supported. Please save your resume as a PDF or .docx and try again."
    }
    return 'Please choose a PDF or DOCX file. Other formats can\'t be read yet.'
  }
  if (file.size === 0) {
    return 'That file is empty. Please choose another one.'
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is too large (${formatSize(file.size)}). The maximum is ${MAX_MB} MB.`
  }
  return null
}

/**
 * UploadResumePage — turn an existing PDF/DOCX resume into an editable one.
 *
 * The file is sent to the server, which extracts its text, has the AI structure
 * it, and creates a real resume owned by the signed-in user. We then hand off
 * to the normal editor — there is no separate editor for imported resumes.
 */
export function UploadResumePage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)

  const busy = stage !== 'idle'

  // Once the file is on the server, walk the label from "reading" to "creating"
  // so a long AI step doesn't look like a stall.
  useEffect(() => {
    if (stage !== 'reading') return
    const timer = setTimeout(() => setStage('creating'), READING_STAGE_MS)
    return () => clearTimeout(timer)
  }, [stage])

  const choose = (next: File | null) => {
    if (!next) return
    const problem = validateFile(next)
    if (problem) {
      setFile(null)
      setError(problem)
      return
    }
    setFile(next)
    setError('')
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => choose(e.target.files?.[0] ?? null)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (busy) return
    choose(e.dataTransfer.files?.[0] ?? null)
  }

  const handleUpload = async () => {
    if (!file || busy) return
    setError('')
    setProgress(0)
    setStage('uploading')

    try {
      const { resume, imported } = await resumesApi.importFile(file, (percent) => {
        setProgress(percent)
        // The upload itself is done; the server is now reading the document.
        if (percent >= 100) setStage((current) => (current === 'uploading' ? 'reading' : current))
      })

      // Hand the import note to the editor so it can prompt a review.
      navigate(`/resume/${resume._id}`, { state: { imported } })
    } catch (err) {
      setStage('idle')
      setProgress(0)
      setError(
        getApiErrorMessage(err, "We couldn't import that resume. Please try again in a moment."),
      )
    }
  }

  return (
    <ToolPage
      back={{ to: '/resume/new', label: 'Back' }}
      title="Upload your existing resume"
      description="We'll turn your PDF or DOCX into an editable resume. Nothing is invented — anything we can't read is left for you to fill in."
    >

      {/* ── Drop zone ── */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={
          'mt-8 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ' +
          (dragging
            ? 'border-brand-400 bg-brand-50'
            : 'border-slate-300 bg-white hover:border-brand-300')
        }
      >
        <span aria-hidden className="text-2xl">
          ↥
        </span>
        <p className="mt-3 text-sm font-medium text-ink">
          Drag your resume here, or choose a file
        </p>
        <p className="mt-1 text-xs text-ink-subtle">PDF or DOCX · up to {MAX_MB} MB</p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={handleInputChange}
          disabled={busy}
          className="sr-only"
          id="resume-file"
        />
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          Choose file
        </Button>
      </div>

      {/* ── Selected file ── */}
      {file && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <span aria-hidden className="text-brand-600">
            ▤
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{file.name}</span>
            <span className="block text-xs text-ink-subtle">{formatSize(file.size)}</span>
          </span>
          {!busy && (
            <button
              type="button"
              onClick={() => {
                setFile(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:bg-slate-100 hover:text-ink"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* ── Progress ── */}
      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-xl border border-brand-200 bg-brand-gradient-soft px-4 py-4"
        >
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5" />
            <p className="text-sm font-medium text-ink">{STAGE_LABEL[stage]}</p>
          </div>
          {stage === 'uploading' && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-brand-gradient transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {stage !== 'uploading' && (
            <p className="mt-2 text-xs text-ink-muted">
              This usually takes a few seconds. Please keep this tab open.
            </p>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {/* Sets expectations before the AI runs. */}
      <div className="mt-6 rounded-xl border border-brand-100 bg-brand-gradient-soft px-4 py-3">
        <p className="text-xs leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">We only extract what's already there.</span> Nothing
          is invented, and your file is discarded after it is read. Check the result before you use it.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={handleUpload} disabled={!file || busy} aria-busy={busy}>
          {busy ? (
            <>
              <Spinner className="h-5 w-5 border-white/40 border-t-white" />
              Importing…
            </>
          ) : (
            'Import resume'
          )}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => navigate('/dashboard')}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </ToolPage>
  )
}
