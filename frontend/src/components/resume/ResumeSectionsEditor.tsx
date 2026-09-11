import type { ReactNode } from 'react'
import { Input, Textarea } from '@/components/ui/Input'
import { Collapsible } from '@/components/ui/Collapsible'
import type { Education, Experience, PersonalInfo, Project } from '@/types/resume'

/**
 * The resume sections this editor manages. Summary, skills, title and template
 * stay with the editor page, since the AI features write to those directly.
 */
export interface ResumeSections {
  personalInfo: PersonalInfo
  experience: Experience[]
  education: Education[]
  projects: Project[]
  certifications: string[]
}

/** The sections this editor can render, addressable individually. */
export type ResumeSectionId =
  | 'personal'
  | 'experience'
  | 'projects'
  | 'education'
  | 'certifications'

interface ResumeSectionsEditorProps {
  value: ResumeSections
  /** Patch one or more sections. Local state only — the page owns saving. */
  onChange: (patch: Partial<ResumeSections>) => void
  /**
   * Render only these sections, in the editor's own order. Defaults to all of
   * them, which is what the resume editor wants; the step-by-step builder
   * passes one at a time so both flows share exactly these form controls.
   */
  only?: ResumeSectionId[]
  /** Expand sections on mount — the builder shows one section per step. */
  alwaysOpen?: boolean
  /**
   * Render the fields without the surrounding collapsible card. Use when the
   * parent already provides the section's heading.
   */
  flat?: boolean
}

const emptyExperience: Experience = {
  company: '',
  role: '',
  location: '',
  startDate: '',
  endDate: '',
  current: false,
  bullets: [],
}

const emptyEducation: Education = {
  institution: '',
  degree: '',
  field: '',
  startDate: '',
  endDate: '',
}

const emptyProject: Project = { name: '', description: '', technologies: [], link: '' }

/** Replace one item in a list without mutating it. */
function replaceAt<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item))
}

/** "3 positions" / "1 position" / "None added yet". */
function countLabel(n: number, singular: string, plural: string): string {
  if (n === 0) return 'None added yet'
  return `${n} ${n === 1 ? singular : plural}`
}

/** The dates line shown on a collapsed experience row. */
function dateRange(startDate: string, endDate: string, current?: boolean): string {
  return [startDate, current ? 'Present' : endDate].filter(Boolean).join(' – ')
}

/** Two fields side by side on wider screens. */
function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>
}

/** The "+ Add …" control at the foot of a repeatable list. */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      + {label}
    </button>
  )
}

/** The remove control inside an expanded entry. */
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-xs font-medium text-ink-subtle transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {label}
    </button>
  )
}

/**
 * ResumeSectionsEditor — manual editing for the structured resume sections.
 *
 * Every field the schema supports is editable, so an imported resume can be
 * corrected exactly like one written from scratch. Sections and individual
 * entries collapse to a one-line summary, which is what keeps a resume with
 * five jobs and four projects navigable. Changes are local: they flow up to the
 * editor page, which owns the live preview and Save.
 */
/**
 * The wrapper around one section.
 *
 * In the full list (the creation wizard's sections, or anywhere showing
 * several at once) a section is a collapsible card. When the parent already
 * renders its own title and description — the editor shows exactly one section
 * at a time — `flat` drops the card entirely, so the fields aren't sitting
 * inside a box inside a box under a duplicated heading.
 */
