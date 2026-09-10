/**
 * Structured resume types — mirror the backend Mongoose schema so the whole
 * app speaks one shape. A resume is structured (sections), never a raw string.
 */

/**
 * A resume template identifier, e.g. "classic" or "modern-01".
 *
 * The catalog in `@/templates/catalog` is the source of truth for which ids
 * exist. This is a plain string rather than a union so the catalog can grow
 * without a type change rippling through the app, and so a resume saved with a
 * template that was later renamed still loads — `getTemplate` falls back to the
 * default instead of failing.
 */
export type TemplateId = string

/** Historic name for {@link TemplateId}, kept so existing call sites compile. */
export type TemplateVariant = TemplateId

export interface PersonalInfo {
  fullName: string
  email: string
  phone: string
  location: string
  linkedin: string
  website: string
}

export interface Experience {
  company: string
  role: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  bullets: string[]
}

export interface Education {
  institution: string
  degree: string
  field: string
  startDate: string
  endDate: string
}

export interface Project {
  name: string
  description: string
  technologies: string[]
  link: string
}


/** The six dimensions an ATS analysis breaks down into. Each is 0–100. */
export interface AtsCategoryScores {
  content: number
  keywords: number
  formatting: number
  experience: number
  skills: number
  completeness: number
}

/** Plain-language bands derived from the overall score. */
export type AtsGrade = 'Excellent' | 'Strong' | 'Good' | 'Fair' | 'Needs work'

/**
 * An ATS readiness report for a resume.
 *
 * This is an evaluation, never a rewrite — nothing in it is applied to the
 * resume. The server stores the latest one as metadata on the resume so the
 * dashboard can show the last score without re-running the analysis.
 */
export interface AtsAnalysis {
  /** Overall ATS readiness, 0–100. */
  score: number
  grade: AtsGrade
  /** One or two sentences summarising the verdict. */
  summary: string
  categories: AtsCategoryScores
  /** What the resume already does well. */
  strengths: string[]
  /** Specific weaknesses found in the resume. */
  issues: string[]
  /** Actionable next steps, in priority order. */
  recommendations: string[]
  /** Standard sections that are missing or empty. */
  missingSections: string[]
  keywords: {
    /** Terms that actually appear in the resume. */
    present: string[]
    /** Relevant terms the resume doesn't show yet. */
    recommended: string[]
  }
  /** When the analysis ran (ISO). */
  analyzedAt: string
  /** True when it was run against a specific job description. */
  targeted: boolean
}

/** How a resume came into being. */
export type CreationMethod =
  | 'scratch'
  | 'story'
  | 'upload'
  | 'ai-interview'
  /** Built with the step-by-step builder. Added after the other four. */
  | 'manual'

/** The stored interview conversation behind a resume. */
export interface AiInterviewState {
  status: 'in-progress' | 'completed'
  messages: { role: 'assistant' | 'user'; content: string }[]
  updatedAt?: string
}

export interface Resume {
  _id: string
  userId: string
  title: string
  personalInfo: PersonalInfo
  summary: string
  experience: Experience[]
  education: Education[]
  skills: string[]
  projects: Project[]
  certifications: string[]
  template: TemplateVariant
  /** The latest ATS analysis, if one has been run. Metadata, not content. */
  atsAnalysis?: AtsAnalysis
  /** How this resume was created. Fixed when it is created. */
  creationMethod?: CreationMethod
  /** The AI interview attached to it, if one has been run. */
  aiInterview?: AiInterviewState
  /**
   * The step the manual builder was last on, e.g. "experience".
   *
   * Persisted server-side so progress survives a refresh, a new device and a
   * fresh login. Absent on every resume not built with the step flow.
   */
  builderStep?: string | null
  createdAt: string
  updatedAt: string
}

/** Shape used when creating/updating (server fills the rest with defaults). */
export type ResumeInput = Partial<
  Pick<
    Resume,
    | 'title'
    | 'personalInfo'
    | 'summary'
    | 'experience'
    | 'education'
    | 'skills'
    | 'projects'
    | 'certifications'
    | 'template'
    | 'builderStep'
  >
> & {
  /** Only honoured when creating; updates never rewrite provenance. */
  creationMethod?: CreationMethod
  aiInterview?: Pick<AiInterviewState, 'status' | 'messages'>
}

/** An empty, well-formed resume for local editing before the AI step exists. */
export const emptyPersonalInfo: PersonalInfo = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
  website: '',
}
