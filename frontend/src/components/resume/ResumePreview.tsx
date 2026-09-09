import { cn } from '@/lib/cn'
import type { Resume, ResumeInput, TemplateVariant } from '@/types/resume'

/**
 * ResumePreview — renders a *structured* resume as a formatted document in one
 * of the supported templates. Purely presentational, so it works for both saved
 * resumes and in-progress edits. Empty sections are simply omitted.
 */
export function ResumePreview({
  resume,
  template,
  className,
}: {
  resume: Resume | ResumeInput
  template?: TemplateVariant
  className?: string
}) {
  const variant = template ?? resume.template ?? 'classic'
  const personal = resume.personalInfo
  const fullName = personal?.fullName || 'Your Name'
  // Grouped into the rows they occupy — how to reach them, then where to find
  // their work — so the header keeps the same shape as the downloaded PDF.
  const contactGroups = [
    [personal?.email, personal?.phone, personal?.location].filter(Boolean) as string[],
    [personal?.linkedin, personal?.website].filter(Boolean) as string[],
  ].filter((group) => group.length > 0)

  const isModern = variant === 'modern'
  const accentText = 'text-brand-700'

  return (
    <article
      className={cn(
        'mx-auto w-full max-w-[720px] bg-white p-8 text-ink shadow-sm ring-1 ring-slate-200 sm:p-10',
        variant === 'minimal' && 'font-sans',
        className,
      )}
    >
      {/* Header */}
      {isModern ? (
        <header className="-mx-8 -mt-8 mb-6 bg-brand-gradient px-8 py-6 text-white sm:-mx-10 sm:-mt-10 sm:px-10">
          <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
          {contactGroups.map((group, gi) => (
            <div
              key={gi}
              className={cn(
                'flex flex-wrap items-center justify-start gap-x-2 gap-y-0.5 text-sm text-white/85',
                gi === 0 ? 'mt-2.5' : 'mt-1',
              )}
            >
              {group.map((item, i) => (
                <span key={i} className="flex items-center gap-x-2">
                  {i > 0 && (
                    <span aria-hidden className="text-white/50">
                      |
                    </span>
                  )}
                  <span className="break-all">{item}</span>
                </span>
              ))}
            </div>
          ))}
        </header>
      ) : (
        <header
          className={cn(
            'mb-6 pb-5',
            variant === 'classic' ? 'border-b border-slate-300 text-center' : 'text-left',
          )}
        >
          <h1 className="text-2xl font-bold tracking-tight text-ink">{fullName}</h1>
          {variant === 'minimal' && <div className="mt-2 h-px w-10 bg-brand-400" />}
          {contactGroups.map((group, gi) => (
            <div
              key={gi}
              className={cn(
                'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-muted',
                gi === 0 ? 'mt-2.5' : 'mt-1',
                variant === 'classic' ? 'justify-center' : 'justify-start',
              )}
            >
              {group.map((item, i) => (
                <span key={i} className="flex items-center gap-x-2">
                  {i > 0 && (
                    <span aria-hidden className="text-slate-300">
                      |
                    </span>
                  )}
                  <span className="break-all">{item}</span>
                </span>
              ))}
            </div>
          ))}
        </header>
      )}

      <div className="space-y-6">
        {resume.summary && (
          <Section title="Summary" accent={accentText}>
            <p className="text-sm leading-relaxed text-ink-muted">{resume.summary}</p>
          </Section>
        )}

        {resume.experience && resume.experience.length > 0 && (
          <Section title="Experience" accent={accentText}>
            <div className="space-y-4">
              {resume.experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-semibold text-ink">
                      {exp.role || 'Role'}
                      {exp.company && <span className="text-ink-muted"> · {exp.company}</span>}
                    </p>
                    <p className="text-xs text-ink-subtle">
                      {[exp.startDate, exp.current ? 'Present' : exp.endDate]
                        .filter(Boolean)
                        .join(' – ')}
                    </p>
                  </div>
                  {exp.location && <p className="text-xs text-ink-subtle">{exp.location}</p>}
                  {exp.bullets?.length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-muted marker:text-brand-400">
                      {exp.bullets.filter(Boolean).map((b, bi) => (
                        <li key={bi}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {resume.education && resume.education.length > 0 && (
          <Section title="Education" accent={accentText}>
            <div className="space-y-3">
              {resume.education.map((edu, i) => (
                <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-semibold text-ink">
                    {edu.degree || 'Degree'}
                    {edu.field && <span className="font-normal text-ink-muted"> · {edu.field}</span>}
                    {edu.institution && (
                      <span className="block text-xs font-normal text-ink-subtle">
                        {edu.institution}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {resume.projects && resume.projects.length > 0 && (
          <Section title="Projects" accent={accentText}>
            <div className="space-y-3">
              {resume.projects.map((p, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-ink">{p.name || 'Project'}</p>
                  {p.description && (
                    <p className="text-sm leading-relaxed text-ink-muted">{p.description}</p>
                  )}
                  {p.technologies?.length > 0 && (
                    <p className="mt-1 text-xs text-ink-subtle">{p.technologies.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {resume.skills && resume.skills.length > 0 && (
          <Section title="Skills" accent={accentText}>
            <div className="flex flex-wrap gap-1.5">
              {resume.skills.map((skill, i) => (
                <span
                  key={i}
                  className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          </Section>
        )}

        {resume.certifications && resume.certifications.length > 0 && (
          <Section title="Certifications" accent={accentText}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted marker:text-brand-400">
              {resume.certifications.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </article>
  )
}

function Section({
  title,
  accent,
  children,
}: {
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2
        className={cn(
          'mb-2 text-xs font-bold uppercase tracking-wide',
          accent,
        )}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}