function SectionShell({
  flat,
  title,
  summary,
  defaultOpen,
  children,
}: {
  flat?: boolean
  title: string
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  if (flat) return <>{children}</>
  return (
    <Collapsible title={title} summary={summary} defaultOpen={defaultOpen}>
      {children}
    </Collapsible>
  )
}

export function ResumeSectionsEditor({
  value,
  onChange,
  only,
  alwaysOpen,
  flat,
}: ResumeSectionsEditorProps) {
  const { personalInfo, experience, education, projects, certifications } = value

  /** Whether a given section should render at all. */
  const show = (section: ResumeSectionId) => !only || only.includes(section)

  const setPersonal = (patch: Partial<PersonalInfo>) =>
    onChange({ personalInfo: { ...personalInfo, ...patch } })

  const filledContactCount = [
    personalInfo.fullName,
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
    personalInfo.linkedin,
    personalInfo.website,
  ].filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* ── Personal info ── */}
      {show('personal') && (
      <SectionShell
        flat={flat}
        title="Personal details"
        summary={personalInfo.fullName || `${filledContactCount} of 6 fields filled`}
        defaultOpen={alwaysOpen || !personalInfo.fullName}
      >
        <div className="space-y-3">
          <Input
            label="Full name"
            value={personalInfo.fullName}
            onChange={(e) => setPersonal({ fullName: e.target.value })}
            placeholder="Jordan Blake"
          />
          <FieldRow>
            <Input
              label="Email"
              type="email"
              value={personalInfo.email}
              onChange={(e) => setPersonal({ email: e.target.value })}
              placeholder="jordan@example.com"
            />
            <Input
              label="Phone"
              value={personalInfo.phone}
              onChange={(e) => setPersonal({ phone: e.target.value })}
              placeholder="+1 555 0100"
            />
          </FieldRow>
          <FieldRow>
            <Input
              label="Location"
              value={personalInfo.location}
              onChange={(e) => setPersonal({ location: e.target.value })}
              placeholder="Berlin, Germany"
            />
            <Input
              label="LinkedIn"
              value={personalInfo.linkedin}
              onChange={(e) => setPersonal({ linkedin: e.target.value })}
              placeholder="linkedin.com/in/jordanblake"
            />
          </FieldRow>
          <Input
            label="Website or portfolio"
            value={personalInfo.website}
            onChange={(e) => setPersonal({ website: e.target.value })}
            placeholder="jordanblake.dev"
          />
        </div>
      </SectionShell>
      )}

      {/* ── Experience ── */}
      {show('experience') && (
      <SectionShell
        flat={flat}
        title="Experience"
        summary={countLabel(experience.length, 'position', 'positions')}
        defaultOpen={alwaysOpen}
      >
        <div className="space-y-3">
          {experience.map((entry, index) => (
            <Collapsible
              key={index}
              variant="row"
              className="bg-slate-50/60"
              title={entry.role || 'Untitled role'}
              summary={
                [entry.company, dateRange(entry.startDate, entry.endDate, entry.current)]
                  .filter(Boolean)
                  .join(' · ') || 'No company or dates yet'
              }
            >
              <div className="space-y-3">
                <FieldRow>
                  <Input
                    label="Job title"
                    value={entry.role}
                    onChange={(e) =>
                      onChange({
                        experience: replaceAt(experience, index, { role: e.target.value }),
                      })
                    }
                  />
                  <Input
                    label="Company"
                    value={entry.company}
                    onChange={(e) =>
                      onChange({
                        experience: replaceAt(experience, index, { company: e.target.value }),
                      })
                    }
                  />
                </FieldRow>
                <FieldRow>
                  <Input
                    label="Start date"
                    value={entry.startDate}
                    onChange={(e) =>
                      onChange({
                        experience: replaceAt(experience, index, { startDate: e.target.value }),
                      })
                    }
                    placeholder="Jan 2023"
                  />
                  <Input
                    label="End date"
                    value={entry.endDate}
                    onChange={(e) =>
                      onChange({
                        experience: replaceAt(experience, index, { endDate: e.target.value }),
                      })
                    }
                    placeholder="Present"
                    disabled={entry.current}
                  />
                </FieldRow>
                <Input
                  label="Location"
                  value={entry.location}
                  onChange={(e) =>
                    onChange({
                      experience: replaceAt(experience, index, { location: e.target.value }),
                    })
                  }
                  placeholder="Remote"
                />
                <label className="flex items-center gap-2 text-sm text-ink-muted">
                  <input
                    type="checkbox"
                    checked={entry.current}
                    onChange={(e) =>
                      onChange({
                        experience: replaceAt(experience, index, {
                          current: e.target.checked,
                          // "Present" is rendered from the flag, so clear a stale end date.
                          endDate: e.target.checked ? '' : entry.endDate,
                        }),
                      })
                    }
                    className="h-4 w-4 accent-brand-600"
                  />
                  I currently work here
                </label>
                <Textarea
                  label="What you did"
                  value={entry.bullets.join('\n')}
                  onChange={(e) =>
                    onChange({
                      experience: replaceAt(experience, index, {
                        bullets: e.target.value.split('\n'),
                      }),
                    })
                  }
                  rows={4}
                  hint="One bullet point per line."
                />
                <div className="flex justify-end">
                  <RemoveButton
                    label="Remove position"
                    onClick={() =>
                      onChange({ experience: experience.filter((_, i) => i !== index) })
                    }
                  />
                </div>
              </div>
            </Collapsible>
          ))}
          <AddButton
            label="Add experience"
            onClick={() => onChange({ experience: [...experience, { ...emptyExperience }] })}
          />
        </div>
      </SectionShell>
      )}

      {/* ── Projects ── */}
      {show('projects') && (
      <SectionShell
        flat={flat}
        title="Projects"
        summary={countLabel(projects.length, 'project', 'projects')}
        defaultOpen={alwaysOpen}
      >
        <div className="space-y-3">
          {projects.map((entry, index) => (
            <Collapsible
              key={index}
              variant="row"
              className="bg-slate-50/60"
              title={entry.name || 'Untitled project'}
              summary={
                entry.technologies.length > 0
                  ? entry.technologies.join(', ')
                  : entry.description || 'No description yet'
              }
            >
              <div className="space-y-3">
                <Input
                  label="Project name"
                  value={entry.name}
                  onChange={(e) =>
                    onChange({ projects: replaceAt(projects, index, { name: e.target.value }) })
                  }
                />
                <Textarea
                  label="Description"
                  value={entry.description}
                  onChange={(e) =>
                    onChange({
                      projects: replaceAt(projects, index, { description: e.target.value }),
                    })
                  }
                  rows={3}
                />
                <Input
                  label="Technologies"
                  value={entry.technologies.join(', ')}
                  onChange={(e) =>
                    onChange({
                      projects: replaceAt(projects, index, {
                        technologies: e.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean),
                      }),
                    })
                  }
                  hint="Separate with commas."
                />
                <Input
                  label="Link"
                  value={entry.link}
                  onChange={(e) =>
                    onChange({ projects: replaceAt(projects, index, { link: e.target.value }) })
                  }
                  placeholder="github.com/you/project"
                />
                <div className="flex justify-end">
                  <RemoveButton
                    label="Remove project"
                    onClick={() => onChange({ projects: projects.filter((_, i) => i !== index) })}
                  />
                </div>
              </div>
            </Collapsible>
          ))}
          <AddButton
            label="Add project"
            onClick={() => onChange({ projects: [...projects, { ...emptyProject }] })}
          />
        </div>
      </SectionShell>
      )}

      {/* ── Education ── */}
      {show('education') && (
      <SectionShell
        flat={flat}
        title="Education"
        summary={countLabel(education.length, 'entry', 'entries')}
        defaultOpen={alwaysOpen}
      >
        <div className="space-y-3">
          {education.map((entry, index) => (
            <Collapsible
              key={index}
              variant="row"
              className="bg-slate-50/60"
              title={entry.degree || entry.institution || 'Untitled qualification'}
              summary={
                [entry.institution, dateRange(entry.startDate, entry.endDate)]
                  .filter(Boolean)
                  .join(' · ') || 'No institution or dates yet'
              }
            >
              <div className="space-y-3">
                <Input
                  label="Institution"
                  value={entry.institution}
                  onChange={(e) =>
                    onChange({
                      education: replaceAt(education, index, { institution: e.target.value }),
                    })
                  }
                />
                <FieldRow>
                  <Input
                    label="Degree"
                    value={entry.degree}
                    onChange={(e) =>
                      onChange({
                        education: replaceAt(education, index, { degree: e.target.value }),
                      })
                    }
                    placeholder="B.Sc."
                  />
                  <Input
                    label="Field of study"
                    value={entry.field}
                    onChange={(e) =>
                      onChange({ education: replaceAt(education, index, { field: e.target.value }) })
                    }
                    placeholder="Computer Science"
                  />
                </FieldRow>
                <FieldRow>
                  <Input
                    label="Start date"
                    value={entry.startDate}
                    onChange={(e) =>
                      onChange({
                        education: replaceAt(education, index, { startDate: e.target.value }),
                      })
                    }
                    placeholder="2019"
                  />
                  <Input
                    label="End date"
                    value={entry.endDate}
                    onChange={(e) =>
                      onChange({
                        education: replaceAt(education, index, { endDate: e.target.value }),
                      })
                    }
                    placeholder="2023"
                  />
                </FieldRow>
                <div className="flex justify-end">
                  <RemoveButton
                    label="Remove entry"
                    onClick={() => onChange({ education: education.filter((_, i) => i !== index) })}
                  />
                </div>
              </div>
            </Collapsible>
          ))}
          <AddButton
            label="Add education"
            onClick={() => onChange({ education: [...education, { ...emptyEducation }] })}
          />
        </div>
      </SectionShell>
      )}

      {/* ── Certifications ── */}
      {show('certifications') && (
      <SectionShell
        flat={flat}
        title="Certifications"
        summary={countLabel(certifications.filter(Boolean).length, 'certification', 'certifications')}
        defaultOpen={alwaysOpen}
      >
        <Textarea
          label="Certifications"
          value={certifications.join('\n')}
          onChange={(e) => onChange({ certifications: e.target.value.split('\n') })}
          rows={3}
          hint="One per line."
          placeholder={'AWS Certified Cloud Practitioner\nGoogle UX Design Certificate'}
        />
      </SectionShell>
      )}
    </div>
  )
}
