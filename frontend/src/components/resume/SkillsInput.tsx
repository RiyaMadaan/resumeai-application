import { useRef, useState, type KeyboardEvent } from 'react'

/**
 * SkillsInput — add skills one at a time as removable chips.
 *
 * The resume editor keeps skills as a comma-separated string, which is quick
 * for someone editing an existing list. The step-by-step builder is a
 * different moment — the list is being written from nothing — so this offers a
 * direct add/remove interaction instead. Both read and write the same
 * `string[]` on the resume, so nothing downstream can tell them apart.
 */
export function SkillsInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (skills: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const add = (raw: string) => {
    // Pasting a comma-separated list adds each entry, which is what someone
    // copying from an old resume expects.
    const candidates = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (candidates.length === 0) return

    const existing = new Set(value.map((s) => s.toLowerCase()))
    const additions = candidates.filter((s) => {
      const key = s.toLowerCase()
      if (existing.has(key)) return false
      existing.add(key)
      return true
    })
    if (additions.length > 0) onChange([...value, ...additions])
    setDraft('')
  }

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(draft)
      return
    }
    // Backspace on an empty field removes the last chip — the usual shortcut.
    if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <label htmlFor="skills-input" className="mb-1.5 block text-sm font-medium text-ink">
        Skills
      </label>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/30">
        {value.map((skill, index) => (
          <span
            key={`${skill}-${index}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 py-1 pl-2.5 pr-1.5 text-sm font-medium text-brand-700"
          >
            {skill}
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label={`Remove ${skill}`}
              className="flex h-4 w-4 items-center justify-center rounded text-brand-500 transition-colors hover:bg-brand-100 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </span>
        ))}

        <input
          id="skills-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          // Don't lose a half-typed skill when focus moves away.
          onBlur={() => add(draft)}
          placeholder={value.length === 0 ? 'React, TypeScript, Node.js…' : 'Add another…'}
          className="min-w-[140px] flex-1 border-0 bg-transparent px-2 py-1 text-[15px] text-ink placeholder:text-ink-subtle focus:outline-none"
        />
      </div>

      <p className="mt-1.5 text-xs text-ink-subtle">
        Press Enter or comma to add. {value.length} added.
      </p>
    </div>
  )
}
