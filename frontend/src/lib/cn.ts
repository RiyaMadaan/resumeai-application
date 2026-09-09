/**
 * Tiny className combiner — joins truthy class strings with a space.
 * Keeps components readable without pulling in an extra dependency.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
