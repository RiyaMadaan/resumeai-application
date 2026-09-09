/**
 * The resume template system.
 *
 * A template is *data*, not a bespoke component: each one is a `TemplateSpec`
 * describing layout, typography, colour and section arrangement, and a single
 * renderer interprets that spec. That is what makes 50+ templates maintainable
 * — adding one is adding an object to the catalog, not writing a new component
 * — and it guarantees the gallery thumbnail, the editor preview and the PDF all
 * describe the same design rather than drifting apart.
 */

/** The resume sections a template can place, in any order. */
export type SectionKey =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'

/** Column structure. Sidebar templates split sections between the two columns. */
export type ColumnLayout = 'single' | 'sidebar-left' | 'sidebar-right'

/** How the name/contact block at the top is presented. */
export type HeaderStyle =
  /** Centred name over centred contacts, divider beneath. The traditional resume. */
  | 'centered'
  /** Flush left, no ornament. */
  | 'left'
  /** Full-bleed colour band behind the name. */
  | 'banner'
  /** Name on the left, contact details right-aligned opposite it. */
  | 'split'
  /** Name and contacts inside a bordered box. */
  | 'boxed'
  /** Small accent rule under the name — restrained, for minimal designs. */
  | 'rule'
  /** Circular initial badge beside the name. */
  | 'initial'
  /** Widely letter-spaced capitals, editorial feel. */
  | 'caps'
  /** Heavy accent underline spanning the header. */
  | 'underline'
  /** A tinted (not full-colour) panel — softer than `banner`. */
  | 'tinted'

/** How each section heading is drawn. */
export type SectionTitleStyle =
  | 'plain'
  | 'underline'
  | 'bar'
  | 'boxed'
  | 'side-rule'
  | 'caps-wide'
  | 'numbered'
  | 'dot'

/** How the skills list is presented. */
export type SkillsStyle =
  | 'pills'
  | 'inline'
  | 'list'
  | 'bars'
  | 'grid'
  | 'outline'

/** How each role in the experience section is laid out. */
export type ExperienceStyle =
  /** Role and dates on one line, bullets beneath. */
  | 'stacked'
  /** A vertical rule with a node per role. */
  | 'timeline'
  /** Tighter spacing, smaller dates — fits more on a page. */
  | 'compact'
  /** Dates in their own left-hand column, details to the right. */
  | 'dated-left'

/** Overall vertical rhythm. */
export type Density = 'compact' | 'normal' | 'roomy'

/** Typeface family. Mapped to real font stacks by the renderer. */
export type FontKind = 'sans' | 'serif' | 'mono'

/** Gallery filter categories. */
export type TemplateCategory =
  | 'Professional'
  | 'Modern'
  | 'Minimal'
  | 'Creative'
  | 'ATS Friendly'
  | 'Executive'
  | 'Academic'
  | 'Tech'

/** The full set of categories, in the order the gallery filter shows them. */
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Professional',
  'Modern',
  'Minimal',
  'Creative',
  'ATS Friendly',
  'Executive',
  'Academic',
  'Tech',
]

/** Layout and styling decisions that make one template differ from another. */
export interface TemplateLayout {
  columns: ColumnLayout
  /** Sidebar width as a percentage of the page. Ignored for single-column. */
  sidebarWidth: number
  header: HeaderStyle
  sectionTitle: SectionTitleStyle
  skills: SkillsStyle
  experience: ExperienceStyle
  density: Density
  /** Section order for the main column. */
  order: SectionKey[]
  /** Sections moved into the sidebar. Ignored for single-column. */
  sidebar: SectionKey[]
  /** Draw a hairline between sections. */
  dividers: boolean
}

/** Typography choices. Sizes are in px at full A4 render width. */
export interface TemplateType {
  font: FontKind
  /** Font used for headings, when it differs from the body. */
  headingFont?: FontKind
  /** The name at the top. */
  nameSize: number
  /** Section heading size. */
  titleSize: number
  /** Body copy size. */
  bodySize: number
  /** Letter-spacing for the name, in em. */
  nameTracking: number
  /** Uppercase the name. */
  nameCaps: boolean
}

/** The template's colour choices. Plain hex so the PDF layer can reuse them. */
export interface TemplateColors {
  /** Primary accent — headings, rules, badges. */
  accent: string
  /** A pale wash of the accent, for pills and sidebars. */
  accentSoft: string
  /** Body text. */
  text: string
  /** Secondary text. */
  muted: string
  /** Background for `banner`/`tinted` headers and sidebars. */
  surface: string
  /** Text on top of `surface` when it is a full-strength colour. */
  onSurface: string
}

/** One resume template. */
export interface TemplateSpec {
  /** Stable identifier persisted on the resume, e.g. "modern-01". */
  id: string
  name: string
  category: TemplateCategory
  description: string
  /** Who the template suits — shown on the gallery card. */
  useCase?: string
  /** An optional gallery badge. */
  badge?: 'Popular' | 'Recommended' | 'ATS'
  layout: TemplateLayout
  type: TemplateType
  colors: TemplateColors
}

/** Font stacks for each `FontKind`, shared by preview and thumbnails. */
export const FONT_STACKS: Record<FontKind, string> = {
  sans: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
}

/** Vertical rhythm multipliers for each density. */
export const DENSITY_SCALE: Record<Density, number> = {
  compact: 0.78,
  normal: 1,
  roomy: 1.28,
}
