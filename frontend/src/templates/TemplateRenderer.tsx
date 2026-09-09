import type { CSSProperties, ReactNode } from 'react'
import type { Resume, ResumeInput } from '@/types/resume'
import {
  DENSITY_SCALE,
  FONT_STACKS,
  type SectionKey,
  type TemplateSpec,
} from './types'

/**
 * TemplateRenderer — the one component that draws a resume.
 *
 * It takes resume data plus a `TemplateSpec` and interprets the spec's layout,
 * typography and colour choices. Every template in the catalog goes through
 * here, which is why the gallery thumbnail, the editor preview and the full
 * preview can never disagree about what a template looks like.
 *
 * The page is rendered at a fixed width (`PAGE_WIDTH`) so the design is
 * resolution-independent; callers scale it to fit with `ScaledResume` below.
 * Colours come from the spec as plain hex, so they are applied as inline styles
 * rather than Tailwind classes, which cannot be generated dynamically.
 */

/** A4 at 96dpi. The design is authored at this width and scaled by callers. */
export const PAGE_WIDTH = 794
/** A4 height at 96dpi — used only to give an empty page a sensible aspect. */
export const PAGE_HEIGHT = 1123

type AnyResume = Resume | ResumeInput

/** Contact details, grouped into the rows they occupy in the header. */
function contactRows(resume: AnyResume): string[][] {
  const p = resume.personalInfo
  return [
    [p?.email, p?.phone, p?.location].filter(Boolean) as string[],
    [p?.linkedin, p?.website].filter(Boolean) as string[],
  ].filter((row) => row.length > 0)
}

/** True when a section has anything worth drawing. */
function hasContent(resume: AnyResume, key: SectionKey): boolean {
  switch (key) {
    case 'summary':
      return !!resume.summary?.trim()
    case 'experience':
      return (resume.experience?.length ?? 0) > 0
    case 'education':
      return (resume.education?.length ?? 0) > 0
    case 'skills':
      return (resume.skills?.length ?? 0) > 0
    case 'projects':
      return (resume.projects?.length ?? 0) > 0
    case 'certifications':
      return (resume.certifications?.length ?? 0) > 0
  }
}

const SECTION_LABELS: Record<SectionKey, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
}

/** Stable bar widths for the `bars` skill style — deterministic, not random. */
const BAR_WIDTHS = [92, 86, 90, 78, 84, 72, 88, 76]

