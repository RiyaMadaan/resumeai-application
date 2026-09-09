import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Resume, ResumeInput, TemplateVariant } from '@/types/resume'

/**
 * ResumePdfDocument — renders a structured resume to a real (vector) PDF using
 * @react-pdf/renderer. Text stays selectable/searchable, the page is true A4,
 * and long content flows onto additional pages automatically.
 *
 * This mirrors the on-screen `ResumePreview` (same three templates, colors and
 * layout) rather than screenshotting it, so the download is close to the
 * preview while remaining a proper text PDF.
 *
 * Kept purely presentational and separate from the editor so PDF logic stays
 * modular.
 */

/**
 * Header spacing scale, in points.
 *
 * These are the three steps of the header's vertical hierarchy, named rather
 * than sprinkled through the styles so the relationship between them stays
 * obvious: the name is separated from its contact details more than the two
 * contact rows are from each other, and the divider sits further below again.
 * Ordinary margin/padding in normal flow — nothing is positioned absolutely, so
 * the rhythm holds whatever the content does.
 */
const headerSpace = {
  /**
   * Name → first contact row. The largest step, so the name reads as its own row.
   *
   * This is bigger than it looks it should be because the name's line box is
   * 20pt × 1.4 leading and react-pdf puts that extra leading ABOVE the baseline,
   * not below — so the name's glyphs sit close to the bottom of their own line
   * and almost none of the leading becomes visible space beneath them. The gap
   * has to come from this margin. Measured baseline-to-baseline: ~24pt.
   */
  nameToContacts: 20,
  /**
   * Between the contact row and the links row: small and consistent. The 9pt
   * text already carries ~14pt of line box, so a few points is enough to read
   * as a deliberate break without opening the header up.
   */
  betweenContactRows: 3,
  /** Last contact row → the horizontal divider. A step up from the row gap. */
  contactsToDivider: 14,
}

/** Brand palette (kept in sync with tailwind.config.js design tokens). */
const c = {
  ink: '#0f172a',
  inkMuted: '#475569',
  inkSubtle: '#64748b',
  brand700: '#4338ca',
  brand600: '#4f46e5',
  brand400: '#818cf8',
  brand50: '#eef2ff',
  slate300: '#cbd5e1',
  white: '#ffffff',
  // Solid stand-in for the on-screen indigo→violet gradient header (Modern).
  modernHeader: '#7c3aed',
}

const styles = StyleSheet.create({
  page: {
    paddingVertical: 40,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: c.ink,
    lineHeight: 1.4,
  },

  // ── Headers ──
  nameClassic: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: c.ink },
  headerClassic: {
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.slate300,
    // The divider is the block's bottom border, so this padding IS the gap
    // between the last contact row and the rule.
    paddingBottom: headerSpace.contactsToDivider,
    marginBottom: 18,
  },
  headerMinimal: { marginBottom: 18 },
  minimalRule: { width: 26, height: 1.5, backgroundColor: c.brand400, marginTop: 6 },
  headerModern: {
    backgroundColor: c.modernHeader,
    color: c.white,
    marginTop: -40,
    marginHorizontal: -44,
    paddingVertical: 22,
    paddingHorizontal: 44,
    marginBottom: 18,
  },
  nameModern: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: c.white },

  /**
   * Contact details.
   *
   * Each detail is its own Text inside a wrapping row, rather than one long
   * pre-joined string. A single string can only break wherever the text
   * happens to run out of width — which drops a separator onto the start of a
   * line and splits the list mid-item. Laying the items out as flex children
   * means the row can only break *between* details, so every line stays
   * structured and the spacing around separators is always identical.
   */
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  contactRowFirst: { marginTop: headerSpace.nameToContacts },
  contactRowNext: { marginTop: headerSpace.betweenContactRows },
  contactRowCentered: { justifyContent: 'center' },
  contact: { fontSize: 9, color: c.inkMuted },
  contactModern: { fontSize: 9, color: c.white, opacity: 0.9 },
  contactSeparator: { fontSize: 9, color: c.slate300, marginHorizontal: 6 },
  contactSeparatorModern: { fontSize: 9, color: c.white, opacity: 0.6, marginHorizontal: 6 },

  // ── Sections ──
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: c.brand700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },

  paragraph: { fontSize: 10, color: c.inkMuted },

  // ── Experience / Education rows ──
  itemBlock: { marginBottom: 9 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  /**
   * The base title style carries no flex sizing on purpose.
   *
   * `flex: 1` means "flexBasis: 0 + grow" along the container's MAIN axis. In a
   * row that is the width (what we want beside the date); in a column — which
   * is the default — it is the HEIGHT, so the title collapses to zero height
   * and whatever follows is drawn on top of it. Growing is therefore opted
   * into via `itemTitleGrow` only where the parent is actually a row.
   */
  itemTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: c.ink },
  itemTitleGrow: { flex: 1, paddingRight: 8 },
  itemMeta: { fontSize: 9, color: c.inkSubtle },
  itemSub: { fontSize: 9, color: c.inkSubtle, marginTop: 1 },

  // ── Bullets ──
  bulletRow: { flexDirection: 'row', marginTop: 3, paddingRight: 4 },
  bulletDot: { width: 10, fontSize: 10, color: c.brand400 },
  bulletText: { flex: 1, fontSize: 10, color: c.inkMuted },

  // ── Skills ──
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  skillChip: {
    backgroundColor: c.brand50,
    color: c.brand700,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    marginRight: 5,
    marginBottom: 5,
  },
})

type ResumeData = Resume | ResumeInput

/** One entry from the stylesheet below — avoids importing a transitive type package. */
type PdfStyle = (typeof styles)[keyof typeof styles]

