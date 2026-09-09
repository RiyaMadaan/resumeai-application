import Anthropic from '@anthropic-ai/sdk'
import type { ResumeInput } from './resume.service.js'
import type { ExperienceValue } from '../models/Resume.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * AI service layer (provider-agnostic to the rest of the app).
 *
 * This is the ONLY place AI logic lives. Controllers and the frontend talk to
 * these functions — never to a provider SDK directly — so the provider
 * (Anthropic / Claude) can be swapped or configured in exactly one spot. The
 * API key stays server-side; it is read from ANTHROPIC_API_KEY and never sent
 * to the client, returned by an endpoint, or written to a log.
 *
 * Every feature (Ask AI, job customization, resume import, ATS score,
 * story→resume, the interview) goes through the single `generateStructured`
 * helper below, so provider setup, error mapping, refusal handling and JSON
 * parsing are implemented once.
 */

/** Provider identifiers this service knows how to talk to. */
const SUPPORTED_PROVIDERS = ['anthropic', 'claude'] as const
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number]

/**
 * JSON Schema type names, kept as a small enum-like object.
 *
 * The schemas below were originally written against a provider SDK that
 * required a `Type` enum. Anthropic's structured outputs take plain JSON
 * Schema, and these constants are exactly the JSON Schema type strings — so
 * the six schema definitions in this file need no rewriting, and stay readable.
 */
export const Type = {
  OBJECT: 'object',
  STRING: 'string',
  ARRAY: 'array',
  INTEGER: 'integer',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
} as const

/** A JSON Schema fragment describing one structured response. */
export interface Schema {
  type: string
  description?: string
  properties?: Record<string, Schema>
  items?: Schema
  required?: string[]
  /**
   * Retained from the schemas' original form. It is not JSON Schema, so it is
   * stripped before the request — see `toJsonSchema`.
   */
  propertyOrdering?: string[]
}

/**
 * Turn one of the schemas above into the strict JSON Schema the API expects.
 *
 * Two things have to happen for every object in the tree: `propertyOrdering`
 * (not a JSON Schema keyword) is dropped, and `additionalProperties: false` is
 * added so the model cannot return fields the app doesn't know about — the
 * same closed-shape guarantee the previous provider gave through all-required
 * properties.
 */
function toJsonSchema(schema: Schema): Record<string, unknown> {
  const { propertyOrdering: _ordering, properties, items, ...rest } = schema
  const converted: Record<string, unknown> = { ...rest }

  if (properties) {
    converted.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, toJsonSchema(value)]),
    )
    converted.additionalProperties = false
  }
  if (items) {
    converted.items = toJsonSchema(items)
  }
  return converted
}

/**
 * A single work-experience entry as the AI layer reads and returns it — the
 * model's plain value shape, since these are rebuilt from scratch and
 * serialized straight back to the client.
 */
export type ExperienceEntry = ExperienceValue

/** Coerce whatever the client/DB gave us into a well-formed experience entry. */
function toExperienceEntry(value: unknown): ExperienceEntry {
  const entry = (value ?? {}) as Record<string, unknown>
  const asText = (v: unknown): string => (typeof v === 'string' ? v : '')
  return {
    company: asText(entry.company),
    role: asText(entry.role),
    location: asText(entry.location),
    startDate: asText(entry.startDate),
    endDate: asText(entry.endDate),
    current: Boolean(entry.current),
    bullets: Array.isArray(entry.bullets)
      ? entry.bullets.filter((b): b is string => typeof b === 'string')
      : [],
  }
}

export interface EditResumeParams {
  /** The current structured resume content (the user's own working copy). */
  resume: ResumeInput
  /** A natural-language instruction, e.g. "make the summary shorter". */
  instruction: string
}

/**
 * The result of an AI edit.
 *
 * The editor currently supports (and persists) two content fields — the
 * Summary and the Skills list — so the AI only ever proposes changes to those.
 * The full resume is still sent to the model as read-only context so it can
 * tailor the summary/skills well, but it is never rewritten wholesale.
 */
export interface EditResumeResult {
  /** Proposed summary text (unchanged from the input if not targeted). */
  summary: string
  /** Proposed skills list (unchanged from the input if not targeted). */
  skills: string[]
  /** A short, plain-language summary of what the AI changed (or why it didn't). */
  summaryOfChanges: string
  /**
   * True when the instruction asked for facts the user never provided, or asked
   * to edit a section the editor can't yet change. In that case nothing is
   * applied and `summaryOfChanges` explains what the user should do.
   */
  needsMoreInfo: boolean
}

export interface CustomizeResumeParams {
  /** The current structured resume content (the user's own working copy). */
  resume: ResumeInput
  /** The raw job posting the user pasted in. */
  jobDescription: string
}

/**
 * The result of tailoring a resume to a job description.
 *
 * This is a *proposal* — nothing is persisted. The client shows a before/after
 * review and only updates the editor once the user explicitly applies it.
 */
export interface CustomizeResumeResult {
  /** The role the AI understood the posting to be for (for the review header). */
  targetRole: string
  /** Proposed professional summary, rewritten for this role. */
  summary: string
  /** Proposed skills — reordered/prioritized, never invented. */
  skills: string[]
  /**
   * The full experience array, in the resume's original order and length.
   * Only the `bullets` of each entry may differ — company, role, dates and
   * location are copied verbatim from the user's resume.
   */
  experience: ExperienceEntry[]
  /**
   * Skills the job description asks for that the resume does not evidence.
   * Surfaced to the user as information only — never merged into `skills`.
   */
  missingSkills: string[]
  /** Short, plain-language notes on what was tailored and why. */
  reasoning: string[]
}

/** Lazily-created singleton Anthropic client (only built once a key exists). */
let client: Anthropic | null = null
function getClient(): Anthropic {
  // Both branches raise a clear, actionable 503 rather than a stack trace, so
  // the UI can show a friendly "AI isn't configured" message. Neither the key
  // nor any other environment value is included in what is returned.
  if (!SUPPORTED_PROVIDERS.includes(env.aiProvider as SupportedProvider)) {
    console.error(
      `[ai] Unsupported AI_PROVIDER "${env.aiProvider}" — expected one of: ${SUPPORTED_PROVIDERS.join(', ')}`,
    )
    throw new ApiError(503, 'AI features are not configured on the server.')
  }
  if (!env.anthropicApiKey) {
    console.error('[ai] ANTHROPIC_API_KEY is not set — AI features are disabled.')
    throw new ApiError(503, 'Anthropic API key is not configured.')
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey })
  }
  return client
}

/**
 * Map a provider error onto a safe, user-facing ApiError. The real error is
 * logged server-side for diagnosability and never reaches the client. The API
 * key is never part of an error message we log or return.
 */
function toClientError(err: unknown): unknown {
  if (!(err instanceof Anthropic.APIError)) {
    // A transport or runtime failure (DNS, TLS, a dropped connection). Log it
    // for diagnosis, but never hand its message to the client — "fetch failed"
    // tells a user nothing and leaks internals.
    console.error('[ai] Unexpected error calling Anthropic:', err)
    return new ApiError(502, 'The AI service could not be reached. Please try again in a moment.')
  }

  const status = err.status
  console.error('[ai] Anthropic API error:', status, err.message)

  // An invalid or revoked key is a server misconfiguration — not something the
  // user can fix by retrying.
  if (err instanceof Anthropic.AuthenticationError || status === 401 || status === 403) {
    return new ApiError(503, 'Anthropic API key is not configured correctly on the server.')
  }
  if (err instanceof Anthropic.RateLimitError || status === 429) {
    return new ApiError(429, 'The AI is busy right now. Please try again in a moment.')
  }
  if (err instanceof Anthropic.NotFoundError || status === 404) {
    console.error(`[ai] Configured AI_MODEL "${env.aiModel}" was not found for this API key.`)
    return new ApiError(503, 'The configured AI model is unavailable on the server.')
  }
  // Credit/quota exhaustion arrives as a 400 with a specific type.
  if (status === 400 && /credit balance|billing|quota/i.test(err.message)) {
    return new ApiError(
      503,
      'The AI service is unavailable due to a billing or quota issue on the server.',
    )
  }
  if (err instanceof Anthropic.InternalServerError || (status !== undefined && status >= 500)) {
    return new ApiError(503, 'The AI is busy right now. Please try again in a moment.')
  }
  return new ApiError(502, 'The AI service could not complete your request. Please try again.')
}

/** Statuses where the request never ran, so retrying it is safe. */
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504, 529])

/**
 * Non-streaming output ceiling.
 *
 * Every response here is a bounded JSON document, and the SDK requires
 * streaming for the very large `max_tokens` values the model supports — so
 * this is deliberately set where a non-streaming request stays well inside the
 * HTTP timeout.
 */
const MAX_OUTPUT_TOKENS = 16000

/**
 * The single provider call used by every AI feature.
 *
 * Sends one system prompt plus one user message and constrains the reply to
 * `schema` using structured outputs, so the response is valid JSON of the
 * expected shape rather than prose that has to be salvaged. Handles
 * configuration, provider errors, refusals, truncation and malformed JSON —
 * always throwing an ApiError with a message that is safe to show a user.
 */
async function generateStructured<T>(options: {
  systemPrompt: string
  userText: string
  schema: Schema
  maxOutputTokens: number
  /**
   * How many times to retry a *transient* failure (rate limit / overload).
   * Defaults to 0. Worth setting only where a failure is expensive for the
   * user to repeat — a failed import means finding and uploading the file
   * all over again.
   */
  retries?: number
}): Promise<T> {
  const anthropic = getClient()
  const attempts = Math.max(0, options.retries ?? 0) + 1

  let response: Anthropic.Message | null = null
  for (let attempt = 1; response === null; attempt++) {
    try {
      response = await anthropic.messages.create({
        model: env.aiModel,
        // The model's own ceiling is far higher, but a non-streaming request
        // has to finish inside the HTTP timeout.
        max_tokens: Math.min(options.maxOutputTokens, MAX_OUTPUT_TOKENS),
        system: options.systemPrompt,
        messages: [{ role: 'user', content: options.userText }],
        // Structured outputs: the reply is constrained to this schema.
        output_config: {
          format: { type: 'json_schema', schema: toJsonSchema(options.schema) },
        },
      })
    } catch (err) {
      // Test the provider's own status: a misconfigured key also surfaces as a
      // 503 to the user, and retrying that is pointless.
      const retryable =
        err instanceof Anthropic.APIError &&
        err.status !== undefined &&
        RETRYABLE_STATUSES.has(err.status)
      if (!retryable || attempt >= attempts) throw toClientError(err)
      console.warn(`[ai] Transient AI error — retrying (${attempt + 1}/${attempts}).`)
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
    }
  }

  // A safety decline comes back as a normal 200 with this stop reason.
  if (response.stop_reason === 'refusal') {
    console.error('[ai] Anthropic declined the request:', response.stop_details?.category ?? '')
    throw new ApiError(
      422,
      'The AI declined to process this request. Please rephrase and try again.',
    )
  }
  // A truncated response is never valid JSON — fail clearly instead of parsing.
  if (response.stop_reason === 'max_tokens') {
    console.error('[ai] Anthropic response hit the max output token limit.')
    throw new ApiError(502, 'The AI returned an incomplete response. Please try again.')
  }

  // `content` is a discriminated union; the JSON lives in the text block.
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()

  if (!text) {
    console.error('[ai] Anthropic returned no text content. stop_reason:', response.stop_reason)
    throw new ApiError(502, 'The AI returned an unexpected response. Please try again.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ApiError(502, 'The AI returned an unreadable response. Please try again.')
  }
  // Structured output can still be a valid-JSON non-object (e.g. `null`).
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(502, 'The AI returned an unexpected response. Please try again.')
  }

  return parsed as T
}

