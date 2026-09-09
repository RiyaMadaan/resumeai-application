import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose'

/**
 * Resume model — a *structured* schema (not one big string) so the resume can
 * be edited section-by-section and rendered by any template. Sub-schemas are
 * declared with `_id: false` since they are value objects, not entities.
 */

const personalInfoSchema = new Schema(
  {
    fullName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    website: { type: String, default: '' },
  },
  { _id: false },
)

const experienceSchema = new Schema(
  {
    company: { type: String, default: '' },
    role: { type: String, default: '' },
    location: { type: String, default: '' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    current: { type: Boolean, default: false },
    bullets: { type: [String], default: [] },
  },
  { _id: false },
)

const educationSchema = new Schema(
  {
    institution: { type: String, default: '' },
    degree: { type: String, default: '' },
    field: { type: String, default: '' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
  },
  { _id: false },
)

const projectSchema = new Schema(
  {
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    technologies: { type: [String], default: [] },
    link: { type: String, default: '' },
  },
  { _id: false },
)

/** The templates this app shipped with, and the default for a new resume. */
export const RESUME_TEMPLATES = ['classic', 'modern', 'minimal'] as const

/** The template a resume gets when none is supplied. */
export const DEFAULT_TEMPLATE = 'classic'

/**
 * A template identifier, e.g. "classic" or "modern-01".
 *
 * The catalog of designs lives in the frontend, since a template is purely a
 * rendering choice — the server stores the id and never interprets it. Rather
 * than duplicating a 60-entry list here (which would have to be edited in two
 * places every time a design is added), the id is validated by *shape*: a short
 * lowercase slug. That keeps the field safe to store and echo back while
 * letting the catalog grow freely.
 */
export type TemplateVariant = string

/** Slugs only — no spaces, no punctuation beyond a hyphen, and bounded. */
export const TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/

/**
 * Plain value shapes for the resume's sections.
 *
 * `InferSchemaType` types the sub-documents as Mongoose `DocumentArray`s, which
 * is right for a hydrated document but wrong for the plain data the API accepts
 * and the services pass around. These interfaces are that plain shape — they
 * mirror the schema above and are what `ResumeInput` is built from.
 */
export interface PersonalInfoValue {
  fullName: string
  email: string
  phone: string
  location: string
  linkedin: string
  website: string
}

export interface ExperienceValue {
  company: string
  role: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  bullets: string[]
}

export interface EducationValue {
  institution: string
  degree: string
  field: string
  startDate: string
  endDate: string
}

export interface ProjectValue {
  name: string
  description: string
  technologies: string[]
  link: string
}

/** The editable content of a resume, as plain data. */
export interface ResumeContent {
  title: string
  personalInfo: PersonalInfoValue
  summary: string
  experience: ExperienceValue[]
  education: EducationValue[]
  skills: string[]
  projects: ProjectValue[]
  certifications: string[]
  template: TemplateVariant
}


/**
 * The latest ATS analysis for a resume.
 *
 * Stored as optional metadata *about* the resume, never mixed into its content:
 * it is deliberately absent from `ResumeContent`, so a client can never write
 * its own score through the normal update endpoint. Running a new analysis
 * replaces this one rather than accumulating history.
 */
const atsAnalysisSchema = new Schema(
  {
    score: { type: Number, default: 0 },
    grade: { type: String, default: '' },
    summary: { type: String, default: '' },
    categories: {
      type: new Schema(
        {
          content: { type: Number, default: 0 },
          keywords: { type: Number, default: 0 },
          formatting: { type: Number, default: 0 },
          experience: { type: Number, default: 0 },
          skills: { type: Number, default: 0 },
          completeness: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    strengths: { type: [String], default: [] },
    issues: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    missingSections: { type: [String], default: [] },
    keywords: {
      type: new Schema(
        {
          present: { type: [String], default: [] },
          recommended: { type: [String], default: [] },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    analyzedAt: { type: String, default: '' },
    targeted: { type: Boolean, default: false },
  },
  { _id: false },
)

/** How a resume came into being. Recorded once, never rewritten. */
export const CREATION_METHODS = ['scratch', 'story', 'upload', 'ai-interview'] as const
export type CreationMethod = (typeof CREATION_METHODS)[number]

/**
 * The AI interview attached to a resume.
 *
 * Stored on the resume itself rather than in a separate collection: an
 * interview only ever belongs to one resume, so the existing ownership check
 * covers it and there is no second thing to keep in sync. Keeping the
 * transcript here is what lets someone answer a few questions today, log out,
 * and pick the same conversation up tomorrow — React state and localStorage
 * both die well before that.
 *
 * This is metadata about the resume, not resume content: it is deliberately
 * absent from `ResumeContent`, so a normal update can never write it.
 */
const interviewMessageSchema = new Schema(
  {
    role: { type: String, enum: ['assistant', 'user'], required: true },
    content: { type: String, default: '' },
  },
  { _id: false },
)

const aiInterviewSchema = new Schema(
  {
    status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' },
    messages: { type: [interviewMessageSchema], default: [] },
    updatedAt: { type: String, default: '' },
  },
  { _id: false },
)

const resumeSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, default: 'Untitled Resume', trim: true },

    personalInfo: { type: personalInfoSchema, default: () => ({}) },
    summary: { type: String, default: '' },
    experience: { type: [experienceSchema], default: [] },
    education: { type: [educationSchema], default: [] },
    skills: { type: [String], default: [] },
    projects: { type: [projectSchema], default: [] },
    certifications: { type: [String], default: [] },

    template: {
      type: String,
      default: DEFAULT_TEMPLATE,
      // Validate the shape rather than a fixed list, so adding a design to the
      // frontend catalog doesn't require a schema change. An unknown id still
      // renders — the client falls back to the default template.
      validate: {
        validator: (value: string) => TEMPLATE_ID_PATTERN.test(value),
        message: 'Invalid template identifier',
      },
    },

    // Latest ATS analysis — metadata, not resume content. Set only by the ATS
    // endpoint; never accepted from a client update.
    atsAnalysis: { type: atsAnalysisSchema, default: undefined },

    // How this resume was made, and the interview behind it if there was one.
    // Both are metadata, written only by the flows that own them.
    creationMethod: { type: String, enum: CREATION_METHODS, default: 'scratch' },
    aiInterview: { type: aiInterviewSchema, default: undefined },
  },
  { timestamps: true },
)

resumeSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v
    return ret
  },
})

export type Resume = InferSchemaType<typeof resumeSchema>
export type ResumeDocument = HydratedDocument<Resume>

export const ResumeModel = model('Resume', resumeSchema)
