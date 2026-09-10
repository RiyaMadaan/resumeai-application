import { useNavigate } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { TemplateThumbnail } from '@/templates/TemplateThumbnail'
import { getTemplate } from '@/templates/catalog'
import { getPreferredTemplate } from '@/lib/preferredTemplate'
import { ChatIcon, LayoutIcon, PencilIcon, UploadIcon } from '@/components/ui/icons'
import type { ReactNode } from 'react'

interface ChoiceProps {
  icon: ReactNode
  title: string
  description: string
  cta: string
  onSelect: () => void
}

/** One of the two ways to start a resume. */
function Choice({ icon, title, description, cta, onSelect }: ChoiceProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        {icon}
      </span>
      <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-muted">{description}</p>
      <span className="mt-5 text-sm font-semibold text-brand-700 group-hover:underline">
        {cta} →
      </span>
    </button>
  )
}

/**
 * CreateResumeChoicePage — step one of creating a resume.
 *
 * The routes are grouped by who does the writing: the manual builder, where
 * the user fills everything in themselves, and the AI routes, where content is
 * drafted for them. Every route produces the same resume record — the only
 * lasting difference is that a manual resume reopens in its own builder.
 */
export function CreateResumeChoicePage() {
  const navigate = useNavigate()
  // The template a resume created here will start in. Read once on render —
  // returning from the gallery remounts this page, so it stays current.
  const template = getTemplate(getPreferredTemplate())

  return (
    <Container className="max-w-4xl py-10 sm:py-14">
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-6 text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
      >
        ← Back to dashboard
      </button>

      <h1 className="text-2xl font-bold tracking-tight text-ink">
        How do you want to build your resume?
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Both routes produce an ordinary resume — you can switch templates, run an ATS check or
        tailor it to a job either way.
      </p>

      {/* The starting template. Changing it here is optional — every resume can
          switch template later from its editor. */}
      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-14 flex-shrink-0 overflow-hidden rounded-md ring-1 ring-slate-200">
            <TemplateThumbnail spec={template} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
              Starting template
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{template.name}</p>
            <p className="text-xs text-ink-muted">{template.category}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/templates')}>
          Browse templates
        </Button>
      </div>

      {/* Manual first: it is the one route where nothing is written for you,
          and the one that reopens in its own builder later. */}
      <section className="mt-8" aria-labelledby="manual-heading">
        <h2 id="manual-heading" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span aria-hidden>📝</span> Build manually
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Fill in each section yourself. Reopens in the same step-by-step builder whenever you come
          back to it.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Choice
            icon={<LayoutIcon width={20} height={20} />}
            title="Step-by-step builder"
            description="Nine short steps with your resume previewing live beside you the whole way."
            cta="Start building"
            onSelect={() => navigate('/resume/new/builder')}
          />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="ai-heading">
        <h2 id="ai-heading" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span aria-hidden>✨</span> Build with AI
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          AI structures and improves your content. You review everything before it is saved.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Choice
          icon={<PencilIcon width={20} height={20} />}
          title="Describe your career"
          description="Write about yourself in your own words and let AI structure it."
          cta="Continue"
          onSelect={() => navigate('/resume/new/scratch')}
        />
        <Choice
          icon={<ChatIcon width={20} height={20} />}
          title="Build with AI"
          description="Answer a few questions and we'll write it for you."
          cta="Start interview"
          onSelect={() => navigate('/resume/new/interview')}
        />
        <Choice
          icon={<UploadIcon width={20} height={20} />}
          title="Upload existing resume"
          description="Upload a PDF or DOCX and turn it into an editable resume."
          cta="Upload resume"
          onSelect={() => navigate('/resume/new/upload')}
        />
        </div>
      </section>
    </Container>
  )
}