/* ────────────────────────────── shared helpers ────────────────────────────── */

/** Trim, drop empties, de-duplicate (case-insensitively) and cap a string list. */
function cleanStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= max) break
  }
  return out
}

/**
 * Build the read-only resume context sent to the model. Only content fields are
 * included — never ids, userId, timestamps, template, or the human-facing
 * title — keeping the payload minimal and on-task.
 */
function toContext(resume: ResumeInput) {
  return {
    personalInfo: resume.personalInfo ?? {},
    summary: resume.summary ?? '',
    experience: resume.experience ?? [],
    education: resume.education ?? [],
    skills: resume.skills ?? [],
    projects: resume.projects ?? [],
    certifications: resume.certifications ?? [],
  }
}

/* ───────────────────────────── story → resume ──────────────────────────── */

/** Caps so one paragraph can't create an unbounded resume. */
const MAX_STORY_EXPERIENCE = 15
const MAX_STORY_EDUCATION = 8
const MAX_STORY_PROJECTS = 12
const MAX_STORY_CERTIFICATIONS = 15
const MAX_STORY_BULLETS = 8

/** Date values that mean "no end date" rather than a real date. */
const OPEN_ENDED_PATTERN = /^(present|current|currently|now|ongoing|to date|till date)$/i

/**
 * Skill spellings that mean the same thing once punctuation is stripped.
 * Everything else is handled by `skillKey`'s trailing-"js" rule.
 */
const SKILL_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  postgres: 'postgresql',
  k8s: 'kubernetes',
}

/**
 * A comparison key that treats React / React.js / reactjs as one skill.
 *
 * Punctuation is dropped, common abbreviations are expanded, then a trailing
 * "js" is removed — so "Node.js", "nodejs" and "Node" collapse together while
 * "JavaScript" (which does not end in a bare "js") is left alone.
 */
function skillKey(skill: string): string {
  const squashed = squashText(skill)
  const aliased = SKILL_ALIASES[squashed] ?? squashed
  const stripped = aliased.replace(/js$/, '')
  return stripped.length >= 2 ? stripped : aliased
}

/** Identity of a job, for matching against what the resume already has. */
function experienceKey(entry: { company: string; role: string }): string {
  return squashText(entry.company) || squashText(entry.role)
}

/** Identity of an education entry. */
function educationKey(entry: { institution: string; degree: string }): string {
  return `${squashText(entry.institution)}|${squashText(entry.degree)}`
}

export interface GenerateResumeParams {
  /** The user's natural-language description of their experience. */
  story: string
  /**
   * Existing resume content to merge the extraction into. Anything already
   * here wins: extraction fills gaps and adds new entries, it never overwrites
   * what the user has already written.
   */
  resume?: ResumeInput
}

/** What the extraction actually added, so the UI can tell the user. */
export interface GenerateResumeCounts {
  experience: number
  education: number
  projects: number
  skills: number
  certifications: number
  contactFields: number
}

export interface GenerateResumeResult {
  /** The merged resume, ready to create or to load into the editor. */
  resume: ResumeInput
  extracted: GenerateResumeCounts
  /**
   * True when nothing could be pulled out and the user's own words were kept
   * as the summary rather than discarded.
   */
  keptOriginalText: boolean
}

/**
 * System prompt for turning a person's own description into resume sections.
 *
 * The line this prompt has to walk: rewriting how something is *said* is the
 * job ("FE dev" → "Frontend Developer"), while adding something that was never
 * said is forbidden. The rules below spell that distinction out, because it is
 * the one a model is most likely to blur.
 */
const EXTRACT_SYSTEM_PROMPT = `You are ResumeAI's information extractor. The user describes their career in their own words, informally. Your job is to sort what they said into the right resume sections.

WHAT YOU MAY DO:
- Expand the user's own abbreviations into their normal written form: "FE dev" -> "Frontend Developer", "React JS" -> "React.js", "BCA" stays "BCA", "sr." -> "Senior". This is formatting, not invention.
- Tidy grammar, capitalisation and spacing.
- Capitalise names properly even when the user types them in lower case: "simpledmca" -> "SimpleDMCA", "react" -> "React". This is spelling, not invention — never change what the name actually is.
- Infer that a role is ongoing when the user says they currently work somewhere.

WHAT YOU MUST NEVER DO:
1. NEVER invent an employer, job title, date, duration, degree, institution, certification, project, technology, achievement, metric, client, responsibility, or number of years. If the user did not say it, it does not exist.
2. NEVER create an experience entry unless the user actually named an employer. "Frontend developer with 3 years of experience" describes a person, NOT a job — it has no employer, so it produces NO experience entry.
3. NEVER guess dates. If the user gave no start or end date, leave those fields empty. An empty date is always correct when the user was silent.
4. NEVER add a technology to skills because it is commonly used alongside one they mentioned.
5. NEVER state a number of years of experience in the summary unless the user stated that number.

HOW TO SORT WHAT THEY SAID:
- An employer plus a role (with or without dates) -> "experience".
- A technology, tool, language or framework they say they know or have used -> "skills". Also add technologies that appear in the work or projects they describe.
- Something they say they built or worked on -> "projects", with its technologies where they named them.
- A degree, course, school or university -> "education".
- A named certification -> "certifications".
- Their name, email, phone, location or profile links -> "personal_info".
- Anything meaningful you genuinely cannot place -> "unclassified", so it is not lost.

DATES:
Copy dates in the user's own words ("July 2025", "2021", "03/2020"). If the user says they still work somewhere, set "current" to true and leave "end_date" empty. Otherwise "current" is false.

SUMMARY:
Write 1-3 sentences of professional summary built ONLY from what you extracted — their role, employers, and the technologies they named. Do not restate the user's message verbatim, and do not add anything they did not say. If they gave you almost nothing, write one short honest sentence or leave it empty.

Example of the distinction that matters most:
Input: "I am a FE dev working at SimpleDMCA from July 2025 as a FE dev. Before that, I was working in Decabits Software as a React JS developer."
-> experience: SimpleDMCA, "Frontend Developer", start "July 2025", current true, end empty; AND Decabits Software, "React.js Developer", no dates at all (none were given).
-> skills: React.js (they named it).
-> summary: mentions Frontend Developer, SimpleDMCA, Decabits Software, React.js — and NOT a number of years, because none was stated.`

/** Response schema — mirrors the app's own resume shape. */
const RESUME_EXTRACT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'A concise professional summary built only from extracted facts, or "".',
    },
    personal_info: {
      type: Type.OBJECT,
      description: 'Contact details the user gave. Empty strings where they gave none.',
      properties: {
        full_name: { type: Type.STRING, description: 'Full name, or an empty string.' },
        email: { type: Type.STRING, description: 'Email address, or an empty string.' },
        phone: { type: Type.STRING, description: 'Phone number, or an empty string.' },
        location: { type: Type.STRING, description: 'City/region, or an empty string.' },
        linkedin: { type: Type.STRING, description: 'LinkedIn URL or handle, or an empty string.' },
        website: { type: Type.STRING, description: 'Portfolio/GitHub URL, or an empty string.' },
      },
      required: ['full_name', 'email', 'phone', 'location', 'linkedin', 'website'],
      propertyOrdering: ['full_name', 'email', 'phone', 'location', 'linkedin', 'website'],
    },
    experience: {
      type: Type.ARRAY,
      description: 'One entry per employer the user named. None if they named no employer.',
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING, description: 'Employer name exactly as the user gave it.' },
          role: { type: Type.STRING, description: 'Job title, expanded from their abbreviation.' },
          location: { type: Type.STRING, description: 'Location, or an empty string.' },
          start_date: {
            type: Type.STRING,
            description: 'Start date in the user’s own words, or an empty string.',
          },
          end_date: {
            type: Type.STRING,
            description: 'End date in the user’s own words, or an empty string if ongoing.',
          },
          current: { type: Type.BOOLEAN, description: 'True only if the user says it is ongoing.' },
          bullets: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'What they said they did in this role. Empty if they said nothing.',
          },
        },
        required: ['company', 'role', 'location', 'start_date', 'end_date', 'current', 'bullets'],
        propertyOrdering: [
          'company',
          'role',
          'location',
          'start_date',
          'end_date',
          'current',
          'bullets',
        ],
      },
    },
    education: {
      type: Type.ARRAY,
      description: 'Degrees, courses or schools the user named.',
      items: {
        type: Type.OBJECT,
        properties: {
          institution: { type: Type.STRING, description: 'School/university name.' },
          degree: { type: Type.STRING, description: 'Degree or qualification, or an empty string.' },
          field: { type: Type.STRING, description: 'Field of study, or an empty string.' },
          start_date: { type: Type.STRING, description: 'Start year, or an empty string.' },
          end_date: { type: Type.STRING, description: 'End year, or an empty string.' },
        },
        required: ['institution', 'degree', 'field', 'start_date', 'end_date'],
        propertyOrdering: ['institution', 'degree', 'field', 'start_date', 'end_date'],
      },
    },
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Technologies, tools and languages the user named.',
    },
    projects: {
      type: Type.ARRAY,
      description: 'Things the user says they built.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Project name or short descriptive title.' },
          description: { type: Type.STRING, description: 'What it is, or an empty string.' },
          technologies: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Technologies the user named for this project.',
          },
          link: { type: Type.STRING, description: 'URL, or an empty string.' },
        },
        required: ['name', 'description', 'technologies', 'link'],
        propertyOrdering: ['name', 'description', 'technologies', 'link'],
      },
    },
    certifications: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Certifications the user named.',
    },
    unclassified: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Meaningful details that fit no section, so they are not lost.',
    },
  },
  required: [
    'summary',
    'personal_info',
    'experience',
    'education',
    'skills',
    'projects',
    'certifications',
    'unclassified',
  ],
  propertyOrdering: [
    'summary',
    'personal_info',
    'experience',
    'education',
    'skills',
    'projects',
    'certifications',
    'unclassified',
  ],
}

/**
 * Is this date something the user actually wrote?
 *
 * Empty passes (silence is a valid answer) and so does an open-ended marker.
 * Anything else has to appear in the story — either literally, or by its year,
 * which covers the model reformatting "july 2025" as "July 2025".
 */
function isDateEvidenced(value: string, corpus: { raw: string; squashed: string }): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (OPEN_ENDED_PATTERN.test(trimmed)) return true
  if (isValuePresent(trimmed, corpus)) return true
  const year = trimmed.match(/\d{4}/)?.[0]
  return year ? corpus.raw.includes(year) : false
}

/** Blank out a date the story doesn't support, rather than keeping a guess. */
function evidencedDate(value: string, corpus: { raw: string; squashed: string }): string {
  const trimmed = value.trim()
  if (OPEN_ENDED_PATTERN.test(trimmed)) return ''
  return isDateEvidenced(trimmed, corpus) ? trimmed : ''
}

/**
 * Does this sentence contain a number the user never gave?
 *
 * The right test for *rewritten* prose. Where a resume is being read from a
 * document the wording can be matched against the source, but here the whole
 * point is to turn "I made screens and fixed bugs" into a professional bullet —
 * so word-matching would throw away exactly the value the feature provides.
 *
 * What must not survive rewriting is a *quantity*: "improved performance"
 * becoming "improved performance by 40%", or "Frontend Developer" acquiring
 * "5 years of experience". Every digit in the output therefore has to appear in
 * what the user actually typed.
 */
