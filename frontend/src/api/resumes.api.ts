import { apiClient } from './client'
import type { Resume, ResumeInput } from '@/types/resume'

/** What the server could and couldn't pull out of an uploaded document. */
export interface ImportSummary {
  /** The name of the file the user uploaded. */
  fileName: string
  /**
   * Sections the document didn't contain (or that couldn't be read), as short
   * labels like "professional summary". Shown to the user as a prompt to
   * review — never as an error.
   */
  missingFields: string[]
}

export interface ImportedResume {
  resume: Resume
  imported: ImportSummary
}

/** Accepted upload formats, and the size ceiling the server enforces. */
export const ACCEPTED_UPLOAD_EXTENSIONS = ['.pdf', '.docx'] as const
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024


/** Resume CRUD API calls (all require authentication). */
export const resumesApi = {
  async list(): Promise<Resume[]> {
    const { data } = await apiClient.get<{ resumes: Resume[] }>('/resumes')
    return data.resumes
  },

  async create(input: ResumeInput): Promise<Resume> {
    const { data } = await apiClient.post<{ resume: Resume }>('/resumes', input)
    return data.resume
  },

  async get(id: string): Promise<Resume> {
    const { data } = await apiClient.get<{ resume: Resume }>(`/resumes/${id}`)
    return data.resume
  },

  async update(id: string, input: ResumeInput): Promise<Resume> {
    const { data } = await apiClient.put<{ resume: Resume }>(`/resumes/${id}`, input)
    return data.resume
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/resumes/${id}`)
  },

  /**
   * Import an existing resume document (PDF or DOCX).
   *
   * The file is sent as multipart form data and processed entirely on the
   * server — extraction and AI parsing both happen there, so no API key is
   * ever exposed to the browser. The server creates the resume for the
   * authenticated user and returns it, together with a note of anything it
   * could not extract.
   */
  async importFile(
    file: File,
    onUploadProgress?: (percent: number) => void,
  ): Promise<ImportedResume> {
    const form = new FormData()
    form.append('file', file)

    const { data } = await apiClient.post<ImportedResume>('/resumes/import', form, {
      // Reading a document and parsing it with AI takes longer than a normal
      // request, so allow generous headroom before giving up.
      timeout: 120_000,
      onUploadProgress: onUploadProgress
        ? (event) => {
            if (!event.total) return
            onUploadProgress(Math.round((event.loaded / event.total) * 100))
          }
        : undefined,
    })
    return data
  },
}
