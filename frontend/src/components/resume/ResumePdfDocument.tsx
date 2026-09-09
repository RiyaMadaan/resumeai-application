import { Document, Page, View, Text } from '@react-pdf/renderer'
import type { Style as PdfStyle } from '@react-pdf/types'
import { getTemplate } from '@/templates/catalog'
import { DENSITY_SCALE, type SectionKey, type TemplateSpec } from '@/templates/types'
import type { Resume, ResumeInput, TemplateId } from '@/types/resume'

/**
 * ResumePdfDocument — renders a structured resume to a real (vector) PDF using
 * @react-pdf/renderer. Text stays selectable and searchable, the page is true
 * A4, and long content flows onto additional pages automatically.
 *
 * It is driven by the same `TemplateSpec` as the on-screen preview, so all of
 * the catalog's templates export correctly and the download matches what the
 * user selected in the gallery. Rather than screenshotting the preview, it
 * re-expresses the spec in react-pdf primitives — which is what keeps the
 * output a proper text PDF.
 *
 * Kept purely presentational and separate from the editor so PDF logic stays
 * modular.
 */

type ResumeData = Resume | ResumeInput

/**
 * The preview is authored at 794px (A4 at 96dpi); a PDF point is 1/72".
 * Converting with this ratio keeps every size in proportion with the preview
 * instead of the two drifting apart.
 */
const PX_TO_PT = 595 / 794
const pt = (px: number) => Math.round(px * PX_TO_PT * 100) / 100

/**
 * react-pdf ships only the three PDF base-14 families, which map cleanly onto
 * the catalog's three font kinds — so no font files need embedding.
 */
const FONTS = {
  sans: { regular: 'Helvetica', bold: 'Helvetica-Bold' },
  serif: { regular: 'Times-Roman', bold: 'Times-Bold' },
  mono: { regular: 'Courier', bold: 'Courier-Bold' },
} as const

const SECTION_LABELS: Record<SectionKey, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
}

/** Contact details grouped into the rows they occupy, as in the preview. */
function contactGroups(resume: ResumeData): string[][] {
  const p = resume.personalInfo
  return [
    [p?.email, p?.phone, p?.location].filter(Boolean) as string[],
    [p?.linkedin, p?.website].filter(Boolean) as string[],
  ].filter((group) => group.length > 0)
}

