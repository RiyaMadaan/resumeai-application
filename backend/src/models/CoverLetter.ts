import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'

/**
 * Cover letter model.
 *
 * A cover letter is written *from* a resume but stored separately: it has its
 * own lifecycle (regenerate, edit, refine) and a user can hold several letters
 * for the same resume, one per application. The resume is referenced rather
 * than copied so the letter always regenerates from current content.
 *
 * The body is the user's document. The AI writes the first draft, but every
 * subsequent edit — by hand or through a refine action — is saved here, and
 * nothing regenerates without an explicit request.
 */

/** How long a stored letter may be. Generous for a page of prose. */
export const MAX_BODY_LENGTH = 12000
/** Bounds on the job description a letter is written against. */
export const MAX_JOB_DESCRIPTION_LENGTH = 20000

const coverLetterSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /**
     * The resume this letter was written from.
     *
     * Kept as a plain reference with no cascade: deleting a resume leaves the
     * letter readable (the text is already written) rather than destroying
     * work the user may still want. The UI resolves a missing resume gracefully.
     */
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', default: undefined },

    /** The user's own name for this letter — only they see it. */
    title: { type: String, default: '', trim: true, maxlength: 200 },

    /** Optional targeting. Used in the prompt and in the letter's greeting. */
    company: { type: String, default: '', trim: true, maxlength: 200 },
    jobTitle: { type: String, default: '', trim: true, maxlength: 200 },

    /** The job description the letter is tailored to. */
    jobDescription: { type: String, default: '', maxlength: MAX_JOB_DESCRIPTION_LENGTH },

    /** The letter itself — plain text paragraphs separated by blank lines. */
    body: { type: String, default: '', maxlength: MAX_BODY_LENGTH },

    /** Set the first time AI produced a draft, so the UI can distinguish them. */
    generatedAt: { type: Date, default: undefined },
  },
  { timestamps: true },
)

coverLetterSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v
    return ret
  },
})

export type CoverLetter = InferSchemaType<typeof coverLetterSchema>
export type CoverLetterDocument = HydratedDocument<CoverLetter>

export const CoverLetterModel = model('CoverLetter', coverLetterSchema)