export function TemplateRenderer({
  resume,
  spec,
  className,
  style,
}: {
  resume: AnyResume
  spec: TemplateSpec
  className?: string
  style?: CSSProperties
}) {
  const { layout, type, colors } = spec
  const unit = DENSITY_SCALE[layout.density]
  const pad = Math.round(44 * (layout.density === 'compact' ? 0.85 : layout.density === 'roomy' ? 1.12 : 1))
  const gap = Math.round(18 * unit)

  const bodyFont = FONT_STACKS[type.font]
  const headingFont = FONT_STACKS[type.headingFont ?? type.font]

  const isSidebar = layout.columns !== 'single'
  const sidebarKeys = isSidebar ? layout.sidebar.filter((k) => hasContent(resume, k)) : []
  const mainKeys = layout.order.filter(
    (k) => hasContent(resume, k) && !sidebarKeys.includes(k),
  )

  /** One section heading, drawn in the template's chosen style. */
  const heading = (label: string, index: number, inSidebar = false) => {
    const size = inSidebar ? type.titleSize - 1 : type.titleSize
    const common: CSSProperties = {
      fontFamily: headingFont,
      fontSize: size,
      fontWeight: 700,
      color: colors.accent,
      margin: 0,
    }
    const caps: CSSProperties = { textTransform: 'uppercase', letterSpacing: '0.09em' }

    switch (layout.sectionTitle) {
      case 'underline':
        return (
          <h2
            style={{
              ...common,
              ...caps,
              borderBottom: `1.5px solid ${colors.accent}`,
              paddingBottom: 3,
              marginBottom: Math.round(7 * unit),
            }}
          >
            {label}
          </h2>
        )
      case 'bar':
        return (
          <h2
            style={{
              ...common,
              ...caps,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginBottom: Math.round(7 * unit),
            }}
          >
            <span
              aria-hidden
              style={{ width: 14, height: 3, background: colors.accent, borderRadius: 2 }}
            />
            {label}
          </h2>
        )
      case 'boxed':
        return (
          <h2
            style={{
              ...common,
              ...caps,
              display: 'inline-block',
              background: colors.accentSoft,
              padding: '3px 8px',
              borderRadius: 4,
              marginBottom: Math.round(7 * unit),
            }}
          >
            {label}
          </h2>
        )
      case 'side-rule':
        return (
          <h2
            style={{
              ...common,
              ...caps,
              borderLeft: `3px solid ${colors.accent}`,
              paddingLeft: 8,
              marginBottom: Math.round(7 * unit),
            }}
          >
            {label}
          </h2>
        )
      case 'caps-wide':
        return (
          <h2
            style={{
              ...common,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              marginBottom: Math.round(7 * unit),
            }}
          >
            {label}
          </h2>
        )
      case 'numbered':
        return (
          <h2
            style={{ ...common, ...caps, marginBottom: Math.round(7 * unit) }}
          >
            <span style={{ opacity: 0.55 }}>{String(index + 1).padStart(2, '0')}. </span>
            {label}
          </h2>
        )
      case 'dot':
        return (
          <h2
            style={{
              ...common,
              ...caps,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginBottom: Math.round(7 * unit),
            }}
          >
            <span
              aria-hidden
              style={{ width: 6, height: 6, borderRadius: 999, background: colors.accent }}
            />
            {label}
          </h2>
        )
      case 'plain':
      default:
        return (
          <h2 style={{ ...common, ...caps, marginBottom: Math.round(7 * unit) }}>{label}</h2>
        )
    }
  }

  /* ── Header ─────────────────────────────────────────────────────────────── */
  const fullName = resume.personalInfo?.fullName || 'Your Name'
  const rows = contactRows(resume)
  const onColour = layout.header === 'banner'

  const nameStyle: CSSProperties = {
    fontFamily: headingFont,
    fontSize: type.nameSize,
    fontWeight: 700,
    letterSpacing: `${type.nameTracking}em`,
    textTransform: type.nameCaps ? 'uppercase' : 'none',
    color: onColour ? colors.onSurface : colors.text,
    margin: 0,
    lineHeight: 1.15,
  }

  const contacts = (
    <div style={{ marginTop: 8 }}>
      {rows.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '2px 8px',
            justifyContent:
              layout.header === 'centered' || layout.header === 'caps' ? 'center' : 'flex-start',
            fontSize: type.bodySize - 1.5,
            color: onColour ? colors.onSurface : colors.muted,
            opacity: onColour ? 0.9 : 1,
            marginTop: ri === 0 ? 0 : 2,
          }}
        >
          {row.map((item, i) => (
            <span key={i} style={{ display: 'flex', gap: 8 }}>
              {i > 0 && <span aria-hidden style={{ opacity: 0.45 }}>|</span>}
              <span style={{ wordBreak: 'break-word' }}>{item}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )

  let header: ReactNode
  switch (layout.header) {
    case 'banner':
      header = (
        <div
          style={{
            background: colors.surface,
            color: colors.onSurface,
            margin: `${-pad}px ${-pad}px ${gap}px`,
            padding: `${Math.round(26 * unit)}px ${pad}px`,
          }}
        >
          <h1 style={nameStyle}>{fullName}</h1>
          {contacts}
        </div>
      )
      break
    case 'tinted':
      header = (
        <div
          style={{
            background: colors.accentSoft,
            borderLeft: `4px solid ${colors.accent}`,
            margin: `${-Math.round(pad / 2)}px ${-Math.round(pad / 2)}px ${gap}px`,
            padding: `${Math.round(18 * unit)}px ${Math.round(pad / 2)}px`,
          }}
        >
          <h1 style={nameStyle}>{fullName}</h1>
          {contacts}
        </div>
      )
      break
    case 'boxed':
      header = (
        <div
          style={{
            border: `1.5px solid ${colors.accent}`,
            padding: `${Math.round(16 * unit)}px 18px`,
            marginBottom: gap,
            textAlign: 'center',
          }}
        >
          <h1 style={{ ...nameStyle, textAlign: 'center' }}>{fullName}</h1>
          <div style={{ display: 'flex', justifyContent: 'center' }}>{contacts}</div>
        </div>
      )
      break
    case 'centered':
      header = (
        <div
          style={{
            textAlign: 'center',
            borderBottom: `1px solid ${colors.accent}33`,
            paddingBottom: Math.round(14 * unit),
            marginBottom: gap,
          }}
        >
          <h1 style={nameStyle}>{fullName}</h1>
          {contacts}
        </div>
      )
      break
    case 'split':
      header = (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 16,
            borderBottom: `1px solid ${colors.accent}33`,
            paddingBottom: Math.round(12 * unit),
            marginBottom: gap,
          }}
        >
          <h1 style={{ ...nameStyle, flexShrink: 0 }}>{fullName}</h1>
          <div style={{ textAlign: 'right' }}>
            {rows.map((row, ri) => (
              <div
                key={ri}
                style={{
                  fontSize: type.bodySize - 1.5,
                  color: colors.muted,
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}
              >
                {row.join('  ·  ')}
              </div>
            ))}
          </div>
        </div>
      )
      break
    case 'underline':
      header = (
        <div style={{ marginBottom: gap }}>
          <h1 style={nameStyle}>{fullName}</h1>
          {contacts}
          <div
            aria-hidden
            style={{ height: 4, background: colors.accent, borderRadius: 2, marginTop: 12 }}
          />
        </div>
      )
      break
    case 'rule':
      header = (
        <div style={{ marginBottom: gap }}>
          <h1 style={nameStyle}>{fullName}</h1>
          <div
            aria-hidden
            style={{ width: 34, height: 2, background: colors.accent, marginTop: 8 }}
          />
          {contacts}
        </div>
      )
      break
    case 'initial':
      header = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: gap }}>
          <div
            aria-hidden
            style={{
              width: Math.round(type.nameSize * 1.7),
              height: Math.round(type.nameSize * 1.7),
              borderRadius: 999,
              background: colors.surface,
              color: colors.onSurface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: headingFont,
              fontSize: Math.round(type.nameSize * 0.72),
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={nameStyle}>{fullName}</h1>
            {contacts}
          </div>
        </div>
      )
      break
    case 'caps':
      header = (
        <div style={{ textAlign: 'center', marginBottom: gap }}>
          <h1 style={nameStyle}>{fullName}</h1>
          <div
            aria-hidden
            style={{ width: 60, height: 1.5, background: colors.accent, margin: '10px auto 0' }}
          />
          {contacts}
        </div>
      )
      break
    case 'left':
    default:
      header = (
        <div style={{ marginBottom: gap }}>
          <h1 style={nameStyle}>{fullName}</h1>
          {contacts}
        </div>
      )
  }

  /* ── Section bodies ─────────────────────────────────────────────────────── */
  const body = (size = type.bodySize): CSSProperties => ({
    fontSize: size,
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
  })

  function renderSkills(compact: boolean) {
    const skills = resume.skills ?? []
    switch (layout.skills) {
      case 'pills':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {skills.map((s, i) => (
              <span
                key={i}
                style={{
                  background: colors.accentSoft,
                  color: colors.accent,
                  fontSize: type.bodySize - 2,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 5,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )
      case 'outline':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {skills.map((s, i) => (
              <span
                key={i}
                style={{
                  border: `1px solid ${colors.accent}55`,
                  color: colors.accent,
                  fontSize: type.bodySize - 2,
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )
      case 'grid':
        return (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: compact ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: 4,
            }}
          >
            {skills.map((s, i) => (
              <span
                key={i}
                style={{
                  background: colors.accentSoft,
                  fontSize: type.bodySize - 2,
                  padding: '3px 7px',
                  borderRadius: 4,
                  color: colors.text,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )
      case 'bars':
        return (
          <div style={{ display: 'grid', gap: 6 }}>
            {skills.map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: type.bodySize - 2, color: colors.text, marginBottom: 2 }}>
                  {s}
                </div>
                <div style={{ height: 4, background: colors.accentSoft, borderRadius: 999 }}>
                  <div
                    style={{
                      width: `${BAR_WIDTHS[i % BAR_WIDTHS.length]}%`,
                      height: '100%',
                      background: colors.accent,
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )
      case 'list':
        return (
          <ul style={{ margin: 0, paddingLeft: 14, ...body(type.bodySize - 1) }}>
            {skills.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )
      case 'inline':
      default:
        return <p style={body()}>{skills.join('  ·  ')}</p>
    }
  }

  function renderExperience() {
    const items = resume.experience ?? []
    const dateOf = (e: (typeof items)[number]) =>
      [e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' – ')

    if (layout.experience === 'timeline') {
      return (
        <div style={{ display: 'grid', gap: Math.round(12 * unit) }}>
          {items.map((exp, i) => (
            <div key={i} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span
                  aria-hidden
                  style={{ width: 8, height: 8, borderRadius: 999, background: colors.accent, marginTop: 4 }}
                />
                {i < items.length - 1 && (
                  <span aria-hidden style={{ flex: 1, width: 1.5, background: `${colors.accent}33`, marginTop: 3 }} />
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <RoleLine exp={exp} date={dateOf(exp)} />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (layout.experience === 'dated-left') {
      return (
        <div style={{ display: 'grid', gap: Math.round(12 * unit) }}>
          {items.map((exp, i) => (
            <div key={i} style={{ display: 'flex', gap: 14 }}>
              <div
                style={{
                  width: 92,
                  flexShrink: 0,
                  fontSize: type.bodySize - 2,
                  color: colors.muted,
                  paddingTop: 1,
                }}
              >
                {dateOf(exp)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <RoleLine exp={exp} date="" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    const isCompact = layout.experience === 'compact'
    return (
      <div style={{ display: 'grid', gap: Math.round((isCompact ? 9 : 13) * unit) }}>
        {items.map((exp, i) => (
          <RoleLine key={i} exp={exp} date={dateOf(exp)} />
        ))}
      </div>
    )
  }

  /** One role: title line, optional location, then bullets. */
  function RoleLine({
    exp,
    date,
  }: {
    exp: NonNullable<AnyResume['experience']>[number]
    date: string
  }) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
          <p style={{ margin: 0, fontSize: type.bodySize + 0.5, fontWeight: 700, color: colors.text }}>
            {exp.role || 'Role'}
            {exp.company && (
              <span style={{ fontWeight: 400, color: colors.muted }}> · {exp.company}</span>
            )}
          </p>
          {date && (
            <span style={{ fontSize: type.bodySize - 2, color: colors.muted, flexShrink: 0 }}>
              {date}
            </span>
          )}
        </div>
        {exp.location && (
          <p style={{ ...body(type.bodySize - 2), marginTop: 1 }}>{exp.location}</p>
        )}
        {exp.bullets?.filter(Boolean).length > 0 && (
          <ul style={{ margin: '4px 0 0', paddingLeft: 15, ...body() }}>
            {exp.bullets.filter(Boolean).map((b, bi) => (
              <li key={bi} style={{ marginBottom: 2 }}>
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  function renderSection(key: SectionKey, inSidebar: boolean) {
    switch (key) {
      case 'summary':
        return <p style={body()}>{resume.summary}</p>
      case 'experience':
        return renderExperience()
      case 'education':
        return (
          <div style={{ display: 'grid', gap: Math.round(8 * unit) }}>
            {(resume.education ?? []).map((edu, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexDirection: inSidebar ? 'column' : 'row',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: type.bodySize, fontWeight: 700, color: colors.text }}>
                    {edu.degree || 'Degree'}
                    {edu.field && <span style={{ fontWeight: 400 }}> · {edu.field}</span>}
                  </p>
                  {edu.institution && (
                    <p style={body(type.bodySize - 1.5)}>{edu.institution}</p>
                  )}
                </div>
                <span style={{ fontSize: type.bodySize - 2, color: colors.muted, flexShrink: 0 }}>
                  {[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}
                </span>
              </div>
            ))}
          </div>
        )
      case 'skills':
        return renderSkills(inSidebar)
      case 'projects':
        return (
          <div style={{ display: 'grid', gap: Math.round(8 * unit) }}>
            {(resume.projects ?? []).map((p, i) => (
              <div key={i}>
                <p style={{ margin: 0, fontSize: type.bodySize, fontWeight: 700, color: colors.text }}>
                  {p.name || 'Project'}
                </p>
                {p.description && <p style={body()}>{p.description}</p>}
                {p.technologies?.length > 0 && (
                  <p style={{ ...body(type.bodySize - 2), color: colors.accent }}>
                    {p.technologies.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      case 'certifications':
        return (
          <ul style={{ margin: 0, paddingLeft: 15, ...body() }}>
            {(resume.certifications ?? []).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )
    }
  }

  const sectionBlock = (key: SectionKey, index: number, inSidebar: boolean) => (
    <section
      key={key}
      style={{
        marginBottom: gap,
        paddingBottom: layout.dividers && !inSidebar ? Math.round(gap * 0.6) : 0,
        borderBottom: layout.dividers && !inSidebar ? `1px solid ${colors.accent}22` : undefined,
      }}
    >
      {heading(SECTION_LABELS[key], index, inSidebar)}
      {renderSection(key, inSidebar)}
    </section>
  )

  const main = <div>{mainKeys.map((k, i) => sectionBlock(k, i, false))}</div>
  const aside = (
    <div>{sidebarKeys.map((k, i) => sectionBlock(k, i, true))}</div>
  )

  const sidebarStyle: CSSProperties = {
    width: `${layout.sidebarWidth}%`,
    flexShrink: 0,
    background: colors.accentSoft,
    padding: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  }

  return (
    <article
      className={className}
      style={{
        width: PAGE_WIDTH,
        minHeight: PAGE_HEIGHT,
        background: '#ffffff',
        color: colors.text,
        fontFamily: bodyFont,
        fontSize: type.bodySize,
        lineHeight: 1.5,
        padding: pad,
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...style,
      }}
    >
      {header}
      {isSidebar ? (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {layout.columns === 'sidebar-left' && <aside style={sidebarStyle}>{aside}</aside>}
          <div style={{ flex: 1, minWidth: 0 }}>{main}</div>
          {layout.columns === 'sidebar-right' && <aside style={sidebarStyle}>{aside}</aside>}
        </div>
      ) : (
        main
      )}
    </article>
  )
}