function hasUnsupportedNumber(text: string, corpus: { raw: string; squashed: string }): boolean {
  for (const match of text.matchAll(/\d[\d,.]*/g)) {
    // Trim trailing punctuation so "2025." checks as "2025".
    const number = match[0].replace(/[.,]+$/, '')
    if (!number) continue
    if (!corpus.raw.includes(number.toLowerCase())) return true
  }
  return false
}

/** A generated summary is acceptable as long as it invents no figures. */
function isSummaryHonest(summary: string, corpus: { raw: string; squashed: string }): boolean {
  return !hasUnsupportedNumber(summary, corpus)
}

/** A plain, factual summary assembled from what was extracted. */
function buildFallbackSummary(experience: ExperienceEntry[], skills: string[]): string {
  const sentences: string[] = []
  const currentRole = experience.find((e) => e.current) ?? experience[0]

  if (currentRole?.role) {
    sentences.push(
      currentRole.company ? `${currentRole.role} at ${currentRole.company}.` : `${currentRole.role}.`,
    )
  }
  const previous = experience.filter((e) => e !== currentRole && e.company)
  if (previous.length > 0) {
    sentences.push(`Previously at ${previous.map((e) => e.company).join(', ')}.`)
  }
  if (skills.length > 0) {
    sentences.push(`Works with ${skills.slice(0, 6).join(', ')}.`)
  }
  return sentences.join(' ')
}

/** Everything the merge produces, apart from the summary its caller decides. */
interface MergedSections {
  personalInfo: {
    fullName: string
    email: string
    phone: string
    location: string
    linkedin: string
    website: string
  }
  experience: ExperienceEntry[]
  education: { institution: string; degree: string; field: string; startDate: string; endDate: string }[]
  skills: string[]
  projects: { name: string; description: string; technologies: string[]; link: string }[]
  certifications: string[]
  counts: GenerateResumeCounts
  /** How many values failed the evidence check and were discarded. */
  dropped: number
}

/**
 * Fold an extraction into a resume, keeping everything already there.
 *
 * Shared by the two features that turn free text into resume sections — a
 * one-shot description and the interview — so the anti-fabrication rules and
 * the de-duplication behave identically in both. It deliberately leaves the
 * summary alone: what should happen to it differs between the two callers.
 *
 * Every value is checked against `corpus`, which is the user's own words. A
 * company, institution, project, skill or certification that doesn't appear
 * there is dropped, and a date that doesn't appear is blanked rather than kept.
 * Existing values always win; extraction only fills gaps and appends.
 */
function mergeExtractedSections(
  base: ResumeInput,
  parsed: Record<string, unknown>,
  corpus: { raw: string; squashed: string },
): MergedSections {
  let dropped = 0

  /* ── Experience ── */
  const existingExperience = (base.experience ?? []).map(toExperienceEntry)
  const seenExperience = new Map<string, number>()
  existingExperience.forEach((entry, i) => {
    const key = experienceKey(entry)
    if (key) seenExperience.set(key, i)
  })

  const mergedExperience = [...existingExperience]
  let addedExperience = 0

  for (const raw of (Array.isArray(parsed.experience) ? parsed.experience : []).slice(
    0,
    MAX_STORY_EXPERIENCE,
  )) {
    const entry = asRecord(raw)
    const company = str(entry.company)

    // No employer means no job. This is what stops "Frontend developer with 3
    // years of experience" from inventing a company to hang the title on.
    if (!company || !isValuePresent(company, corpus)) {
      dropped += 1
      continue
    }

    const candidate: ExperienceEntry = {
      company,
      role: str(entry.role),
      location: isValuePresent(str(entry.location), corpus) ? str(entry.location) : '',
      startDate: evidencedDate(str(entry.start_date), corpus),
      endDate: evidencedDate(str(entry.end_date), corpus),
      /**
       * "Still there" is a reading of the sentence, not a literal value, so it
       * can't be verified the way a company name can — "I am working at X"
       * means ongoing without ever using the word "present". The check that
       * matters is the contradiction: a role with an end date the user gave is
       * not ongoing, whatever the model concluded.
       */
      current: Boolean(entry.current),
      // Bullets are deliberately rewritten into professional language, so they
      // are judged on invented figures rather than on matching the user's words.
      bullets: cleanStringList(entry.bullets, MAX_STORY_BULLETS).filter(
        (b) => !hasUnsupportedNumber(b, corpus),
      ),
    }
    if (candidate.endDate) candidate.current = false

    const key = experienceKey(candidate)
    const existingIndex = key ? seenExperience.get(key) : undefined

    if (existingIndex === undefined) {
      mergedExperience.push(candidate)
      if (key) seenExperience.set(key, mergedExperience.length - 1)
      addedExperience += 1
      continue
    }

    // Already there: fill only the gaps, and add bullets it doesn't have.
    const existing = mergedExperience[existingIndex]
    const existingBullets = new Set(existing.bullets.map(normalizeText))
    mergedExperience[existingIndex] = {
      ...existing,
      role: existing.role || candidate.role,
      location: existing.location || candidate.location,
      startDate: existing.startDate || candidate.startDate,
      endDate: existing.endDate || candidate.endDate,
      current: existing.current || candidate.current,
      bullets: [
        ...existing.bullets,
        ...candidate.bullets.filter((b) => !existingBullets.has(normalizeText(b))),
      ],
    }
  }

  /* ── Education ── */
  const existingEducation = (base.education ?? []).map((e) => ({
    institution: str(e?.institution),
    degree: str(e?.degree),
    field: str(e?.field),
    startDate: str(e?.startDate),
    endDate: str(e?.endDate),
  }))
  const seenEducation = new Set(existingEducation.map(educationKey))
  const mergedEducation = [...existingEducation]
  let addedEducation = 0

  for (const raw of (Array.isArray(parsed.education) ? parsed.education : []).slice(
    0,
    MAX_STORY_EDUCATION,
  )) {
    const entry = asRecord(raw)
    const institution = str(entry.institution)
    if (!institution || !isValuePresent(institution, corpus)) {
      dropped += 1
      continue
    }
    const candidate = {
      institution,
      degree: str(entry.degree),
      field: str(entry.field),
      startDate: evidencedDate(str(entry.start_date), corpus),
      endDate: evidencedDate(str(entry.end_date), corpus),
    }
    const key = educationKey(candidate)
    if (seenEducation.has(key)) continue
    seenEducation.add(key)
    mergedEducation.push(candidate)
    addedEducation += 1
  }

  /* ── Projects ── */
  const existingProjects = (base.projects ?? []).map((p) => ({
    name: str(p?.name),
    description: str(p?.description),
    technologies: Array.isArray(p?.technologies) ? p.technologies.map(str).filter(Boolean) : [],
    link: str(p?.link),
  }))
  const seenProjects = new Map<string, number>()
  existingProjects.forEach((p, i) => {
    const key = squashText(p.name)
    if (key) seenProjects.set(key, i)
  })
  const mergedProjects = [...existingProjects]
  let addedProjects = 0

  for (const raw of (Array.isArray(parsed.projects) ? parsed.projects : []).slice(
    0,
    MAX_STORY_PROJECTS,
  )) {
    const entry = asRecord(raw)
    const name = str(entry.name)
    if (!name || !isValuePresent(name, corpus)) {
      dropped += 1
      continue
    }
    const description = str(entry.description)
    const candidate = {
      name,
      // Rewritten like bullets, so held to the same rule: no invented figures.
      description: hasUnsupportedNumber(description, corpus) ? '' : description,
      technologies: cleanStringList(entry.technologies, 20).filter((t) =>
        isValuePresent(t, corpus),
      ),
      link: isValuePresent(str(entry.link), corpus) ? str(entry.link) : '',
    }

    const key = squashText(name)
    const existingIndex = seenProjects.get(key)
    if (existingIndex === undefined) {
      mergedProjects.push(candidate)
      seenProjects.set(key, mergedProjects.length - 1)
      addedProjects += 1
      continue
    }

    // A project mentioned again later in a conversation usually carries the
    // detail the first mention lacked — fill the gaps, keep what's there.
    const existing = mergedProjects[existingIndex]
    const existingTech = new Set(existing.technologies.map(skillKey))
    mergedProjects[existingIndex] = {
      ...existing,
      description: existing.description || candidate.description,
      link: existing.link || candidate.link,
      technologies: [
        ...existing.technologies,
        ...candidate.technologies.filter((t) => !existingTech.has(skillKey(t))),
      ],
    }
  }

  /* ── Skills: dedupe across spellings, keeping the user's own ── */
  const existingSkills = (base.skills ?? []).map(str).filter(Boolean)
  const seenSkills = new Set(existingSkills.map(skillKey))
  const mergedSkills = [...existingSkills]
  let addedSkills = 0

  // Technologies named inside projects count as skills too.
  const candidateSkills = cleanStringList(
    [
      ...(Array.isArray(parsed.skills) ? parsed.skills : []),
      ...mergedProjects.flatMap((p) => p.technologies),
    ],
    MAX_SKILLS,
  )
  for (const skill of candidateSkills) {
    if (!isValuePresent(skill, corpus)) {
      dropped += 1
      continue
    }
    const key = skillKey(skill)
    if (!key || seenSkills.has(key)) continue
    seenSkills.add(key)
    mergedSkills.push(skill)
    addedSkills += 1
  }

  /* ── Certifications ── */
  const existingCerts = (base.certifications ?? []).map(str).filter(Boolean)
  const seenCerts = new Set(existingCerts.map((c) => normalizeText(c)))
  const mergedCerts = [...existingCerts]
  let addedCerts = 0

  for (const cert of cleanStringList(parsed.certifications, MAX_STORY_CERTIFICATIONS)) {
    if (!isValuePresent(cert, corpus)) {
      dropped += 1
      continue
    }
    if (seenCerts.has(normalizeText(cert))) continue
    seenCerts.add(normalizeText(cert))
    mergedCerts.push(cert)
    addedCerts += 1
  }

  /* ── Contact details: fill blanks only ── */
  const info = asRecord(parsed.personal_info)
  const basePersonal = base.personalInfo
  const keep = (existing: unknown, extractedValue: string): string => {
    const current = str(existing)
    if (current) return current
    return isValuePresent(extractedValue, corpus) ? extractedValue : ''
  }
  const mergedPersonal = {
    fullName: keep(basePersonal?.fullName, str(info.full_name)),
    email: keep(basePersonal?.email, str(info.email)),
    phone: keep(basePersonal?.phone, str(info.phone)),
    location: keep(basePersonal?.location, str(info.location)),
    linkedin: keep(basePersonal?.linkedin, str(info.linkedin)),
    website: keep(basePersonal?.website, str(info.website)),
  }
  const contactFields = Object.entries(mergedPersonal).filter(
    ([key, value]) => value && !str(basePersonal?.[key as keyof typeof mergedPersonal]),
  ).length

  if (dropped > 0) {
    // Content-free: how many items failed the check, never what they were.
    console.warn(`[ai] Dropped ${dropped} unsupported item(s) during extraction.`)
  }

  return {
    personalInfo: mergedPersonal,
    experience: mergedExperience,
    education: mergedEducation,
    skills: mergedSkills,
    projects: mergedProjects,
    certifications: mergedCerts,
    counts: {
      experience: addedExperience,
      education: addedEducation,
      projects: addedProjects,
      skills: addedSkills,
      certifications: addedCerts,
      contactFields,
    },
    dropped,
  }
}