function hasContent(resume: ResumeData, key: SectionKey): boolean {
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

/** Stable bar widths for the `bars` skill style — matches the preview. */
const BAR_WIDTHS = [92, 86, 90, 78, 84, 72, 88, 76]

export function ResumePdfDocument({
  resume,
  template,
}: {
  resume: ResumeData
  /** Overrides the template stored on the resume. */
  template?: TemplateId
}) {
  const spec: TemplateSpec = getTemplate(template ?? resume.template)
  const { layout, type, colors } = spec

  const unit = DENSITY_SCALE[layout.density]
  const body = FONTS[type.font]
  const heading = FONTS[type.headingFont ?? type.font]

  const padX = pt(layout.density === 'compact' ? 37 : layout.density === 'roomy' ? 49 : 44)
  const padY = pt(layout.density === 'compact' ? 34 : layout.density === 'roomy' ? 46 : 40)
  const gap = pt(18 * unit)

  const bodySize = pt(type.bodySize) + 0.5
  const titleSize = pt(type.titleSize) + 0.5
  const nameSize = pt(type.nameSize)

  const fullName = resume.personalInfo?.fullName || 'Your Name'
  const groups = contactGroups(resume)
  const onColour = layout.header === 'banner'

  const isSidebar = layout.columns !== 'single'
  const sidebarKeys = isSidebar ? layout.sidebar.filter((k) => hasContent(resume, k)) : []
  const mainKeys = layout.order.filter((k) => hasContent(resume, k) && !sidebarKeys.includes(k))

  const muted: PdfStyle = { fontSize: bodySize - 1, color: colors.muted, lineHeight: 1.45 }

  /* ── Contact rows ───────────────────────────────────────────────────────── */
  /**
   * Each detail is its own Text inside a wrapping row rather than one joined
   * string. A single string can only break where the text happens to run out of
   * width, which drops a separator onto the start of a line; laying the items
   * out as flex children means a row can only break *between* details.
   */
  const contactRow = (group: string[], index: number, centered: boolean) => (
    <View
      key={index}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: centered ? 'center' : 'flex-start',
        marginTop: index === 0 ? pt(8) : pt(2),
      }}
    >
      {group.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          {i > 0 && (
            <Text
              style={{
                fontSize: bodySize - 1.5,
                color: onColour ? colors.onSurface : colors.muted,
                opacity: 0.5,
                marginHorizontal: 5,
                fontFamily: body.regular,
              }}
            >
              |
            </Text>
          )}
          <Text
            style={{
              fontSize: bodySize - 1.5,
              color: onColour ? colors.onSurface : colors.muted,
              opacity: onColour ? 0.9 : 1,
              fontFamily: body.regular,
            }}
          >
            {item}
          </Text>
        </View>
      ))}
    </View>
  )

  const nameStyle: PdfStyle = {
    fontFamily: heading.bold,
    fontSize: nameSize,
    color: onColour ? colors.onSurface : colors.text,
    letterSpacing: type.nameTracking * nameSize,
  }
  const nameText = type.nameCaps ? fullName.toUpperCase() : fullName

  /* ── Header ─────────────────────────────────────────────────────────────── */
  let header: React.ReactNode
  switch (layout.header) {
    case 'banner':
      header = (
        <View
          style={{
            backgroundColor: colors.surface,
            marginTop: -padY,
            marginHorizontal: -padX,
            paddingVertical: pt(26 * unit),
            paddingHorizontal: padX,
            marginBottom: gap,
          }}
        >
          <Text style={nameStyle}>{nameText}</Text>
          {groups.map((g, i) => contactRow(g, i, false))}
        </View>
      )
      break
    case 'tinted':
      header = (
        <View
          style={{
            backgroundColor: colors.accentSoft,
            borderLeftWidth: 3,
            borderLeftColor: colors.accent,
            padding: pt(14 * unit),
            marginBottom: gap,
          }}
        >
          <Text style={nameStyle}>{nameText}</Text>
          {groups.map((g, i) => contactRow(g, i, false))}
        </View>
      )
      break
    case 'boxed':
      header = (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.accent,
            padding: pt(14 * unit),
            marginBottom: gap,
            alignItems: 'center',
          }}
        >
          <Text style={nameStyle}>{nameText}</Text>
          {groups.map((g, i) => contactRow(g, i, true))}
        </View>
      )
      break
    case 'centered':
      header = (
        <View
          style={{
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: colors.accent,
            paddingBottom: pt(12 * unit),
            marginBottom: gap,
          }}
        >
          <Text style={nameStyle}>{nameText}</Text>
          {groups.map((g, i) => contactRow(g, i, true))}
        </View>
      )
      break
    case 'split':
      header = (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottomWidth: 1,
            borderBottomColor: colors.accent,
            paddingBottom: pt(10 * unit),
            marginBottom: gap,
          }}
        >
          <Text style={nameStyle}>{nameText}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            {groups.map((g, i) => (
              <Text key={i} style={{ ...muted, fontFamily: body.regular, fontSize: bodySize - 1.5 }}>
                {g.join('  ·  ')}
              </Text>
            ))}
          </View>
        </View>
      )
      break
    case 'underline':
      header = (
        <View style={{ marginBottom: gap }}>
          <Text style={nameStyle}>{nameText}</Text>
          {groups.map((g, i) => contactRow(g, i, false))}
          <View style={{ height: 3, backgroundColor: colors.accent, marginTop: pt(10) }} />
        </View>
      )
      break
    case 'rule':
      header = (
        <View style={{ marginBottom: gap }}>
          <Text style={nameStyle}>{nameText}</Text>
          <View style={{ width: pt(34), height: 1.5, backgroundColor: colors.accent, marginTop: pt(6) }} />
          {groups.map((g, i) => contactRow(g, i, false))}
        </View>
      )
      break
    case 'initial': {
      const size = pt(type.nameSize * 1.7)
      header = (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: gap }}>
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: pt(12),
            }}
          >
            <Text
              style={{
                fontFamily: heading.bold,
                fontSize: nameSize * 0.72,
                color: colors.onSurface,
              }}
            >
              {fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={nameStyle}>{nameText}</Text>
            {groups.map((g, i) => contactRow(g, i, false))}
          </View>
        </View>
      )
      break
    }
    case 'caps':
      header = (
        <View style={{ alignItems: 'center', marginBottom: gap }}>
          <Text style={nameStyle}>{nameText}</Text>
          <View style={{ width: pt(60), height: 1.5, backgroundColor: colors.accent, marginTop: pt(8) }} />
          {groups.map((g, i) => contactRow(g, i, true))}
        </View>
      )
      break
    case 'left':
    default:
      header = (
        <View style={{ marginBottom: gap }}>
          <Text style={nameStyle}>{nameText}</Text>
          {groups.map((g, i) => contactRow(g, i, false))}
        </View>
      )
  }

  /* ── Section headings ───────────────────────────────────────────────────── */
  function SectionTitle({ label, index }: { label: string; index: number }) {
    const base: PdfStyle = {
      fontFamily: heading.bold,
      fontSize: titleSize,
      color: colors.accent,
      marginBottom: pt(6 * unit),
    }
    const caps = label.toUpperCase()

    switch (layout.sectionTitle) {
      case 'underline':
        return (
          <Text
            style={{
              ...base,
              letterSpacing: 0.8,
              borderBottomWidth: 1,
              borderBottomColor: colors.accent,
              paddingBottom: 2,
            }}
          >
            {caps}
          </Text>
        )
      case 'bar':
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: pt(6 * unit) }}>
            <View style={{ width: pt(14), height: 2.5, backgroundColor: colors.accent, marginRight: pt(6) }} />
            <Text style={{ ...base, marginBottom: 0, letterSpacing: 0.8 }}>{caps}</Text>
          </View>
        )
      case 'boxed':
        return (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: colors.accentSoft,
              paddingVertical: 2,
              paddingHorizontal: 6,
              marginBottom: pt(6 * unit),
            }}
          >
            <Text style={{ ...base, marginBottom: 0, letterSpacing: 0.8 }}>{caps}</Text>
          </View>
        )
      case 'side-rule':
        return (
          <View style={{ flexDirection: 'row', marginBottom: pt(6 * unit) }}>
            <View style={{ width: 2.5, backgroundColor: colors.accent, marginRight: pt(6) }} />
            <Text style={{ ...base, marginBottom: 0, letterSpacing: 0.8 }}>{caps}</Text>
          </View>
        )
      case 'caps-wide':
        return <Text style={{ ...base, letterSpacing: 1.6 }}>{caps}</Text>
      case 'numbered':
        return (
          <Text style={{ ...base, letterSpacing: 0.8 }}>
            {String(index + 1).padStart(2, '0')}. {caps}
          </Text>
        )
      case 'dot':
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: pt(6 * unit) }}>
            <View
              style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent, marginRight: pt(5) }}
            />
            <Text style={{ ...base, marginBottom: 0, letterSpacing: 0.8 }}>{caps}</Text>
          </View>
        )
      case 'plain':
      default:
        return <Text style={{ ...base, letterSpacing: 0.8 }}>{caps}</Text>
    }
  }

  /* ── Section bodies ─────────────────────────────────────────────────────── */
  function Skills({ inSidebar }: { inSidebar: boolean }) {
    const skills = resume.skills ?? []
    const tag = (extra: PdfStyle) => ({
      fontSize: bodySize - 1.5,
      fontFamily: body.regular,
      marginRight: 4,
      marginBottom: 4,
      paddingVertical: 2,
      paddingHorizontal: 5,
      ...extra,
    })

    switch (layout.skills) {
      case 'pills':
      case 'grid':
        return (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {skills.map((s, i) => (
              <Text
                key={i}
                style={tag({
                  backgroundColor: colors.accentSoft,
                  color: layout.skills === 'pills' ? colors.accent : colors.text,
                })}
              >
                {s}
              </Text>
            ))}
          </View>
        )
      case 'outline':
        return (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {skills.map((s, i) => (
              <Text
                key={i}
                style={tag({ borderWidth: 0.5, borderColor: colors.accent, color: colors.accent })}
              >
                {s}
              </Text>
            ))}
          </View>
        )
      case 'bars':
        return (
          <View>
            {skills.map((s, i) => (
              <View key={i} style={{ marginBottom: pt(5) }}>
                <Text style={{ fontSize: bodySize - 1.5, color: colors.text, fontFamily: body.regular }}>
                  {s}
                </Text>
                <View style={{ height: 3, backgroundColor: colors.accentSoft, marginTop: 2 }}>
                  <View
                    style={{
                      width: `${BAR_WIDTHS[i % BAR_WIDTHS.length]}%`,
                      height: '100%',
                      backgroundColor: colors.accent,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        )
      case 'list':
        return (
          <View>
            {skills.map((s, i) => (
              <Text key={i} style={{ ...muted, fontFamily: body.regular, marginBottom: 1.5 }}>
                • {s}
              </Text>
            ))}
          </View>
        )
      case 'inline':
      default:
        return (
          <Text style={{ ...muted, fontFamily: body.regular }}>
            {skills.join(inSidebar ? '\n' : '  ·  ')}
          </Text>
        )
    }
  }

  function Role({
    exp,
    date,
  }: {
    exp: NonNullable<ResumeData['experience']>[number]
    date: string
  }) {
    const bullets = exp.bullets?.filter(Boolean) ?? []
    return (
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: bodySize, fontFamily: body.bold, color: colors.text, flex: 1 }}>
            {exp.role || 'Role'}
            {exp.company ? (
              <Text style={{ fontFamily: body.regular, color: colors.muted }}> · {exp.company}</Text>
            ) : null}
          </Text>
          {date ? (
            <Text style={{ fontSize: bodySize - 1.5, color: colors.muted, fontFamily: body.regular }}>
              {date}
            </Text>
          ) : null}
        </View>
        {exp.location ? (
          <Text style={{ ...muted, fontFamily: body.regular, fontSize: bodySize - 1.5 }}>
            {exp.location}
          </Text>
        ) : null}
        {bullets.map((b, i) => (
          <View key={i} style={{ flexDirection: 'row', marginTop: 2 }}>
            <Text style={{ ...muted, fontFamily: body.regular, marginRight: 4 }}>•</Text>
            <Text style={{ ...muted, fontFamily: body.regular, flex: 1 }}>{b}</Text>
          </View>
        ))}
      </View>
    )
  }

  function Experience() {
    const items = resume.experience ?? []
    const dateOf = (e: (typeof items)[number]) =>
      [e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' – ')
    const spacing = pt((layout.experience === 'compact' ? 9 : 13) * unit)

    if (layout.experience === 'dated-left') {
      return (
        <View>
          {items.map((exp, i) => (
            // Not wrap={false}: a role with many bullets can exceed a page, and
            // an unbreakable block taller than the page would be dropped.
            <View key={i} style={{ flexDirection: 'row', marginBottom: spacing }}>
              <Text
                style={{
                  width: pt(92),
                  fontSize: bodySize - 1.5,
                  color: colors.muted,
                  fontFamily: body.regular,
                }}
              >
                {dateOf(exp)}
              </Text>
              <View style={{ flex: 1 }}>
                <Role exp={exp} date="" />
              </View>
            </View>
          ))}
        </View>
      )
    }

    if (layout.experience === 'timeline') {
      return (
        <View>
          {items.map((exp, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: spacing }}>
              <View style={{ width: pt(12), alignItems: 'center' }}>
                <View
                  style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent, marginTop: 3 }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Role exp={exp} date={dateOf(exp)} />
              </View>
            </View>
          ))}
        </View>
      )
    }

    return (
      <View>
        {items.map((exp, i) => (
          <View key={i} style={{ marginBottom: spacing }}>
            <Role exp={exp} date={dateOf(exp)} />
          </View>
        ))}
      </View>
    )
  }

  function SectionBody({ sectionKey, inSidebar }: { sectionKey: SectionKey; inSidebar: boolean }) {
    switch (sectionKey) {
      case 'summary':
        return <Text style={{ ...muted, fontFamily: body.regular }}>{resume.summary}</Text>
      case 'experience':
        return <Experience />
      case 'education':
        return (
          <View>
            {(resume.education ?? []).map((edu, i) => (
              <View
                key={i}
                style={{
                  flexDirection: inSidebar ? 'column' : 'row',
                  justifyContent: 'space-between',
                  marginBottom: pt(6 * unit),
                }}
              >
                <View style={{ flex: inSidebar ? undefined : 1 }}>
                  <Text style={{ fontSize: bodySize, fontFamily: body.bold, color: colors.text }}>
                    {edu.degree || 'Degree'}
                    {edu.field ? (
                      <Text style={{ fontFamily: body.regular }}> · {edu.field}</Text>
                    ) : null}
                  </Text>
                  {edu.institution ? (
                    <Text style={{ ...muted, fontFamily: body.regular, fontSize: bodySize - 1.5 }}>
                      {edu.institution}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ fontSize: bodySize - 1.5, color: colors.muted, fontFamily: body.regular }}>
                  {[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}
                </Text>
              </View>
            ))}
          </View>
        )
      case 'skills':
        return <Skills inSidebar={inSidebar} />
      case 'projects':
        return (
          <View>
            {(resume.projects ?? []).map((p, i) => (
              <View key={i} style={{ marginBottom: pt(6 * unit) }}>
                <Text style={{ fontSize: bodySize, fontFamily: body.bold, color: colors.text }}>
                  {p.name || 'Project'}
                </Text>
                {p.description ? (
                  <Text style={{ ...muted, fontFamily: body.regular }}>{p.description}</Text>
                ) : null}
                {p.technologies?.length ? (
                  <Text
                    style={{
                      fontSize: bodySize - 1.5,
                      color: colors.accent,
                      fontFamily: body.regular,
                    }}
                  >
                    {p.technologies.join(', ')}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )
      case 'certifications':
        return (
          <View>
            {(resume.certifications ?? []).map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 1.5 }}>
                <Text style={{ ...muted, fontFamily: body.regular, marginRight: 4 }}>•</Text>
                <Text style={{ ...muted, fontFamily: body.regular, flex: 1 }}>{c}</Text>
              </View>
            ))}
          </View>
        )
    }
  }

  const section = (key: SectionKey, index: number, inSidebar: boolean) => (
    <View
      key={key}
      style={{
        marginBottom: gap,
        paddingBottom: layout.dividers && !inSidebar ? pt(10 * unit) : 0,
        borderBottomWidth: layout.dividers && !inSidebar ? 0.5 : 0,
        borderBottomColor: colors.accentSoft,
      }}
    >
      <SectionTitle label={SECTION_LABELS[key]} index={index} />
      <SectionBody sectionKey={key} inSidebar={inSidebar} />
    </View>
  )

  const mainColumn = <View>{mainKeys.map((k, i) => section(k, i, false))}</View>
  const sideColumn = (
    <View
      style={{
        width: `${layout.sidebarWidth}%`,
        backgroundColor: colors.accentSoft,
        padding: pt(12),
        marginLeft: layout.columns === 'sidebar-right' ? pt(16) : 0,
        marginRight: layout.columns === 'sidebar-left' ? pt(16) : 0,
      }}
    >
      {sidebarKeys.map((k, i) => section(k, i, true))}
    </View>
  )

  return (
    <Document title={resume.title || 'Resume'} author="ResumeAI">
      <Page
        size="A4"
        wrap
        style={{
          paddingVertical: padY,
          paddingHorizontal: padX,
          fontFamily: body.regular,
          fontSize: bodySize,
          color: colors.text,
          lineHeight: 1.45,
          backgroundColor: '#ffffff',
        }}
      >
        {header}
        {isSidebar ? (
          <View style={{ flexDirection: 'row' }}>
            {layout.columns === 'sidebar-left' && sideColumn}
            <View style={{ flex: 1 }}>{mainColumn}</View>
            {layout.columns === 'sidebar-right' && sideColumn}
          </View>
        ) : (
          mainColumn
        )}
      </Page>
    </Document>
  )
}
