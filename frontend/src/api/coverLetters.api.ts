import { apiClient } from './client'
import type { CoverLetter, CoverLetterInput, CoverLetterRefinement } from '@/types/coverLetter'

/**
 * Cover letter API calls (all require authentication).
 *
 * Generation and refinement are server-side: the resume content and the job
 * description are sent to our own API, which talks to the AI provider. The
 * Anthropic key never reaches the browser.
 */
export const coverLettersApi = {
  async list(): Promise<CoverLetter[]> {
    const { data } = await apiClient.get<{ coverLetters: CoverLetter[] }>('/cover-letters')
    return data.coverLetters
  },

  async get(id: string): Promise<CoverLetter> {
    const { data } = await apiClient.get<{ coverLetter: CoverLetter }>(`/cover-letters/${id}`)
    return data.coverLetter
  },

  async create(input: CoverLetterInput): Promise<CoverLetter> {
    const { data } = await apiClient.post<{ coverLetter: CoverLetter }>('/cover-letters', input)
    return data.coverLetter
  },

  async update(id: string, input: CoverLetterInput): Promise<CoverLetter> {
    const { data } = await apiClient.put<{ coverLetter: CoverLetter }>(
      `/cover-letters/${id}`,
      input,
    )
    return data.coverLetter
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/cover-letters/${id}`)
  },

  /**
   * Write (or rewrite) the letter. Slower than a normal request because it
   * waits on the AI, so it gets the same generous timeout as the import flow.
   */
  async generate(id: string, input: CoverLetterInput): Promise<CoverLetter> {
    const { data } = await apiClient.post<{ coverLetter: CoverLetter }>(
      `/cover-letters/${id}/generate`,
      input,
      { timeout: 120_000 },
    )
    return data.coverLetter
  },

  /** Rewrite the current text in one direction, keeping it evidence-backed. */
  async refine(
    id: string,
    refinement: CoverLetterRefinement,
    body: string,
  ): Promise<CoverLetter> {
    const { data } = await apiClient.post<{ coverLetter: CoverLetter }>(
      `/cover-letters/${id}/refine`,
      { refinement, body },
      { timeout: 120_000 },
    )
    return data.coverLetter
  },
}