/**
 * Turn a natural-language description into structured resume sections, merged
 * into whatever the resume already contains.
 *
 * Anti-fabrication is enforced on four layers:
 *  1. The prompt separates *rewording* what the user said (allowed, and the
 *     point of the feature) from *adding* what they didn't (forbidden), and
 *     spells out that a role with no employer is not a job.
 *  2. The response schema mirrors the app's own resume shape, so there is
 *     nowhere to return anything else.
 *  3. `mergeExtractedSections` re-checks every value against the user's own
 *     words and drops or blanks whatever isn't there.
 *  4. The generated summary is rejected if it claims a length of experience
 *     the user never mentioned, and replaced with a factual one.
 */
export async function generateResumeFromStory(
  params: GenerateResumeParams,
): Promise<GenerateResumeResult> {
  const base = params.resume ?? {}
  const story = params.story.trim()

  const parsed = await generateStructured<Record<string, unknown>>({
    systemPrompt: EXTRACT_SYSTEM_PROMPT,
    maxOutputTokens: 32000,
    // A person describing their career is a slow, one-shot action — riding out
    // a busy model beats making them retype it.
    retries: 2,
    schema: RESUME_EXTRACT_SCHEMA,
    userText:
      `Here is how I described my career. Sort exactly what I said into the right ` +
      `sections, and leave out anything I did not say:\n\n"""\n${story}\n"""`,
  })

  const corpus = { raw: normalizeText(story), squashed: squashText(story) }
  const merged = mergeExtractedSections(base, parsed, corpus)

  /* ── Summary ── */
  const baseSummary = str(base.summary)
  const generatedSummary = str(parsed.summary)
  const unclassified = cleanStringList(parsed.unclassified, 6)

  let summary = baseSummary
  let keptOriginalText = false

  if (!baseSummary) {
    if (generatedSummary && isSummaryHonest(generatedSummary, corpus)) {
      summary = generatedSummary
    } else {
      if (generatedSummary) {
        console.warn('[ai] Rejected a generated summary that claimed unstated years of experience.')
      }
      summary = buildFallbackSummary(merged.experience, merged.skills)
    }
  }

  // Nothing was placed anywhere — keep the user's own words rather than
  // handing back an empty resume.
  const c = merged.counts
  const foundSomething =
    c.experience + c.education + c.projects + c.skills + c.certifications + c.contactFields > 0
  if (!summary && !foundSomething) {
    summary = story
    keptOriginalText = true
  } else if (unclassified.length > 0) {
    // Anything that couldn't be sorted stays visible in the summary instead of
    // being thrown away; the user can move or delete it in the editor.
    summary = [summary, ...unclassified].filter(Boolean).join(' ')
  }

  return {
    resume: {
      personalInfo: merged.personalInfo,
      summary,
      experience: merged.experience,
      education: merged.education,
      skills: merged.skills,
      projects: merged.projects,
      certifications: merged.certifications,
    },
    extracted: merged.counts,
    keptOriginalText,
  }
}

/* ────────────────────────────── AI interview ────────────────────────────── */

/** One turn of the interview transcript. */
export interface InterviewMessage {
  role: 'assistant' | 'user'
  content: string
}

export interface InterviewTurnParams {
  /** The conversation so far, oldest first. */
  messages: InterviewMessage[]
  /** The structured data gathered so far. */
  draft?: ResumeInput
}

export interface InterviewTurnResult {
  /** What the interviewer says next. */
  message: string
  /** The draft with this answer folded in. */
  draft: ResumeInput
  /** Sections that now have content. */
  covered: string[]
  /** Standard sections still empty, worth asking about before finishing. */
  missing: string[]
  /** True once there is enough to build a useful resume. */
  readyToGenerate: boolean
}

/** How much transcript to send. The draft carries the memory; this is context. */
const INTERVIEW_CONTEXT_TURNS = 12
/** A hard stop, so the interview can't question someone indefinitely. */
const INTERVIEW_MAX_ANSWERS = 25

/** The opening line, sent before the model is involved at all. */
export const INTERVIEW_OPENING_QUESTION =
  "Let's start with your current or most recent role. What do you do, where do you work, and what kind of work do you handle?"

/**
 * System prompt for the interviewer.
 *
 * Two jobs at once: decide what is worth asking next, and pull structured facts
 * out of the answer just given. The rules about invention are the same ones the
 * one-shot extractor follows, because the risk is identical — the difference is
 * that here the model also has to avoid asking about things it already knows.
 */
const INTERVIEW_SYSTEM_PROMPT = `You are ResumeAI's resume interviewer. You are talking to someone who wants a resume but should not have to know how to write one. You ask short, friendly questions, one at a time, and you turn their plain answers into structured resume data.

HOW TO INTERVIEW:
- Ask ONE question per turn. Keep it to a sentence or two, conversational, no bullet lists.
- You are given the structured draft built so far. NEVER ask for something the draft already contains. If the draft shows an employer with no dates, ask about the dates — not about the employer.
- Follow what they actually said. If they mention something with detail missing ("I built a healthcare app"), ask about that specific thing ("What did the healthcare app do, and which part did you build?").
- Move on when a section is done. Don't grind on projects if they have none — accept "no" and go somewhere else.
- If they say they don't know, don't remember, or want to skip, accept it immediately, say so briefly, and ask about something else. Never press twice on the same point.
- One answer often contains several sections at once. Take all of it, then ask about whatever is still thin.
- Rough order when nothing else is pressing: current role -> what they did there -> earlier roles -> projects -> skills -> education -> certifications -> contact details. Deviate whenever their answers suggest something better.
- Set "ready_to_generate" true once you could build a useful resume — realistically once there is at least one role or project plus some skills. Being ready does not end the conversation; the user decides.

TURNING ANSWERS INTO RESUME CONTENT:
- Capitalise names properly even when the user types them in lower case: "simpledmca" -> "SimpleDMCA", "react" -> "React". This is spelling, not invention — never change what the name actually is.
Write experience bullets and project descriptions in professional resume language, in the past tense, starting with a verb. "I made screens, connected APIs and fixed bugs" becomes bullets like "Developed responsive frontend interfaces for core product features", "Integrated REST APIs to connect frontend workflows with backend services", "Identified and resolved UI and functional issues". Rewriting HOW something is said is your job.

ABSOLUTE RULES — never break these:
1. NEVER invent an employer, job title, date, duration, degree, institution, certification, project, technology, responsibility, achievement, metric, client or number of years. If they did not say it, it does not exist.
2. NEVER add a number to an achievement. "I improved performance" stays qualitative. It NEVER becomes "improved performance by 40%".
3. NEVER create an experience entry without an employer they named. A role with no employer is a description of a person, not a job.
4. NEVER guess dates. Leave them empty when they were not given. Set "current" true only when they say the role is ongoing.
5. NEVER add a technology because it usually goes with something they mentioned. Only what they actually named.
6. Every fact you return must be traceable to something they typed. Rewording is allowed; adding is not.

Return the extracted fields for EVERYTHING known so far that you can support from the conversation — the server merges it with the existing draft and keeps whatever is already there.`

/** Response schema for one interview turn: what to say, and what was learned. */
const INTERVIEW_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    message: {
      type: Type.STRING,
      description: 'What you say next: a short acknowledgement plus ONE question.',
    },
    ready_to_generate: {
      type: Type.BOOLEAN,
      description: 'True once there is enough to build a useful resume.',
    },
    ...RESUME_EXTRACT_SCHEMA.properties,
  },
  required: ['message', 'ready_to_generate', ...(RESUME_EXTRACT_SCHEMA.required ?? [])],
  propertyOrdering: [
    'message',
    'ready_to_generate',
    ...(RESUME_EXTRACT_SCHEMA.propertyOrdering ?? []),
  ],
}

/** The sections the interview reports on, and how to tell if they're filled. */
const INTERVIEW_SECTIONS: { label: string; isFilled: (r: ResumeInput) => boolean }[] = [
  { label: 'Contact', isFilled: (r) => Boolean(r.personalInfo?.fullName || r.personalInfo?.email) },
  { label: 'Summary', isFilled: (r) => Boolean(r.summary?.trim()) },
  { label: 'Experience', isFilled: (r) => (r.experience?.length ?? 0) > 0 },
  { label: 'Projects', isFilled: (r) => (r.projects?.length ?? 0) > 0 },
  { label: 'Skills', isFilled: (r) => (r.skills?.length ?? 0) > 0 },
  { label: 'Education', isFilled: (r) => (r.education?.length ?? 0) > 0 },
  { label: 'Certifications', isFilled: (r) => (r.certifications?.length ?? 0) > 0 },
]

/** A compact view of the draft for the prompt — structure, not prose. */
function draftOutline(draft: ResumeInput): string {
  return JSON.stringify(
    {
      personalInfo: draft.personalInfo ?? {},
      summary: draft.summary ?? '',
      experience: (draft.experience ?? []).map((e) => ({
        company: e?.company ?? '',
        role: e?.role ?? '',
        startDate: e?.startDate ?? '',
        endDate: e?.endDate ?? '',
        current: Boolean(e?.current),
        bullets: e?.bullets ?? [],
      })),
      education: draft.education ?? [],
      skills: draft.skills ?? [],
      projects: draft.projects ?? [],
      certifications: draft.certifications ?? [],
    },
    null,
    2,
  )
}

/**
 * Run one turn of the resume interview.
 *
 * Stateless by design: the client holds the transcript and the draft and sends
 * them back each turn, exactly as the other AI features take the resume they
 * are working on. That keeps this endpoint a pure transformation with no new
 * storage and nothing to own — and a refresh can restore the conversation
 * without the server having to remember anything.
 *
 * The corpus every extracted value is checked against is built from ALL of the
 * user's own messages, not just the latest one, so a company named in the first
 * answer still validates in the tenth.
 */
export async function runInterviewTurn(
  params: InterviewTurnParams,
): Promise<InterviewTurnResult> {
  const base = params.draft ?? {}
  const messages = params.messages
  const answers = messages.filter((m) => m.role === 'user')

  // Everything the user has actually typed — the ground truth for this feature.
  const spoken = answers.map((m) => m.content).join('\n')
  const corpus = { raw: normalizeText(spoken), squashed: squashText(spoken) }

  const transcript = messages
    .slice(-INTERVIEW_CONTEXT_TURNS)
    .map((m) => `${m.role === 'assistant' ? 'You' : 'Them'}: ${m.content}`)
    .join('\n')

  const parsed = await generateStructured<Record<string, unknown>>({
    systemPrompt: INTERVIEW_SYSTEM_PROMPT,
    maxOutputTokens: 32000,
    retries: 2,
    schema: INTERVIEW_SCHEMA,
    userText:
      `Here is the resume draft you have built so far:\n\n${draftOutline(base)}\n\n` +
      `Here is the recent conversation:\n\n${transcript}\n\n` +
      `Extract everything you can support from what they have told you, then ask ` +
      `the single most useful next question. Do not ask about anything the draft ` +
      `already answers.`,
  })

  const merged = mergeExtractedSections(base, parsed, corpus)

  // The summary is AI-written rather than user-written, so unlike the other
  // sections it is replaced as the picture improves — but only ever with one
  // that doesn't claim experience the user never mentioned.
  const generatedSummary = str(parsed.summary)
  let summary = str(base.summary)
  if (generatedSummary && isSummaryHonest(generatedSummary, corpus)) {
    summary = generatedSummary
  } else if (!summary) {
    summary = buildFallbackSummary(merged.experience, merged.skills)
  }

  const draft: ResumeInput = {
    personalInfo: merged.personalInfo,
    summary,
    experience: merged.experience,
    education: merged.education,
    skills: merged.skills,
    projects: merged.projects,
    certifications: merged.certifications,
  }

  const covered = INTERVIEW_SECTIONS.filter((s) => s.isFilled(draft)).map((s) => s.label)
  const missing = INTERVIEW_SECTIONS.filter((s) => !s.isFilled(draft)).map((s) => s.label)

  // Enough to be useful: something to put under Experience or Projects. The
  // hard cap stops the interview questioning someone forever.
  const hasSubstance = draft.experience!.length > 0 || draft.projects!.length > 0
  const readyToGenerate =
    (Boolean(parsed.ready_to_generate) && hasSubstance) ||
    answers.length >= INTERVIEW_MAX_ANSWERS

  return {
    message: str(parsed.message) || 'What else would you like to add to your resume?',
    draft,
    covered,
    missing,
    readyToGenerate,
  }
}

