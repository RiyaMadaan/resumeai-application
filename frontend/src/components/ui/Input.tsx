import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const fieldBase =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-subtle shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

/** Input — labelled text field with error and hint support. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={fieldId}
        className={cn(fieldBase, error && 'border-red-400 focus:ring-red-500/30', className)}
        aria-invalid={!!error}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

/** Textarea — same styling as Input, for multi-line and story input. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        className={cn(fieldBase, 'resize-y leading-relaxed', error && 'border-red-400', className)}
        aria-invalid={!!error}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
})
