import { Document, Page, View, Text } from '@react-pdf/renderer'
import type { PersonalInfo } from '@/types/resume'

/**
 * CoverLetterPdfDocument — renders a cover letter as a real (vector) PDF.
 *
 * The AI writes only the body; the letter furniture around it — sender block,
 * date, greeting and sign-off — is added here. That keeps the model from
 * emitting placeholder brackets like "[Your Name]", and means the contact
 * details always come from the user's own resume rather than being invented.
 */

export interface CoverLetterPdfProps {
  body: string
  company?: string
  jobTitle?: string
  /** Taken from the resume the letter was written from, when available. */
  personalInfo?: Partial<PersonalInfo>
}

const c = {
  ink: '#0f172a',
  muted: '#475569',
  rule: '#cbd5e1',
}

/** Split the body into paragraphs on blank lines, dropping empties. */
function paragraphsOf(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function CoverLetterPdfDocument({
  body,
  company,
  jobTitle,
  personalInfo,
}: CoverLetterPdfProps) {
  const name = personalInfo?.fullName?.trim() || ''
  const contacts = [personalInfo?.email, personalInfo?.phone, personalInfo?.location]
    .map((v) => v?.trim())
    .filter(Boolean) as string[]

  const today = new Date().toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const paragraphs = paragraphsOf(body)
  const title = [jobTitle?.trim(), company?.trim()].filter(Boolean).join(' — ')

  return (
    <Document title={title || 'Cover letter'} author={name || 'ResumeAI'}>
      <Page
        size="A4"
        wrap
        style={{
          paddingVertical: 56,
          paddingHorizontal: 56,
          fontFamily: 'Helvetica',
          fontSize: 10.5,
          color: c.ink,
          lineHeight: 1.55,
          backgroundColor: '#ffffff',
        }}
      >
        {/* Sender block — omitted entirely when the resume has no details. */}
        {(name || contacts.length > 0) && (
          <View
            style={{
              borderBottomWidth: 1,
              borderBottomColor: c.rule,
              paddingBottom: 12,
              marginBottom: 20,
            }}
          >
            {name ? (
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 15 }}>{name}</Text>
            ) : null}
            {contacts.length > 0 ? (
              <Text style={{ fontSize: 9.5, color: c.muted, marginTop: 3 }}>
                {contacts.join('  ·  ')}
              </Text>
            ) : null}
          </View>
        )}

        <Text style={{ fontSize: 9.5, color: c.muted, marginBottom: 16 }}>{today}</Text>

        {company?.trim() ? (
          <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>{company.trim()}</Text>
        ) : null}
        {jobTitle?.trim() ? (
          <Text style={{ color: c.muted, marginBottom: 16 }}>Re: {jobTitle.trim()}</Text>
        ) : (
          <View style={{ marginBottom: 12 }} />
        )}

        <Text style={{ marginBottom: 12 }}>Dear Hiring Manager,</Text>

        {paragraphs.map((paragraph, i) => (
          <Text key={i} style={{ marginBottom: 11, textAlign: 'left' }}>
            {paragraph}
          </Text>
        ))}

        <Text style={{ marginTop: 10 }}>Sincerely,</Text>
        {name ? <Text style={{ fontFamily: 'Helvetica-Bold', marginTop: 14 }}>{name}</Text> : null}
      </Page>
    </Document>
  )
}