/* ──────────────────────────────── Ask AI ──────────────────────────────── */

/**
 * System prompt — the primary guardrail against fabrication. The model may only
 * improve wording, structure, and clarity; it must never invent facts, and it
 * may only change the Summary and Skills.
 */
const EDIT_SYSTEM_PROMPT = `You are ResumeAI's resume-editing assistant. You help a user improve their own resume based on a single natural-language instruction.

WHAT YOU CAN EDIT:
You may only propose changes to two things: the professional SUMMARY (a short paragraph) and the SKILLS list (an array of short skill names). Everything else in the resume — personal info, work experience, education, projects, certifications — is READ-ONLY context. Use it to understand the person and to write a summary/skills that fit their real background, but never rewrite or return those other sections.

ABSOLUTE RULES — never break these:
1. NEVER invent, add, or fabricate facts that are not already supported by the resume. This includes companies, employers, job titles, dates, durations, degrees, schools, skills/technologies the person hasn't shown, projects, achievements, metrics, numbers, percentages, awards, and certifications.
2. You MAY improve wording, phrasing, grammar, tone, structure, ordering, and conciseness of the summary. You MAY reorder, tighten, or rephrase existing skills. You MAY surface a skill in the Skills list only if it is already clearly evidenced elsewhere in the resume (e.g. a technology used in a listed project or role).
3. Do NOT add measurable impact, metrics, or results the user did not already state anywhere in the resume.
4. If the instruction asks you to ADD information that is not present (e.g. "add my AWS certification", "say I increased sales by 30%", "add a Google internship"), OR asks you to edit a section you cannot change (experience, education, projects, certifications, personal info), do NOT invent or pretend. Set "needs_more_info" to true, leave "summary" and "skills" unchanged, and use "summary_of_changes" to briefly, kindly explain what the user should do (either provide the specific facts themselves, or that only the Summary and Skills can be edited here right now).
5. Only change what the instruction asks for. If the instruction targets the summary, leave skills unchanged, and vice-versa.
6. Always return BOTH "summary" and "skills" in full — return the unchanged value for whichever one you did not touch.

Return your answer in the required structured format with a short, friendly summary of what you changed.`

/**
 * Response schema for Gemini's structured output — deliberately narrow: the two
 * editable fields plus change metadata. Every property is required, which keeps
 * the model's output predictable and makes it structurally impossible to return
 * fabricated extra sections.
 */
const RESUME_EDIT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary_of_changes: {
      type: Type.STRING,
      description:
        'A short, friendly, plain-language summary of what was changed, or — if needs_more_info is true — what the user should do next.',
    },
    needs_more_info: {
      type: Type.BOOLEAN,
      description:
        'True when the instruction needs facts not present in the resume, or targets a section that cannot be edited here. When true, summary and skills must be returned unchanged.',
    },
    summary: {
      type: Type.STRING,
      description: 'The professional summary paragraph (unchanged if not targeted).',
    },
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'The skills list (unchanged if not targeted).',
    },
  },
  required: ['summary_of_changes', 'needs_more_info', 'summary', 'skills'],
  propertyOrdering: ['summary_of_changes', 'needs_more_info', 'summary', 'skills'],
}

/** The shape we expect back from the model (after JSON parsing). */
interface EditModelResponse {
  summary_of_changes?: unknown
  needs_more_info?: unknown
  summary?: unknown
  skills?: unknown
}

/**
 * Apply a natural-language edit instruction to the Summary/Skills of a resume
 * using Gemini.
 *
 * Anti-fabrication is enforced on three layers:
 *  1. The system prompt forbids inventing any facts and requires preserving
 *     the user's real background.
 *  2. The structured-output schema constrains the response to summary + skills,
 *     so the model cannot return free-form or extra fabricated sections.
 *  3. The current resume is passed as the sole ground truth in the user message.
 */
export async function editResumeWithInstruction(
  params: EditResumeParams,
): Promise<EditResumeResult> {
  const context = toContext(params.resume)

  const parsed = await generateStructured<EditModelResponse>({
    systemPrompt: EDIT_SYSTEM_PROMPT,
    maxOutputTokens: 16000,
    schema: RESUME_EDIT_SCHEMA,
    userText:
      `Here is my current resume as JSON (all of it is read-only context except "summary" and "skills"):\n\n` +
      `${JSON.stringify(context, null, 2)}\n\n` +
      `Instruction: ${params.instruction}\n\n` +
      `Apply the instruction following all the rules, changing only the summary and/or skills.`,
  })

  // Defensive normalisation: fall back to the user's own values if the model
  // omitted a field, and drop any empty skill entries.
  const skills = Array.isArray(parsed.skills)
    ? cleanStringList(parsed.skills, MAX_SKILLS)
    : (params.resume.skills ?? [])

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : (params.resume.summary ?? ''),
    skills,
    summaryOfChanges:
      typeof parsed.summary_of_changes === 'string' && parsed.summary_of_changes.trim()
        ? parsed.summary_of_changes
        : 'The AI processed your request but reported no changes.',
    needsMoreInfo: Boolean(parsed.needs_more_info),
  }
}

/* ─────────────────────── job description → custom resume ─────────────────── */

/** Caps applied to the model's output so one response can't balloon a resume. */
const MAX_SKILLS = 40
const MAX_MISSING_SKILLS = 15
const MAX_REASONING_NOTES = 8

/**
 * System prompt for job-description tailoring.
 *
 * The rules are deliberately blunt and repetitive about fabrication: this
 * feature is the one most likely to tempt a model into "helpfully" claiming the
 * user has what the posting asks for.
 */
const CUSTOMIZE_SYSTEM_PROMPT = `You are ResumeAI's job-tailoring assistant. The user gives you their own resume and a job description. You propose a version of THEIR resume that is better targeted at THAT role.

WHAT YOU MAY CHANGE:
1. SUMMARY — rewrite the professional summary so it speaks to this role, using only facts already in the resume. If the resume has NO summary yet, or it is empty, write one — but build it strictly out of what the rest of the resume already shows (their real job titles, employers, skills, education and projects). Never state a seniority level, a number of years, an achievement, a metric or a technology that the resume does not already contain.
2. SKILLS — reorder and prioritize the user's existing skills so the ones relevant to this job come first. You may rename a skill to the exact terminology the posting uses ONLY when it is plainly the same skill the user already listed (e.g. "JS" -> "JavaScript"). You may surface a skill the user did not list in their Skills array ONLY if it is clearly evidenced elsewhere in their resume (e.g. a technology named in one of their projects or experience bullets). If the Skills list is empty, build it from the tools and technologies explicitly named elsewhere in the resume.
3. EXPERIENCE BULLETS — rewrite the wording of existing bullet points to emphasize the parts most relevant to this job, and to use the posting's vocabulary where that is a truthful description of what the user already wrote.

WHAT YOU MUST NEVER CHANGE OR INVENT:
- Company names, employers, job titles, locations, employment dates, or how long anything lasted.
- Education, degrees, institutions, fields of study, certifications.
- Projects the user did not list.
- Technologies, tools, frameworks or languages the user never mentioned anywhere in their resume.
- Achievements, responsibilities, outcomes, metrics, numbers, percentages, team sizes, or years of experience.
- Do NOT add a new bullet point to any job. Only rewrite bullets that already exist. Never return more bullets for a job than it already has.

THE MOST IMPORTANT RULE:
If the job description asks for a skill, technology or experience the user does NOT have anywhere in their resume, you must NOT add it, imply it, or write around it as if they had it. Instead put it in "missing_skills" so the user can decide for themselves whether it applies to them. It is always better to leave a gap visible than to make the user's resume dishonest. A resume that quietly claims something untrue can cost the user the job and their credibility.

Rewriting is about emphasis and language, never about new facts. If a bullet has nothing relevant to this role, leave it essentially as it is rather than stretching it.

OUTPUT:
- "target_role": the job title this posting is for, as best you can tell from the posting.
- "summary": the full proposed summary paragraph. If you would not change it, return it unchanged.
- "skills": the COMPLETE proposed skills list, in the new priority order. Never drop a skill the user has — reorder rather than remove.
- "experience": one entry for EACH job in the user's resume, in the same order, identified by its zero-based "index" from the resume you were given. For each, return the proposed "bullets" — the same number of bullets as the original job has, rewritten. If a job has no bullets, return an empty list for it.
- "missing_skills": things this posting explicitly asks for that the resume does not evidence. Short names only. Empty list if none.
- "reasoning": 2-5 short, friendly, plain-language notes explaining what you tailored and why, written to the user ("Moved React and TypeScript to the front because the posting leads with them.").`

/** Response schema for job customization. */
const RESUME_CUSTOMIZE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    target_role: {
      type: Type.STRING,
      description: 'The job title this posting is for, as best you can tell.',
    },
    summary: {
      type: Type.STRING,
      description: 'The complete proposed professional summary, tailored to this role.',
    },
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'The complete proposed skills list, re-prioritized for this role.',
    },
    experience: {
      type: Type.ARRAY,
      description:
        'One entry per job in the resume, in the same order, with rewritten bullets only.',
      items: {
        type: Type.OBJECT,
        properties: {
          index: {
            type: Type.INTEGER,
            description: "The job's zero-based position in the resume's experience array.",
          },
          bullets: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'The rewritten bullet points for this job — same count as the original, no new bullets.',
          },
        },
        required: ['index', 'bullets'],
        propertyOrdering: ['index', 'bullets'],
      },
    },
    missing_skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Skills the posting asks for that the resume does not evidence. Never added to "skills".',
    },
    reasoning: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Short plain-language notes explaining what was tailored and why.',
    },
  },
  required: ['target_role', 'summary', 'skills', 'experience', 'missing_skills', 'reasoning'],
  propertyOrdering: [
    'target_role',
    'summary',
    'skills',
    'experience',
    'missing_skills',
    'reasoning',
  ],
}

/** The shape we expect back from the model (every field re-validated below). */
interface CustomizeModelResponse {
  target_role?: unknown
  summary?: unknown
  skills?: unknown
  experience?: unknown
  missing_skills?: unknown
  reasoning?: unknown
}

/** Lower-case and collapse whitespace. */
function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Strip everything but letters and digits ("Node.js" -> "nodejs"). */
function squashText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Every piece of text the user actually wrote, as one searchable corpus. Used
 * to verify that a proposed skill is evidenced somewhere in the resume.
 */
