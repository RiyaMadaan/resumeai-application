import { useNavigate } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
import { TemplateThumbnail } from '@/templates/TemplateThumbnail'
import { getTemplate } from '@/templates/catalog'
import { getPreferredTemplate } from '@/lib/preferredTemplate'
import { ChatIcon, LayoutIcon, PencilIcon, SparkleIcon, UploadIcon } from '@/components/ui/icons'

/**
 * One creation route.
 *
 * Deliberately a plain row: an icon, a title, a line, and an arrow. These are
 * choices to make once, not dashboard widgets, so nothing here needs a shadow
 * or a call-to-action of its own — the whole card is the action.
 */
function Choice({
  Icon,
  title,
  description,
  onSelect,
  tone = 'default',
}: {
  Icon: (props: { width?: number; height?: number }) => React.ReactElement
  title: string
  description: string
  onSelect: () => void
  /** `accent` for the routes inside the recommended panel. */
  tone?: 'default' | 'accent'
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        'group flex w-full items-center gap-3.5 rounded-lg border px-4 py-3.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ' +
        (tone === 'accent'
          ? 'border-brand-200 bg-white hover:border-brand-400'
          : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30')
      }
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon width={17} height={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs leading-relaxed text-ink-muted">{description}</span>
      </span>
      <span
        aria-hidden
        className="flex-shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700"
      >
        →
      </span>
    </button>
  )
}

/**
 * CreateResumeChoicePage — step one of creating a resume.
 *
 * Composed around the question actually being asked: how should this resume
 * get written? The AI routes lead because they are the least work, and the two
 * of them sit together in one panel rather than competing as separate cards —
 * they differ only in how you supply the same information. Manual and upload
 * follow as the alternatives.
 *
 * Every route here already existed and produces the same resume record; the
 * only lasting difference is that a manual resume reopens in its own builder.
 */
export function CreateResumeChoicePage() {
  const navigate = useNavigate()
  // The template a resume created here will start in. Read once on render —
  // returning from the gallery remounts this page, so it stays current.
  const template = getTemplate(getPreferredTemplate())

  return (
    <PageShell
      back={{ to: '/dashboard', label: 'Back to resumes' }}
      title="Create your resume"
      description="Choose how you'd like to get started."
    >
      <div className="space-y-6">
        {/* Starting template — one compact row. Optional, and changeable later
            from any resume's editor, so it shouldn't compete with the choice
            below it. */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3">
          <div className="w-11 flex-shrink-0 overflow-hidden rounded ring-1 ring-slate-200">
            <TemplateThumbnail spec={template} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              Starting template
            </p>
            <p className="truncate text-sm font-medium text-ink">
              {template.name}
              <span className="text-ink-subtle"> · {template.category}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/templates')}
            className="flex-shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Change
          </button>
        </div>

        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-base font-semibold tracking-tight text-ink">
            How would you like to build your resume?
          </h2>

          {/* AI leads: the two AI routes differ only in how you supply the same
              information, so they belong in one panel rather than as two cards
              that look unrelated. */}
          <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white"
              >
                <SparkleIcon width={17} height={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">Build with AI</h3>
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Recommended
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Let ResumeAI do the heavy lifting. You review everything before it's saved.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Choice
                Icon={PencilIcon}
                title="Describe your career"
                description="Write about yourself in your own words."
                onSelect={() => navigate('/resume/new/scratch')}
                tone="accent"
              />
              <Choice
                Icon={ChatIcon}
                title="AI interview"
                description="Answer a few questions and we'll write it."
                onSelect={() => navigate('/resume/new/interview')}
                tone="accent"
              />
            </div>
          </div>

          {/* The alternatives, at their own weight. */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Choice
              Icon={LayoutIcon}
              title="Build manually"
              description="Nine short steps, with a live preview beside you."
              onSelect={() => navigate('/resume/new/builder')}
            />
            <Choice
              Icon={UploadIcon}
              title="Upload a resume"
              description="Import a PDF or DOCX and make it editable."
              onSelect={() => navigate('/resume/new/upload')}
            />
          </div>
        </section>
      </div>
    </PageShell>
  )
}