/**
 * Contact details, split into the rows they should occupy: how to reach the
 * person, then where to find their work.
 *
 * Grouping them explicitly means the header has a predictable shape whatever
 * the content — the links never get pulled up beside a short phone number, and
 * a long URL can't drag the whole list out of alignment. Empty groups drop out,
 * so a resume with only an email still gets a clean single row.
 */
function contactGroups(resume: ResumeData): string[][] {
  const p = resume.personalInfo
  const reach = [p?.email, p?.phone, p?.location].filter(Boolean) as string[]
  const links = [p?.linkedin, p?.website].filter(Boolean) as string[]
  return [reach, links].filter((group) => group.length > 0)
}

/**
 * Render one group as alternating detail/separator Texts.
 *
 * A flat array (rather than nested fragments) keeps every detail a direct flex
 * child of the row, which is what lets the row wrap between items instead of
 * through them.
 */
function contactLine(group: string[], textStyle: PdfStyle, separatorStyle: PdfStyle) {
  return group.flatMap((item, i) =>
    i === 0
      ? [
          <Text key={`v${i}`} style={textStyle}>
            {item}
          </Text>,
        ]
      : [
          <Text key={`s${i}`} style={separatorStyle}>
            |
          </Text>,
          <Text key={`v${i}`} style={textStyle}>
            {item}
          </Text>,
        ],
  )
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

export function ResumePdfDocument({
  resume,
  template,
}: {
  resume: ResumeData
  template?: TemplateVariant
}) {
  const variant: TemplateVariant = template ?? resume.template ?? 'classic'
  const fullName = resume.personalInfo?.fullName || 'Your Name'
  const groups = contactGroups(resume)

  const isModern = variant === 'modern'
  // Classic centres its header; the other two are left-aligned.
  const centered = variant === 'classic'

  /**
   * The spacing above a contact row: a clear step down from the name, then the
   * tighter rhythm between the contact rows themselves.
   */
  const rowStyle = (index: number) => {
    const style: PdfStyle[] = [
      styles.contactRow,
      index === 0 ? styles.contactRowFirst : styles.contactRowNext,
    ]
    if (centered) style.push(styles.contactRowCentered)
    return style
  }

  /** The name row, then one wrapping row per contact group, all in normal flow. */
  const header = (
    <>
      <Text style={isModern ? styles.nameModern : styles.nameClassic}>{fullName}</Text>
      {variant === 'minimal' && <View style={styles.minimalRule} />}
      {groups.map((group, i) => (
        <View key={i} style={rowStyle(i)}>
          {contactLine(
            group,
            isModern ? styles.contactModern : styles.contact,
            isModern ? styles.contactSeparatorModern : styles.contactSeparator,
          )}
        </View>
      ))}
    </>
  )

  return (
    <Document title={resume.title || 'Resume'} author="ResumeAI">
      <Page size="A4" style={styles.page} wrap>
        {/* ── Header (per template) ── */}
        <View
          style={
            isModern
              ? styles.headerModern
              : variant === 'minimal'
                ? styles.headerMinimal
                : styles.headerClassic
          }
        >
          {header}
        </View>

        {/* ── Summary ── */}
        {resume.summary ? (
          <View style={styles.section}>
            <SectionTitle>Summary</SectionTitle>
            <Text style={styles.paragraph}>{resume.summary}</Text>
          </View>
        ) : null}

        {/* ── Experience ── */}
        {resume.experience && resume.experience.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>Experience</SectionTitle>
            {resume.experience.map((exp, i) => (
              // Not wrap={false}: a role with many bullets can exceed a page, and an
              // unbreakable block that tall gets clipped. minPresenceAhead keeps the
              // heading from being stranded alone at the foot of a page instead.
              <View key={i} style={styles.itemBlock} minPresenceAhead={36}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.itemTitle, styles.itemTitleGrow]}>
                    {exp.role || 'Role'}
                    {exp.company ? `  ·  ${exp.company}` : ''}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {[exp.startDate, exp.current ? 'Present' : exp.endDate]
                      .filter(Boolean)
                      .join(' – ')}
                  </Text>
                </View>
                {exp.location ? <Text style={styles.itemSub}>{exp.location}</Text> : null}
                {exp.bullets?.filter(Boolean).map((b, bi) => (
                  <Bullet key={bi}>{b}</Bullet>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Education ── */}
        {resume.education && resume.education.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>Education</SectionTitle>
            {resume.education.map((edu, i) => (
              <View key={i} style={styles.itemBlock} wrap={false}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.itemTitle, styles.itemTitleGrow]}>
                    {edu.degree || 'Degree'}
                    {edu.field ? `  ·  ${edu.field}` : ''}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}
                  </Text>
                </View>
                {edu.institution ? <Text style={styles.itemSub}>{edu.institution}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Projects ── */}
        {resume.projects && resume.projects.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>Projects</SectionTitle>
            {resume.projects.map((p, i) => (
              // Descriptions are free text and can be long — let them flow.
              <View key={i} style={styles.itemBlock} minPresenceAhead={36}>
                <Text style={styles.itemTitle}>{p.name || 'Project'}</Text>
                {p.description ? <Text style={styles.paragraph}>{p.description}</Text> : null}
                {p.technologies?.length > 0 ? (
                  <Text style={styles.itemSub}>{p.technologies.join(', ')}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Skills ── */}
        {resume.skills && resume.skills.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>Skills</SectionTitle>
            <View style={styles.skillsWrap}>
              {resume.skills.map((skill, i) => (
                <Text key={i} style={styles.skillChip}>
                  {skill}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Certifications ── */}
        {resume.certifications && resume.certifications.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>Certifications</SectionTitle>
            {resume.certifications.map((cert, i) => (
              <Bullet key={i}>{cert}</Bullet>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  )
}