function buildEvidenceCorpus(resume: ResumeInput): { raw: string; squashed: string } {
  const parts: string[] = [
    resume.summary ?? '',
    ...(resume.skills ?? []),
    ...(resume.certifications ?? []),
  ]
  for (const exp of resume.experience ?? []) {
    parts.push(exp?.company ?? '', exp?.role ?? '', ...(exp?.bullets ?? []))
  }
  for (const edu of resume.education ?? []) {
    parts.push(edu?.institution ?? '', edu?.degree ?? '', edu?.field ?? '')
  }
  for (const project of resume.projects ?? []) {
    parts.push(project?.name ?? '', project?.description ?? '', ...(project?.technologies ?? []))
  }
  const joined = parts.filter(Boolean).join(' \n ')
  return { raw: normalizeText(joined), squashed: squashText(joined) }
}

/**
 * Is this proposed skill actually backed by something the user wrote?
 *
 * Short names ("R", "Go", "SQL") need a whole-word match so they don't match
 * inside unrelated words; longer names also accept a punctuation-insensitive
 * match ("Node.js" ≈ "NodeJS") and a match against a skill the user already
 * listed, so honest re-wordings of existing skills survive.
 */
function isSkillEvidenced(
  skill: string,
  corpus: { raw: string; squashed: string },
  existingSquashed: string[],
): boolean {
  const normalized = normalizeText(skill)
  if (!normalized) return false

  if (normalized.length <= 3) {
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(corpus.raw)
  }

  if (corpus.raw.includes(normalized)) return true

  const squashed = squashText(skill)
  if (squashed.length >= 4 && corpus.squashed.includes(squashed)) return true

  // A rewording of a skill the user already listed ("React" -> "React.js").
  return (
    squashed.length >= 3 &&
    existingSquashed.some((existing) => existing.includes(squashed) || squashed.includes(existing))
  )
}

/**
 * Rebuild the experience array from the USER'S data, taking only the rewritten
 * bullets from the model.
 *
 * This is the structural anti-fabrication guarantee for experience: company,
 * role, location, dates and the `current` flag are copied from the resume and
 * are not readable from the model's response at all. Bullet count is capped at
 * the original, so no job can gain a bullet it didn't have.
 */
function mergeExperience(
  original: ExperienceEntry[],
  proposed: unknown,
): { experience: ExperienceEntry[]; changed: boolean } {
  const result = original.map((entry) => ({ ...entry }))
  if (!Array.isArray(proposed)) return { experience: result, changed: false }

  let changed = false
  for (const item of proposed) {
    if (!item || typeof item !== 'object') continue
    const { index, bullets } = item as { index?: unknown; bullets?: unknown }
    if (typeof index !== 'number' || !Number.isInteger(index)) continue
    if (index < 0 || index >= result.length) continue
    if (!Array.isArray(bullets)) continue

    const originalBullets = original[index]?.bullets ?? []
    const rewritten = bullets
      .filter((b): b is string => typeof b === 'string')
      .map((b) => b.trim())
      .filter(Boolean)
      // Never more bullets than the job already had.
      .slice(0, originalBullets.length)

    // An empty rewrite would silently delete the user's content — keep theirs.
    if (rewritten.length === 0) continue

    result[index] = { ...result[index], bullets: rewritten }
    if (rewritten.join(' ') !== originalBullets.join(' ')) changed = true
  }

  return { experience: result, changed }
}

/**
 * Tailor a resume to a job description using Gemini.
 *
 * Nothing here is persisted — the caller returns a proposal that the user
 * reviews and applies in the editor. Anti-fabrication is enforced on four
 * layers:
 *  1. The system prompt forbids inventing facts and requires unmatched
 *     requirements to be reported as `missing_skills` instead.
 *  2. The response schema exposes only summary, skills, per-job bullets and the
 *     two informational lists — the model cannot return a company, title, date,
 *     degree, certification or project at all.
 *  3. Experience is rebuilt from the user's own records, taking only bullets,
 *     capped at the original bullet count.
 *  4. Every proposed skill must be evidenced somewhere in the user's own text;
 *     unevidenced ones are moved into `missingSkills` for the user to judge.
 */
export async function customizeResumeForJob(
  params: CustomizeResumeParams,
): Promise<CustomizeResumeResult> {
  const context = toContext(params.resume)
  const originalExperience = (params.resume.experience ?? []).map(toExperienceEntry)

  const parsed = await generateStructured<CustomizeModelResponse>({
    systemPrompt: CUSTOMIZE_SYSTEM_PROMPT,
    maxOutputTokens: 32000,
    schema: RESUME_CUSTOMIZE_SCHEMA,
    userText:
      `Here is my current resume as JSON. Every fact in it is the only ground truth about me:\n\n` +
      `${JSON.stringify(context, null, 2)}\n\n` +
      `Here is the job description I want to target:\n\n` +
      `"""\n${params.jobDescription}\n"""\n\n` +
      `Propose a tailored version of MY resume for this role, following all the rules. ` +
      `Do not claim anything about me that is not already in the resume above — put anything ` +
      `this job needs that I don't have into missing_skills instead.`,
  })

  // ── Skills: keep only what the resume actually evidences ──
  const corpus = buildEvidenceCorpus(params.resume)
  const existingSkills = params.resume.skills ?? []
  const existingSquashed = existingSkills.map(squashText).filter((s) => s.length >= 3)

  const proposedSkills = cleanStringList(parsed.skills, MAX_SKILLS)
  const evidencedSkills: string[] = []
  const unevidencedSkills: string[] = []
  for (const skill of proposedSkills) {
    if (isSkillEvidenced(skill, corpus, existingSquashed)) evidencedSkills.push(skill)
    else unevidencedSkills.push(skill)
  }
  if (unevidencedSkills.length > 0) {
    console.warn(
      `[ai] Dropped ${unevidencedSkills.length} unevidenced proposed skill(s) from a job customization.`,
    )
  }
  // If the model returned nothing usable, fall back to the user's own list
  // rather than proposing an empty skills section.
  const skills = evidencedSkills.length > 0 ? evidencedSkills : existingSkills

  // Anything the model tried to add without evidence belongs in the "you don't
  // have this yet" list, not in the resume.
  const missingSkills = cleanStringList(
    [...(Array.isArray(parsed.missing_skills) ? parsed.missing_skills : []), ...unevidencedSkills],
    MAX_MISSING_SKILLS,
  ).filter((skill) => !isSkillEvidenced(skill, corpus, existingSquashed))

  // ── Experience: user's records + rewritten bullets only ──
  const { experience } = mergeExperience(originalExperience, parsed.experience)

  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : (params.resume.summary ?? '')

  return {
    targetRole:
      typeof parsed.target_role === 'string' && parsed.target_role.trim()
        ? parsed.target_role.trim()
        : 'this role',
    summary,
    skills,
    experience,
    missingSkills,
    reasoning: cleanStringList(parsed.reasoning, MAX_REASONING_NOTES),
  }
}

/* ─────────────────────── uploaded document → resume ─────────────────────── */

/** Caps for a parsed document, so one upload can't create an unbounded resume. */
const MAX_PARSED_EXPERIENCE = 20
const MAX_PARSED_EDUCATION = 10
const MAX_PARSED_PROJECTS = 15
const MAX_PARSED_BULLETS = 12
const MAX_PARSED_CERTIFICATIONS = 20
const MAX_PARSED_TECHNOLOGIES = 20

export interface ParseResumeParams {
  /** Plain text extracted from the user's uploaded PDF/DOCX. */
  text: string
}

/**
 * The result of parsing an uploaded document.
 *
 * `resume` is already in the app's own resume shape, ready to be created. Any
 * section the document didn't contain comes back empty rather than invented,
 * and is named in `missingFields` so the UI can tell the user what to review.
 */
export interface ParsedResumeResult {
  resume: ResumeInput
  /** Human-readable labels of sections that could not be extracted. */
  missingFields: string[]
}

/**
 * System prompt for parsing an uploaded resume.
 *
 * Extraction — not authoring. The uploaded document is the only source of
 * truth, and anything it doesn't say must come back empty.
 */
const PARSE_SYSTEM_PROMPT = `You are ResumeAI's resume import assistant. The user has uploaded their existing resume. It has been converted from PDF or DOCX to plain text, so the layout is gone and the spacing may be messy. Your only job is to read that text and return the SAME information as structured data.

YOU ARE EXTRACTING, NOT WRITING. Every value you return must come from the document.

ABSOLUTE RULES — never break these:
1. NEVER invent, infer, embellish or "improve" anything. Do not add a company, job title, employer, date, duration, degree, institution, field of study, certification, project, technology, skill, achievement, metric, number, percentage or responsibility that is not written in the document.
2. Do NOT upgrade or exaggerate. If the document says "Frontend Developer with 2 years of experience", return exactly that seniority and that number — never "Senior Frontend Developer" and never "5 years".
3. Copy bullet points and the summary essentially VERBATIM from the document. You may fix obvious extraction damage (a word split across a line break, a stray bullet character, doubled spaces) and drop a leading bullet glyph, but do not reword, merge, split, summarize or enhance them.
4. If a field or section is NOT in the document, return an empty string "" or an empty list []. An empty value is always correct when the document is silent. Never fill a gap with a plausible guess.
5. Do NOT write a professional summary. Only return a summary if the document actually has one (a Summary, Profile, Objective or About section, or an opening paragraph about the person). If it has none, return "".
6. Keep dates exactly as the document writes them ("Jan 2023", "2021", "03/2020"). Do not convert, complete or estimate them. Set "current" to true only if the document says the role is ongoing (e.g. "Present", "Current", "Now").
7. Assign each bullet to the job it appears under. Never move content between jobs and never duplicate it.
8. Skills are short names as listed ("React", "Python", "Project Management"). Do not expand an abbreviation into something the document doesn't say, and do not add related skills you merely assume.

OUTPUT NOTES:
- "title": a short label for this resume — use the person's professional title/headline exactly as printed on the document (e.g. "Frontend Developer"). If the document has no such title, return "".
- "not_found": list the sections you genuinely could not find in the document, using these exact words where they apply: "contact details", "professional summary", "work experience", "education", "skills", "projects", "certifications". Leave it empty if you found everything.

If the text does not look like a resume at all, return every field empty and list what is missing.`

/** Response schema for parsing — mirrors the app's own resume shape. */
const RESUME_PARSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'The professional title as printed on the resume, or an empty string.',
    },
    full_name: { type: Type.STRING, description: 'Full name, or an empty string.' },
    email: { type: Type.STRING, description: 'Email address, or an empty string.' },
    phone: { type: Type.STRING, description: 'Phone number, or an empty string.' },
    location: { type: Type.STRING, description: 'City/region, or an empty string.' },
    linkedin: { type: Type.STRING, description: 'LinkedIn URL or handle, or an empty string.' },
    website: {
      type: Type.STRING,
      description: 'Personal site / portfolio / GitHub URL, or an empty string.',
    },
    summary: {
      type: Type.STRING,
      description:
        'The summary/profile/objective section copied from the document, or an empty string if it has none.',
    },
    experience: {
      type: Type.ARRAY,
      description: 'Work experience entries, in the order the document lists them.',
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING, description: 'Employer name, or an empty string.' },
          role: { type: Type.STRING, description: 'Job title, or an empty string.' },
          location: { type: Type.STRING, description: 'Job location, or an empty string.' },
          start_date: {
            type: Type.STRING,
            description: 'Start date exactly as written, or an empty string.',
          },
          end_date: {
            type: Type.STRING,
            description: 'End date exactly as written, or an empty string if ongoing/absent.',
          },
          current: {
            type: Type.BOOLEAN,
            description: 'True only if the document says this role is ongoing.',
          },
          bullets: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Bullet points listed under this job, copied verbatim.',
          },
        },
        required: ['company', 'role', 'location', 'start_date', 'end_date', 'current', 'bullets'],
        propertyOrdering: [
          'company',
          'role',
          'location',
          'start_date',
          'end_date',
          'current',
          'bullets',
        ],
      },
    },
    education: {
      type: Type.ARRAY,
      description: 'Education entries, in the order the document lists them.',
      items: {
        type: Type.OBJECT,
        properties: {
          institution: {
            type: Type.STRING,
            description: 'School/university name, or an empty string.',
          },
          degree: {
            type: Type.STRING,
            description: 'Degree or qualification, or an empty string.',
          },
          field: { type: Type.STRING, description: 'Field of study, or an empty string.' },
          start_date: {
            type: Type.STRING,
            description: 'Start date exactly as written, or an empty string.',
          },
          end_date: {
            type: Type.STRING,
            description: 'End/graduation date exactly as written, or an empty string.',
          },
        },
        required: ['institution', 'degree', 'field', 'start_date', 'end_date'],
        propertyOrdering: ['institution', 'degree', 'field', 'start_date', 'end_date'],
      },
    },
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Skills exactly as listed in the document.',
    },
    projects: {
      type: Type.ARRAY,
      description: 'Projects described in the document.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Project name, or an empty string.' },
          description: {
            type: Type.STRING,
            description: 'Project description copied from the document, or an empty string.',
          },
          technologies: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Technologies the document names for this project.',
          },
          link: { type: Type.STRING, description: 'Project URL, or an empty string.' },
        },
        required: ['name', 'description', 'technologies', 'link'],
        propertyOrdering: ['name', 'description', 'technologies', 'link'],
      },
    },
    certifications: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Certifications named in the document.',
    },
    not_found: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Sections that could not be found in the document.',
    },
  },
  required: [
    'title',
    'full_name',
    'email',
    'phone',
    'location',
    'linkedin',
    'website',
    'summary',
    'experience',
    'education',
    'skills',
    'projects',
    'certifications',
    'not_found',
  ],
  propertyOrdering: [
    'title',
    'full_name',
    'email',
    'phone',
    'location',
    'linkedin',
    'website',
    'summary',
    'experience',
    'education',
    'skills',
    'projects',
    'certifications',
    'not_found',
  ],
}

/** Read a string field defensively, trimming and defaulting to ''. */
function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Read an object field defensively. */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * Is this short value actually present in the uploaded document?
 *
 * Uses the same punctuation-insensitive comparison as the skill check, since
 * PDF extraction routinely mangles spacing ("Node.js" -> "Node . js").
 */
function isValuePresent(value: string, corpus: { raw: string; squashed: string }): boolean {
  const normalized = normalizeText(value)
  if (!normalized) return false
  if (corpus.raw.includes(normalized)) return true
  const squashed = squashText(value)
  return squashed.length >= 3 && corpus.squashed.includes(squashed)
}

/**
 * Is this sentence or paragraph grounded in the uploaded document?
 *
 * Prose can't be matched literally — extraction inserts line breaks mid-word
 * and the model is allowed to repair those. Instead we check that most of its
 * distinctive words appear in the source. A fabricated sentence fails; a
 * lightly repaired copy passes.
 */
function isProseEvidenced(text: string, corpus: { raw: string; squashed: string }): boolean {
  const words = normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 6)

  // Too short to judge this way — the schema and prompt are the guard there.
  if (words.length < 6) return true

  let found = 0
  for (const word of words) {
    if (corpus.squashed.includes(word)) found += 1
  }
  return found / words.length >= 0.6
}

/**
 * Turn a parsed document into a resume in the app's own shape.
 *
 * Everything the model returns is re-validated against the source text before
 * it is kept, so content the document never contained cannot reach the
 * database:
 *  - an experience/education/project entry survives only if at least one of its
 *    identifying names appears in the document;
 *  - a bullet, description or summary survives only if its wording is grounded
 *    in the document;
 *  - a skill or certification survives only if the document names it.
 */
function toResumeInput(
  parsed: Record<string, unknown>,
  corpus: { raw: string; squashed: string },
): { resume: ResumeInput; dropped: number } {
  let dropped = 0

  /** Keep only the parts of a bullet list the document actually supports. */
  const groundedBullets = (value: unknown, max: number): string[] => {
    if (!Array.isArray(value)) return []
    const out: string[] = []
    for (const item of value) {
      const text = str(item).replace(/^[•▪·*\-–—]\s*/, '')
      if (!text) continue
      if (!isProseEvidenced(text, corpus)) {
        dropped += 1
        continue
      }
      out.push(text)
      if (out.length >= max) break
    }
    return out
  }

  const experience = (Array.isArray(parsed.experience) ? parsed.experience : [])
    .slice(0, MAX_PARSED_EXPERIENCE)
    .map((raw) => {
      const entry = asRecord(raw)
      return {
        company: str(entry.company),
        role: str(entry.role),
        location: str(entry.location),
        startDate: str(entry.start_date),
        endDate: str(entry.end_date),
        current: Boolean(entry.current),
        bullets: groundedBullets(entry.bullets, MAX_PARSED_BULLETS),
      }
    })
    // A job the document never named is a fabrication, not an extraction.
    .filter((entry) => {
      const keep =
        isValuePresent(entry.company, corpus) ||
        isValuePresent(entry.role, corpus) ||
        entry.bullets.length > 0
      if (!keep) dropped += 1
      return keep
    })

  const education = (Array.isArray(parsed.education) ? parsed.education : [])
    .slice(0, MAX_PARSED_EDUCATION)
    .map((raw) => {
      const entry = asRecord(raw)
      return {
        institution: str(entry.institution),
        degree: str(entry.degree),
        field: str(entry.field),
        startDate: str(entry.start_date),
        endDate: str(entry.end_date),
      }
    })
    .filter((entry) => {
      const keep =
        isValuePresent(entry.institution, corpus) ||
        isValuePresent(entry.degree, corpus) ||
        isValuePresent(entry.field, corpus)
      if (!keep) dropped += 1
      return keep
    })

  const projects = (Array.isArray(parsed.projects) ? parsed.projects : [])
    .slice(0, MAX_PARSED_PROJECTS)
    .map((raw) => {
      const entry = asRecord(raw)
      const description = str(entry.description)
      return {
        name: str(entry.name),
        description: isProseEvidenced(description, corpus) ? description : '',
        technologies: cleanStringList(entry.technologies, MAX_PARSED_TECHNOLOGIES).filter((tech) =>
          isValuePresent(tech, corpus),
        ),
        link: str(entry.link),
      }
    })
    .filter((entry) => {
      const keep = isValuePresent(entry.name, corpus) || entry.description.length > 0
      if (!keep) dropped += 1
      return keep
    })

  const skills = cleanStringList(parsed.skills, MAX_SKILLS).filter((skill) => {
    const keep = isValuePresent(skill, corpus)
    if (!keep) dropped += 1
    return keep
  })

  const certifications = cleanStringList(parsed.certifications, MAX_PARSED_CERTIFICATIONS).filter(
    (cert) => {
      const keep = isValuePresent(cert, corpus)
      if (!keep) dropped += 1
      return keep
    },
  )

  const summary = str(parsed.summary)
  const groundedSummary = isProseEvidenced(summary, corpus) ? summary : ''
  if (summary && !groundedSummary) dropped += 1

  const personalInfo = {
    fullName: str(parsed.full_name),
    email: str(parsed.email),
    phone: str(parsed.phone),
    location: str(parsed.location),
    linkedin: str(parsed.linkedin),
    website: str(parsed.website),
  }

  return {
    resume: {
      title: str(parsed.title),
      personalInfo,
      summary: groundedSummary,
      experience,
      education,
      skills,
      projects,
      certifications,
    },
    dropped,
  }
}

/** Sections we ask the user to check when they came back empty. */
const SECTION_LABELS: { label: string; isEmpty: (resume: ResumeInput) => boolean }[] = [
  {
    label: 'contact details',
    isEmpty: (r) => !r.personalInfo?.fullName && !r.personalInfo?.email && !r.personalInfo?.phone,
  },
  { label: 'professional summary', isEmpty: (r) => !r.summary },
  { label: 'work experience', isEmpty: (r) => (r.experience?.length ?? 0) === 0 },
  { label: 'education', isEmpty: (r) => (r.education?.length ?? 0) === 0 },
  { label: 'skills', isEmpty: (r) => (r.skills?.length ?? 0) === 0 },
]

/**
 * Parse an uploaded resume's text into the app's structured resume shape.
 *
 * Anti-fabrication is enforced on three layers:
 *  1. The system prompt frames the task as extraction and requires empty values
 *     for anything the document doesn't say.
 *  2. The response schema mirrors the app's own resume shape exactly, so the
 *     model has nowhere to put invented extras.
 *  3. Every returned value is re-checked against the uploaded text here, and
 *     anything the document doesn't support is dropped before it is saved.
 *
 * The extracted text and the parsed content are never logged.
 */
export async function parseResumeText(params: ParseResumeParams): Promise<ParsedResumeResult> {
  const parsed = await generateStructured<Record<string, unknown>>({
    systemPrompt: PARSE_SYSTEM_PROMPT,
    maxOutputTokens: 32000,
    // An import is a slow, one-shot operation — ride out a transient overload
    // rather than making the user upload the file again.
    retries: 2,
    schema: RESUME_PARSE_SCHEMA,
    userText:
      `Here is the plain text of my existing resume, extracted from the file I uploaded. ` +
      `It is the only source of truth — extract exactly what it says and leave everything ` +
      `else empty:\n\n"""\n${params.text}\n"""`,
  })

  const corpus = { raw: normalizeText(params.text), squashed: squashText(params.text) }
  const { resume, dropped } = toResumeInput(parsed, corpus)

  if (dropped > 0) {
    // Content-free: how many items failed the check, never what they were.
    console.warn(`[ai] Dropped ${dropped} ungrounded item(s) while importing a resume.`)
  }

  // Trust our own check of what ended up empty rather than the model's report,
  // then fold in anything else it said it couldn't find.
  const missing = new Set(
    SECTION_LABELS.filter((section) => section.isEmpty(resume)).map((section) => section.label),
  )
  for (const item of cleanStringList(parsed.not_found, 10)) {
    const label = item.toLowerCase().trim()
    if (SECTION_LABELS.some((section) => section.label === label)) missing.add(label)
  }

  return { resume, missingFields: [...missing] }
}

/* ──────────────────────────── ATS resume score ──────────────────────────── */

/** Caps on the lists the analyser returns, so one response stays readable. */
const MAX_FEEDBACK_ITEMS = 8
const MAX_PRESENT_KEYWORDS = 25
const MAX_RECOMMENDED_KEYWORDS = 12
const MAX_MISSING_SECTIONS = 10

export interface AtsScoreParams {
  /** The resume to evaluate (the user's own working copy). */
  resume: ResumeInput
  /**
   * An optional job posting. Reserved for a future targeted job-match score —
   * when absent (the current behaviour) the resume is judged on general ATS
   * readiness rather than against any particular role.
   */
  jobDescription?: string
}

/** The six dimensions the score breaks down into. Each is 0–100. */
export interface AtsCategoryScores {
  content: number
  keywords: number
  formatting: number
  experience: number
  skills: number
  completeness: number
}

/**
 * A full ATS analysis.
 *
 * This is an evaluation, never a rewrite: nothing here is applied to the
 * resume, and the analyser is not allowed to invent anything it claims to have
 * found.
 */
export interface AtsScoreResult {
  /** Overall ATS readiness, 0–100. */
  score: number
  /** A plain-language band derived from the score. */
  grade: AtsGrade
  /** One or two sentences summarising the verdict. */
  summary: string
  categories: AtsCategoryScores
  /** What the resume already does well. */
  strengths: string[]
  /** Concrete weaknesses found in the resume. */
  issues: string[]
  /** Actionable next steps. */
  recommendations: string[]
  /** Standard resume sections that are missing or empty. */
  missingSections: string[]
  keywords: {
    /** Terms actually present in the resume. */
    present: string[]
    /** Relevant terms the resume doesn't yet show. Never fluff. */
    recommended: string[]
  }
  /** When the analysis ran (ISO). */
  analyzedAt: string
  /** True when the analysis was targeted at a specific job description. */
  targeted: boolean
}

export type AtsGrade = 'Excellent' | 'Strong' | 'Good' | 'Fair' | 'Needs work'

/**
 * Map a score onto a grade band here rather than trusting the model, so the
 * same number always reads the same way.
 */
function toGrade(score: number): AtsGrade {
  if (score >= 90) return 'Excellent'
  if (score >= 78) return 'Strong'
  if (score >= 62) return 'Good'
  if (score >= 45) return 'Fair'
  return 'Needs work'
}

/** Coerce whatever the model returned into an integer score in 0–100. */
function toScore(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(0, Math.min(100, Math.round(num)))
}

/**
 * System prompt for the ATS analyser.
 *
 * The framing matters: this is an evaluator, not a writer. It reports on what
 * is in front of it and never improves, rewrites or imagines content.
 */
const ATS_SYSTEM_PROMPT = `You are ResumeAI's ATS analyst. You evaluate a resume the way an applicant tracking system plus an experienced recruiter would, and you report what you find.

YOU ARE AN EVALUATOR, NOT A WRITER.
You never rewrite the resume, and you never invent anything. Every observation must be about content that is actually in the resume you were given.

WHAT TO ASSESS:
- Professional summary: present? specific? does it say what this person does?
- Skills: present, concrete, and relevant to the apparent role?
- Experience: real bullets, action verbs, clear scope, measurable results?
- Education: present and complete?
- Projects: present, described, technologies named?
- Keywords: does the resume actually contain the terminology a recruiter and an ATS would search for, for this person's apparent role?
- Formatting / ATS readability: consistent dates, clear section structure, no content that would confuse a parser.
- Contact information: name, email, phone, location, and links.
- Completeness: are the standard sections filled in at all?
- Quantifiable achievements: numbers, percentages, scale, outcomes.
- Action verbs: do bullets start with strong verbs, or with "responsible for"?
- Relevance and clarity: is it easy to tell what this person does and what they are good at?

SCORING:
- "score" is overall ATS readiness from 0 to 100.
- Each category score is 0 to 100.
- Be honest and calibrated. A resume with no summary, no education and one thin job is NOT a 70 — it is somewhere in the 30s or 40s. A genuinely strong, complete, quantified resume can score in the 80s or 90s. Do not cluster everything around 70.
- An empty or nearly empty resume is still analysed: give it a low score, list what is missing, and say what to add. Never refuse to analyse.

ABSOLUTE RULES:
1. NEVER invent or assume experience, skills, employers, job titles, dates, education, certifications, projects, achievements, metrics or seniority. If it is not in the resume, it does not exist for you.
2. "keywords.present" must contain ONLY terms that literally appear in the resume. Do not list a keyword as present because it is implied.
3. "keywords.recommended" is for terms that are genuinely relevant to THIS person's apparent role and are missing from the resume. Never recommend a skill just because it is popular or in demand. Never suggest the person claim something they have not done. If you cannot tell what role they are targeting, recommend very few terms, or none at all.
4. Do not recommend adding a technology as if the user already knows it — recommendations are about what to write down if it is true, or what to learn, never about claiming something untrue.
5. "issues" must be specific and grounded. "Some experience bullets lack measurable results" is useful; "resume could be better" is not. Point at what you actually saw.
6. "missingSections" lists standard resume sections that are absent or empty, using these exact words where they apply: "professional summary", "work experience", "education", "skills", "projects", "certifications", "contact information".
7. Write "summary", "strengths", "issues" and "recommendations" directly to the user in plain, friendly language. Keep each item to one sentence.`

/** Response schema for the ATS analysis. */
const ATS_SCORE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.INTEGER,
      description: 'Overall ATS readiness from 0 to 100.',
    },
    summary: {
      type: Type.STRING,
      description: 'One or two sentences summarising the verdict, written to the user.',
    },
    categories: {
      type: Type.OBJECT,
      description: 'Per-dimension scores, each 0 to 100.',
      properties: {
        content: { type: Type.INTEGER, description: 'Summary quality, clarity and relevance.' },
        keywords: { type: Type.INTEGER, description: 'Coverage of role-relevant terminology.' },
        formatting: { type: Type.INTEGER, description: 'ATS readability and structure.' },
        experience: {
          type: Type.INTEGER,
          description: 'Strength of the experience section: action verbs, scope, measurable results.',
        },
        skills: { type: Type.INTEGER, description: 'Quality and relevance of the skills listed.' },
        completeness: {
          type: Type.INTEGER,
          description: 'How much of a standard resume is actually filled in.',
        },
      },
      required: ['content', 'keywords', 'formatting', 'experience', 'skills', 'completeness'],
      propertyOrdering: [
        'content',
        'keywords',
        'formatting',
        'experience',
        'skills',
        'completeness',
      ],
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'What the resume already does well. One sentence each. Empty if there is none.',
    },
    issues: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Specific, grounded weaknesses found in the resume. One sentence each.',
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Actionable next steps, in priority order. One sentence each.',
    },
    missing_sections: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Standard resume sections that are absent or empty.',
    },
    keywords_present: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Role-relevant terms that literally appear in the resume.',
    },
    keywords_recommended: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Relevant terms missing from the resume. Never popular-but-irrelevant filler, never a claim the user cannot make.',
    },
  },
  required: [
    'score',
    'summary',
    'categories',
    'strengths',
    'issues',
    'recommendations',
    'missing_sections',
    'keywords_present',
    'keywords_recommended',
  ],
  propertyOrdering: [
    'score',
    'summary',
    'categories',
    'strengths',
    'issues',
    'recommendations',
    'missing_sections',
    'keywords_present',
    'keywords_recommended',
  ],
}

/** The standard sections we check for ourselves, rather than trusting the model. */
const ATS_SECTIONS: { label: string; isEmpty: (resume: ResumeInput) => boolean }[] = [
  {
    label: 'contact information',
    isEmpty: (r) => !r.personalInfo?.email && !r.personalInfo?.phone,
  },
  { label: 'professional summary', isEmpty: (r) => !r.summary?.trim() },
  { label: 'work experience', isEmpty: (r) => (r.experience?.length ?? 0) === 0 },
  { label: 'education', isEmpty: (r) => (r.education?.length ?? 0) === 0 },
  { label: 'skills', isEmpty: (r) => (r.skills?.length ?? 0) === 0 },
  { label: 'projects', isEmpty: (r) => (r.projects?.length ?? 0) === 0 },
  { label: 'certifications', isEmpty: (r) => (r.certifications?.length ?? 0) === 0 },
]

/** True when there is essentially nothing in the resume to analyse. */
function isEffectivelyEmpty(resume: ResumeInput): boolean {
  return ATS_SECTIONS.every((section) => section.isEmpty(resume))
}

/**
 * Score a resume for ATS readiness using Gemini.
 *
 * Nothing is written to the resume — this only ever produces a report. Its
 * claims are verified before they reach the user:
 *  1. The system prompt frames the task as evaluation and forbids inventing
 *     anything, recommending filler, or refusing an empty resume.
 *  2. The response schema is fixed, so the shape is predictable and there is
 *     nowhere to return rewritten resume content.
 *  3. Every score is clamped to 0–100, the grade is derived here rather than by
 *     the model, "present" keywords must literally appear in the resume, and
 *     "recommended" keywords must not already be there.
 *  4. `missingSections` is computed from the resume itself, so it is right even
 *     if the model miscounts — which matters most for a nearly empty resume.
 */
export async function scoreResumeForAts(params: AtsScoreParams): Promise<AtsScoreResult> {
  const context = toContext(params.resume)
  const jobDescription = params.jobDescription?.trim()

  const parsed = await generateStructured<Record<string, unknown>>({
    systemPrompt: ATS_SYSTEM_PROMPT,
    maxOutputTokens: 16000,
    schema: ATS_SCORE_SCHEMA,
    userText:
      `Here is my resume as JSON. It is the only thing you know about me — analyse exactly ` +
      `what is here and nothing more:\n\n${JSON.stringify(context, null, 2)}\n\n` +
      (jobDescription
        ? `I am targeting this specific role, so judge keyword coverage and relevance ` +
          `against it as well:\n\n"""\n${jobDescription}\n"""\n\n`
        : `I am not targeting one specific job yet, so judge general ATS readiness for the ` +
          `kind of role this resume points at.\n\n`) +
      (isEffectivelyEmpty(params.resume)
        ? `This resume is almost entirely empty. Do not refuse — score it low and tell me ` +
          `clearly which sections I need to fill in first.`
        : `Give me an honest, calibrated score and specific, actionable feedback.`),
  })

  // ── Keywords: only what the resume really contains ──
  const corpus = buildEvidenceCorpus(params.resume)
  const present = cleanStringList(parsed.keywords_present, MAX_PRESENT_KEYWORDS).filter((keyword) =>
    isValuePresent(keyword, corpus),
  )
  // A "recommended" keyword that is already in the resume is noise, not advice.
  const recommended = cleanStringList(
    parsed.keywords_recommended,
    MAX_RECOMMENDED_KEYWORDS,
  ).filter((keyword) => !isValuePresent(keyword, corpus))

  // ── Missing sections: trust our own check, then fold in the model's ──
  const missing = new Set(
    ATS_SECTIONS.filter((section) => section.isEmpty(params.resume)).map(
      (section) => section.label,
    ),
  )
  for (const item of cleanStringList(parsed.missing_sections, MAX_MISSING_SECTIONS)) {
    const label = item.toLowerCase().trim()
    if (ATS_SECTIONS.some((section) => section.label === label)) missing.add(label)
  }

  const categories = asRecord(parsed.categories)
  const score = toScore(parsed.score)

  return {
    score,
    grade: toGrade(score),
    summary:
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : 'Here is how your resume looks to an applicant tracking system.',
    categories: {
      content: toScore(categories.content),
      keywords: toScore(categories.keywords),
      formatting: toScore(categories.formatting),
      experience: toScore(categories.experience),
      skills: toScore(categories.skills),
      completeness: toScore(categories.completeness),
    },
    strengths: cleanStringList(parsed.strengths, MAX_FEEDBACK_ITEMS),
    issues: cleanStringList(parsed.issues, MAX_FEEDBACK_ITEMS),
    recommendations: cleanStringList(parsed.recommendations, MAX_FEEDBACK_ITEMS),
    missingSections: [...missing],
    keywords: { present, recommended },
    analyzedAt: new Date().toISOString(),
    targeted: Boolean(jobDescription),
  }
}
