import type {
  SectionKey,
  TemplateCategory,
  TemplateColors,
  TemplateLayout,
  TemplateSpec,
  TemplateType,
} from './types'

/**
 * The template catalog.
 *
 * Every template is a plain object, so the list below *is* the design system
 * for resumes: adding a template means adding an entry, never writing a new
 * component. `defineTemplate` supplies the defaults so each entry states only
 * what makes it different, which keeps 50+ templates readable and makes the
 * differences between them easy to see at a glance.
 */

/** The conventional section order, used unless a template reorders it. */
const DEFAULT_ORDER: SectionKey[] = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
]

const baseLayout: TemplateLayout = {
  columns: 'single',
  sidebarWidth: 34,
  header: 'left',
  sectionTitle: 'plain',
  skills: 'inline',
  experience: 'stacked',
  density: 'normal',
  order: DEFAULT_ORDER,
  sidebar: [],
  dividers: false,
}

const baseType: TemplateType = {
  font: 'sans',
  nameSize: 28,
  titleSize: 11,
  bodySize: 11,
  nameTracking: -0.02,
  nameCaps: false,
}

const baseColors: TemplateColors = {
  accent: '#4338ca',
  accentSoft: '#eef2ff',
  text: '#0f172a',
  muted: '#475569',
  surface: '#4f46e5',
  onSurface: '#ffffff',
}

/** Named palettes, so colour stays consistent across the templates using it. */
const palette = {
  indigo: { accent: '#4338ca', accentSoft: '#eef2ff', surface: '#4f46e5' },
  violet: { accent: '#6d28d9', accentSoft: '#f5f3ff', surface: '#7c3aed' },
  slate: { accent: '#0f172a', accentSoft: '#f1f5f9', surface: '#1e293b' },
  steel: { accent: '#334155', accentSoft: '#f8fafc', surface: '#475569' },
  navy: { accent: '#1e3a8a', accentSoft: '#eff6ff', surface: '#1e40af' },
  sky: { accent: '#0369a1', accentSoft: '#f0f9ff', surface: '#0284c7' },
  teal: { accent: '#0f766e', accentSoft: '#f0fdfa', surface: '#0d9488' },
  emerald: { accent: '#047857', accentSoft: '#ecfdf5', surface: '#059669' },
  forest: { accent: '#14532d', accentSoft: '#f0fdf4', surface: '#166534' },
  rose: { accent: '#be123c', accentSoft: '#fff1f2', surface: '#e11d48' },
  burgundy: { accent: '#881337', accentSoft: '#fff1f2', surface: '#9f1239' },
  amber: { accent: '#b45309', accentSoft: '#fffbeb', surface: '#d97706' },
  copper: { accent: '#9a3412', accentSoft: '#fff7ed', surface: '#c2410c' },
  plum: { accent: '#701a75', accentSoft: '#fdf4ff', surface: '#a21caf' },
  charcoal: { accent: '#262626', accentSoft: '#f5f5f5', surface: '#171717' },
  black: { accent: '#000000', accentSoft: '#f4f4f5', surface: '#000000' },
} satisfies Record<string, Pick<TemplateColors, 'accent' | 'accentSoft' | 'surface'>>

type PaletteName = keyof typeof palette

interface TemplateInit {
  id: string
  name: string
  category: TemplateCategory
  description: string
  useCase?: string
  badge?: TemplateSpec['badge']
  palette?: PaletteName
  layout?: Partial<TemplateLayout>
  type?: Partial<TemplateType>
  colors?: Partial<TemplateColors>
}

function defineTemplate(init: TemplateInit): TemplateSpec {
  const chosen = palette[init.palette ?? 'indigo']
  return {
    id: init.id,
    name: init.name,
    category: init.category,
    description: init.description,
    useCase: init.useCase,
    badge: init.badge,
    layout: { ...baseLayout, ...init.layout },
    type: { ...baseType, ...init.type },
    colors: { ...baseColors, ...chosen, ...init.colors },
  }
}

/**
 * All templates.
 *
 * The first three ids — `classic`, `modern`, `minimal` — are the identifiers
 * this app shipped with. They are kept, and kept first, so every resume saved
 * before the gallery existed still resolves to a real template.
 */
export const TEMPLATES: TemplateSpec[] = [
  // ── Legacy identifiers (must keep these ids) ──────────────────────────────
  defineTemplate({
    id: 'classic',
    name: 'Classic',
    category: 'Professional',
    description: 'Centred header with a divider — the traditional resume shape.',
    useCase: 'Safe for any industry or seniority',
    badge: 'Popular',
    layout: { header: 'centered', sectionTitle: 'caps-wide', skills: 'pills' },
  }),
  defineTemplate({
    id: 'modern',
    name: 'Modern',
    category: 'Modern',
    description: 'A full-width colour banner puts your name front and centre.',
    useCase: 'Product, marketing and design roles',
    badge: 'Popular',
    layout: { header: 'banner', sectionTitle: 'caps-wide', skills: 'pills' },
  }),
  defineTemplate({
    id: 'minimal',
    name: 'Minimal',
    category: 'Minimal',
    description: 'Left-aligned and quiet, with a single accent rule.',
    useCase: 'When the writing should do the work',
    layout: { header: 'rule', sectionTitle: 'caps-wide', skills: 'inline' },
  }),

  // ── ATS friendly ──────────────────────────────────────────────────────────
  defineTemplate({
    id: 'ats-01',
    name: 'Plain Text',
    category: 'ATS Friendly',
    description: 'No columns, no colour, no ornament — maximum parser compatibility.',
    useCase: 'Large-company applicant tracking systems',
    badge: 'ATS',
    palette: 'black',
    layout: { header: 'left', sectionTitle: 'plain', skills: 'list', experience: 'stacked' },
    colors: { accent: '#000000', muted: '#333333' },
  }),
  defineTemplate({
    id: 'ats-02',
    name: 'Clean Scan',
    category: 'ATS Friendly',
    description: 'Standard headings and a single column, with restrained spacing.',
    useCase: 'Online applications and job boards',
    badge: 'ATS',
    palette: 'charcoal',
    layout: { header: 'centered', sectionTitle: 'underline', skills: 'inline', dividers: true },
  }),
  defineTemplate({
    id: 'ats-03',
    name: 'Straight Line',
    category: 'ATS Friendly',
    description: 'Conventional section names in a strict vertical flow.',
    useCase: 'Government and enterprise applications',
    badge: 'ATS',
    palette: 'steel',
    layout: { header: 'left', sectionTitle: 'caps-wide', skills: 'list', density: 'compact' },
  }),
  defineTemplate({
    id: 'ats-04',
    name: 'Parser Pro',
    category: 'ATS Friendly',
    description: 'Skills listed one per line so keyword matching never misreads them.',
    useCase: 'Keyword-heavy technical screening',
    badge: 'ATS',
    palette: 'navy',
    layout: {
      header: 'left',
      sectionTitle: 'plain',
      skills: 'list',
      order: ['summary', 'skills', 'experience', 'education', 'projects', 'certifications'],
    },
  }),
  defineTemplate({
    id: 'ats-05',
    name: 'Direct',
    category: 'ATS Friendly',
    description: 'Dates in a dedicated column, everything else plain.',
    useCase: 'Recruiter-facing submissions',
    badge: 'ATS',
    palette: 'slate',
    layout: { header: 'split', sectionTitle: 'plain', skills: 'inline', experience: 'dated-left' },
  }),
  defineTemplate({
    id: 'ats-06',
    name: 'Neutral',
    category: 'ATS Friendly',
    description: 'Greyscale throughout, with generous margins for readability.',
    useCase: 'Conservative industries',
    badge: 'ATS',
    palette: 'charcoal',
    layout: { header: 'centered', sectionTitle: 'caps-wide', skills: 'inline', density: 'roomy' },
  }),

  // ── Professional ──────────────────────────────────────────────────────────
  defineTemplate({
    id: 'professional-01',
    name: 'Boardroom',
    category: 'Professional',
    description: 'A boxed header above conventional, well-spaced sections.',
    useCase: 'Consulting and corporate roles',
    palette: 'navy',
    layout: { header: 'boxed', sectionTitle: 'underline', skills: 'inline' },
  }),
  defineTemplate({
    id: 'professional-02',
    name: 'Cornerstone',
    category: 'Professional',
    description: 'Accent bars mark each heading and anchor the page.',
    useCase: 'Operations and project management',
    palette: 'steel',
    layout: { header: 'left', sectionTitle: 'bar', skills: 'pills', dividers: true },
  }),
  defineTemplate({
    id: 'professional-03',
    name: 'Meridian',
    category: 'Professional',
    description: 'Name and contacts sit opposite each other across the header.',
    useCase: 'Client-facing and account roles',
    palette: 'teal',
    layout: { header: 'split', sectionTitle: 'underline', skills: 'pills' },
  }),
  defineTemplate({
    id: 'professional-04',
    name: 'Registry',
    category: 'Professional',
    description: 'Dates in a left column make a long history easy to scan.',
    useCase: 'Ten or more years of experience',
    palette: 'slate',
    layout: { header: 'centered', sectionTitle: 'caps-wide', experience: 'dated-left', skills: 'inline' },
  }),
  defineTemplate({
    id: 'professional-05',
    name: 'Charter',
    category: 'Professional',
    description: 'A serif face and centred header for a formal impression.',
    useCase: 'Law, policy and public sector',
    palette: 'burgundy',
    layout: { header: 'centered', sectionTitle: 'underline', skills: 'inline', dividers: true },
    type: { font: 'serif', nameSize: 30 },
  }),
  defineTemplate({
    id: 'professional-06',
    name: 'Keystone',
    category: 'Professional',
    description: 'A tinted header panel with skills grouped in a grid.',
    useCase: 'Mid-career professionals',
    palette: 'sky',
    layout: { header: 'tinted', sectionTitle: 'bar', skills: 'grid' },
  }),
  defineTemplate({
    id: 'professional-07',
    name: 'Ledger',
    category: 'Professional',
    description: 'Compact rows fit a dense history onto a single page.',
    useCase: 'Finance and accounting',
    palette: 'forest',
    layout: { header: 'left', sectionTitle: 'underline', experience: 'compact', skills: 'inline', density: 'compact' },
  }),
  defineTemplate({
    id: 'professional-08',
    name: 'Summit',
    category: 'Professional',
    description: 'A sidebar holds skills and education beside your experience.',
    useCase: 'Business and strategy roles',
    palette: 'navy',
    layout: {
      columns: 'sidebar-right',
      header: 'left',
      sectionTitle: 'caps-wide',
      skills: 'list',
      sidebar: ['skills', 'education', 'certifications'],
      order: ['summary', 'experience', 'projects'],
    },
  }),

  // ── Modern ────────────────────────────────────────────────────────────────
  defineTemplate({
    id: 'modern-01',
    name: 'Modern Edge',
    category: 'Modern',
    description: 'A colour band header over a clean, roomy single column.',
    useCase: 'Product and growth roles',
    badge: 'Recommended',
    palette: 'violet',
    layout: { header: 'banner', sectionTitle: 'bar', skills: 'pills', density: 'roomy' },
  }),
  defineTemplate({
    id: 'modern-02',
    name: 'Horizon',
    category: 'Modern',
    description: 'A heavy accent underline separates the header from the body.',
    useCase: 'Marketing and communications',
    palette: 'sky',
    layout: { header: 'underline', sectionTitle: 'side-rule', skills: 'pills' },
  }),
  defineTemplate({
    id: 'modern-03',
    name: 'Signal',
    category: 'Modern',
    description: 'A timeline runs down the experience section.',
    useCase: 'Showing steady career progression',
    palette: 'indigo',
    layout: { header: 'left', sectionTitle: 'dot', experience: 'timeline', skills: 'pills' },
  }),
  defineTemplate({
    id: 'modern-04',
    name: 'Atlas',
    category: 'Modern',
    description: 'A tinted sidebar carries your skills and contact details.',
    useCase: 'Roles where skills lead',
    palette: 'teal',
    layout: {
      columns: 'sidebar-left',
      header: 'tinted',
      sectionTitle: 'caps-wide',
      skills: 'bars',
      sidebar: ['skills', 'certifications'],
      order: ['summary', 'experience', 'education', 'projects'],
    },
  }),
  defineTemplate({
    id: 'modern-05',
    name: 'Vertex',
    category: 'Modern',
    description: 'Your initial sits in a coloured badge beside your name.',
    useCase: 'Personal-brand forward applications',
    palette: 'violet',
    layout: { header: 'initial', sectionTitle: 'bar', skills: 'pills' },
  }),
  defineTemplate({
    id: 'modern-06',
    name: 'Pulse',
    category: 'Modern',
    description: 'Skills shown as proficiency bars in a right-hand column.',
    useCase: 'Demonstrating depth across tools',
    palette: 'rose',
    layout: {
      columns: 'sidebar-right',
      header: 'banner',
      sectionTitle: 'plain',
      skills: 'bars',
      sidebar: ['skills', 'certifications'],
      order: ['summary', 'experience', 'education', 'projects'],
    },
  }),
  defineTemplate({
    id: 'modern-07',
    name: 'Cascade',
    category: 'Modern',
    description: 'Numbered headings step through the page in order.',
    useCase: 'Structured, process-driven roles',
    palette: 'emerald',
    layout: { header: 'left', sectionTitle: 'numbered', skills: 'outline' },
  }),
  defineTemplate({
    id: 'modern-08',
    name: 'Aperture',
    category: 'Modern',
    description: 'A tinted panel header with outlined skill tags beneath.',
    useCase: 'Creative-adjacent commercial roles',
    palette: 'plum',
    layout: { header: 'tinted', sectionTitle: 'side-rule', skills: 'outline', density: 'roomy' },
  }),
  defineTemplate({
    id: 'modern-09',
    name: 'Momentum',
    category: 'Modern',
    description: 'Leads with skills, then experience — useful for career changes.',
    useCase: 'Switching industry or function',
    palette: 'amber',
    layout: {
      header: 'underline',
      sectionTitle: 'bar',
      skills: 'grid',
      order: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
    },
  }),
  defineTemplate({
    id: 'modern-10',
    name: 'Nimbus',
    category: 'Modern',
    description: 'Soft dividers and roomy spacing give the page air.',
    useCase: 'Senior individual contributors',
    palette: 'sky',
    layout: { header: 'split', sectionTitle: 'dot', skills: 'pills', density: 'roomy', dividers: true },
  }),

  // ── Minimal ───────────────────────────────────────────────────────────────
  defineTemplate({
    id: 'minimal-01',
    name: 'Whitespace',
    category: 'Minimal',
    description: 'Very generous spacing and almost no decoration.',
    useCase: 'Short, focused resumes',
    palette: 'charcoal',
    layout: { header: 'left', sectionTitle: 'plain', skills: 'inline', density: 'roomy' },
    type: { nameSize: 32, nameTracking: -0.03 },
  }),
  defineTemplate({
    id: 'minimal-02',
    name: 'Hairline',
    category: 'Minimal',
    description: 'Thin rules between sections and nothing more.',
    useCase: 'Understated senior applications',
    palette: 'black',
    layout: { header: 'rule', sectionTitle: 'plain', skills: 'inline', dividers: true },
  }),
  defineTemplate({
    id: 'minimal-03',
    name: 'Quiet',
    category: 'Minimal',
    description: 'Small caps headings in a muted grey.',
    useCase: 'Design and editorial roles',
    palette: 'steel',
    layout: { header: 'left', sectionTitle: 'caps-wide', skills: 'inline', density: 'roomy' },
    type: { nameSize: 26 },
  }),
  defineTemplate({
    id: 'minimal-04',
    name: 'Column',
    category: 'Minimal',
    description: 'A narrow skills column beside an uncluttered main body.',
    useCase: 'Balancing brevity with detail',
    palette: 'slate',
    layout: {
      columns: 'sidebar-right',
      sidebarWidth: 28,
      header: 'left',
      sectionTitle: 'plain',
      skills: 'list',
      sidebar: ['skills', 'certifications'],
      order: ['summary', 'experience', 'education', 'projects'],
    },
  }),
  defineTemplate({
    id: 'minimal-05',
    name: 'Margin',
    category: 'Minimal',
    description: 'Dates sit out in the left margin, away from the prose.',
    useCase: 'Reading like a document, not a form',
    palette: 'charcoal',
    layout: { header: 'left', sectionTitle: 'plain', experience: 'dated-left', skills: 'inline', density: 'roomy' },
  }),
  defineTemplate({
    id: 'minimal-06',
    name: 'Understate',
    category: 'Minimal',
    description: 'Compact and monochrome, with one hairline under the name.',
    useCase: 'One-page constraints',
    palette: 'black',
    layout: { header: 'rule', sectionTitle: 'plain', skills: 'inline', density: 'compact' },
    type: { nameSize: 24 },
  }),

  // ── Creative ──────────────────────────────────────────────────────────────
  defineTemplate({
    id: 'creative-01',
    name: 'Canvas',
    category: 'Creative',
    description: 'A bold colour sidebar frames the whole page.',
    useCase: 'Design and art direction',
    palette: 'plum',
    layout: {
      columns: 'sidebar-left',
      sidebarWidth: 36,
      header: 'tinted',
      sectionTitle: 'bar',
      skills: 'pills',
      sidebar: ['skills', 'education', 'certifications'],
      order: ['summary', 'experience', 'projects'],
    },
  }),
  defineTemplate({
    id: 'creative-02',
    name: 'Studio',
    category: 'Creative',
    description: 'Letter-spaced capitals and a strong accent rule.',
    useCase: 'Portfolio-led applications',
    palette: 'rose',
    layout: { header: 'caps', sectionTitle: 'side-rule', skills: 'outline', density: 'roomy' },
    type: { nameCaps: true, nameTracking: 0.14, nameSize: 24 },
  }),
  defineTemplate({
    id: 'creative-03',
    name: 'Palette',
    category: 'Creative',
    description: 'Projects lead the page, ahead of employment history.',
    useCase: 'Freelance and contract work',
    palette: 'amber',
    layout: {
      header: 'banner',
      sectionTitle: 'dot',
      skills: 'pills',
      order: ['summary', 'projects', 'experience', 'skills', 'education', 'certifications'],
    },
  }),
  defineTemplate({
    id: 'creative-04',
    name: 'Mosaic',
    category: 'Creative',
    description: 'Skills arranged in a grid of tiles.',
    useCase: 'Broad multi-disciplinary skill sets',
    palette: 'teal',
    layout: { header: 'initial', sectionTitle: 'boxed', skills: 'grid' },
  }),
  defineTemplate({
    id: 'creative-05',
    name: 'Spotlight',
    category: 'Creative',
    description: 'An oversized name anchors a spacious, editorial layout.',
    useCase: 'Senior creative roles',
    palette: 'copper',
    layout: { header: 'underline', sectionTitle: 'caps-wide', skills: 'outline', density: 'roomy' },
    type: { nameSize: 36, nameTracking: -0.035 },
  }),
  defineTemplate({
    id: 'creative-06',
    name: 'Marque',
    category: 'Creative',
    description: 'A serif name over a colour-blocked sidebar.',
    useCase: 'Brand and content roles',
    palette: 'burgundy',
    layout: {
      columns: 'sidebar-left',
      header: 'tinted',
      sectionTitle: 'plain',
      skills: 'list',
      sidebar: ['skills', 'certifications', 'education'],
      order: ['summary', 'experience', 'projects'],
    },
    type: { font: 'sans', headingFont: 'serif', nameSize: 30 },
  }),
  defineTemplate({
    id: 'creative-07',
    name: 'Kinetic',
    category: 'Creative',
    description: 'A timeline plus outlined tags for a energetic feel.',
    useCase: 'Agency and startup applications',
    palette: 'violet',
    layout: { header: 'caps', sectionTitle: 'numbered', experience: 'timeline', skills: 'outline' },
    type: { nameCaps: true, nameTracking: 0.1, nameSize: 23 },
  }),

  // ── Executive ─────────────────────────────────────────────────────────────
  defineTemplate({
    id: 'executive-01',
    name: 'Principal',
    category: 'Executive',
    description: 'A serif face and centred header project seniority.',
    useCase: 'Director and VP applications',
    badge: 'Recommended',
    palette: 'navy',
    layout: { header: 'centered', sectionTitle: 'underline', skills: 'inline', density: 'roomy', dividers: true },
    type: { font: 'serif', nameSize: 32, nameTracking: -0.015 },
  }),
  defineTemplate({
    id: 'executive-02',
    name: 'Chairman',
    category: 'Executive',
    description: 'Formal capitals with a boxed header block.',
    useCase: 'Board and C-suite roles',
    palette: 'slate',
    layout: { header: 'boxed', sectionTitle: 'caps-wide', skills: 'inline', density: 'roomy' },
    type: { font: 'serif', nameCaps: true, nameTracking: 0.06, nameSize: 26 },
  }),
  defineTemplate({
    id: 'executive-03',
    name: 'Tenure',
    category: 'Executive',
    description: 'A dated left column presents a long career clearly.',
    useCase: 'Fifteen or more years of history',
    palette: 'burgundy',
    layout: { header: 'split', sectionTitle: 'underline', experience: 'dated-left', skills: 'inline' },
    type: { font: 'serif', nameSize: 30 },
  }),
  defineTemplate({
    id: 'executive-04',
    name: 'Mandate',
    category: 'Executive',
    description: 'Summary and achievements lead, with a restrained palette.',
    useCase: 'Executive search submissions',
    palette: 'forest',
    layout: { header: 'underline', sectionTitle: 'bar', skills: 'inline', density: 'roomy' },
    type: { font: 'serif', nameSize: 30 },
  }),
  defineTemplate({
    id: 'executive-05',
    name: 'Prestige',
    category: 'Executive',
    description: 'A tinted panel and serif headings, quietly authoritative.',
    useCase: 'Senior leadership',
    palette: 'charcoal',
    layout: { header: 'tinted', sectionTitle: 'caps-wide', skills: 'inline', density: 'roomy' },
    type: { headingFont: 'serif', nameSize: 30 },
  }),

  // ── Academic ──────────────────────────────────────────────────────────────
  defineTemplate({
    id: 'academic-01',
    name: 'Curriculum',
    category: 'Academic',
    description: 'Education first, in a formal serif, CV-style.',
    useCase: 'Academic and research posts',
    palette: 'navy',
    layout: {
      header: 'centered',
      sectionTitle: 'underline',
      skills: 'list',
      dividers: true,
      order: ['summary', 'education', 'experience', 'projects', 'certifications', 'skills'],
    },
    type: { font: 'serif', nameSize: 28 },
  }),
  defineTemplate({
    id: 'academic-02',
    name: 'Faculty',
    category: 'Academic',
    description: 'Publications-style spacing with numbered sections.',
    useCase: 'Teaching and faculty applications',
    palette: 'burgundy',
    layout: {
      header: 'left',
      sectionTitle: 'numbered',
      skills: 'list',
      density: 'roomy',
      order: ['summary', 'education', 'experience', 'projects', 'certifications', 'skills'],
    },
    type: { font: 'serif' },
  }),
  defineTemplate({
    id: 'academic-03',
    name: 'Thesis',
    category: 'Academic',
    description: 'A quiet single column that suits long-form detail.',
    useCase: 'Postgraduate and doctoral applications',
    palette: 'steel',
    layout: {
      header: 'rule',
      sectionTitle: 'caps-wide',
      skills: 'list',
      order: ['summary', 'education', 'projects', 'experience', 'certifications', 'skills'],
    },
    type: { font: 'serif', nameSize: 26 },
  }),
  defineTemplate({
    id: 'academic-04',
    name: 'Scholar',
    category: 'Academic',
    description: 'Education and certifications sit together in a sidebar.',
    useCase: 'Research and lab roles',
    palette: 'forest',
    layout: {
      columns: 'sidebar-left',
      header: 'left',
      sectionTitle: 'plain',
      skills: 'list',
      sidebar: ['education', 'certifications', 'skills'],
      order: ['summary', 'experience', 'projects'],
    },
    type: { font: 'serif' },
  }),

  // ── Tech ──────────────────────────────────────────────────────────────────
  defineTemplate({
    id: 'tech-01',
    name: 'Terminal',
    category: 'Tech',
    description: 'A monospaced face throughout, for engineers.',
    useCase: 'Backend and systems roles',
    badge: 'Popular',
    palette: 'slate',
    layout: { header: 'left', sectionTitle: 'plain', skills: 'inline', density: 'compact' },
    type: { font: 'mono', nameSize: 24, nameTracking: -0.01 },
  }),
  defineTemplate({
    id: 'tech-02',
    name: 'Stack',
    category: 'Tech',
    description: 'Skills lead the page as a dense, scannable grid.',
    useCase: 'Full-stack and platform engineering',
    palette: 'emerald',
    layout: {
      header: 'left',
      sectionTitle: 'bar',
      skills: 'grid',
      order: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
    },
    type: { headingFont: 'mono' },
  }),
  defineTemplate({
    id: 'tech-03',
    name: 'Repository',
    category: 'Tech',
    description: 'Projects sit directly beneath the summary, before roles.',
    useCase: 'Open-source and portfolio-led hiring',
    palette: 'sky',
    layout: {
      header: 'split',
      sectionTitle: 'side-rule',
      skills: 'outline',
      order: ['summary', 'projects', 'experience', 'skills', 'education', 'certifications'],
    },
    type: { headingFont: 'mono' },
  }),
  defineTemplate({
    id: 'tech-04',
    name: 'Deploy',
    category: 'Tech',
    description: 'A technical sidebar keeps the stack always visible.',
    useCase: 'DevOps and infrastructure',
    palette: 'teal',
    layout: {
      columns: 'sidebar-left',
      header: 'tinted',
      sectionTitle: 'plain',
      skills: 'list',
      sidebar: ['skills', 'certifications'],
      order: ['summary', 'experience', 'projects', 'education'],
    },
    type: { font: 'mono', nameSize: 22, headingFont: 'sans' },
  }),
  defineTemplate({
    id: 'tech-05',
    name: 'Compile',
    category: 'Tech',
    description: 'Compact monospaced rows fit a lot of detail on one page.',
    useCase: 'Detailed engineering histories',
    palette: 'charcoal',
    layout: { header: 'rule', sectionTitle: 'numbered', experience: 'compact', skills: 'inline', density: 'compact' },
    type: { font: 'mono', nameSize: 22 },
  }),
  defineTemplate({
    id: 'tech-06',
    name: 'Runtime',
    category: 'Tech',
    description: 'A timeline of roles with proficiency bars for the stack.',
    useCase: 'Showing growth through a technical career',
    palette: 'indigo',
    layout: {
      columns: 'sidebar-right',
      header: 'left',
      sectionTitle: 'dot',
      experience: 'timeline',
      skills: 'bars',
      sidebar: ['skills', 'certifications'],
      order: ['summary', 'experience', 'projects', 'education'],
    },
  }),
  defineTemplate({
    id: 'tech-07',
    name: 'Endpoint',
    category: 'Tech',
    description: 'A colour banner over a compact, technical single column.',
    useCase: 'Startup engineering applications',
    palette: 'violet',
    layout: { header: 'banner', sectionTitle: 'plain', skills: 'outline', density: 'compact' },
    type: { headingFont: 'mono' },
  }),

  // ── Entry level & specialist ──────────────────────────────────────────────
  defineTemplate({
    id: 'entry-01',
    name: 'First Step',
    category: 'Professional',
    description: 'Education and projects lead, for a short work history.',
    useCase: 'Graduates and first roles',
    badge: 'Recommended',
    palette: 'sky',
    layout: {
      header: 'centered',
      sectionTitle: 'bar',
      skills: 'pills',
      order: ['summary', 'education', 'projects', 'experience', 'skills', 'certifications'],
    },
  }),
  defineTemplate({
    id: 'entry-02',
    name: 'Intern',
    category: 'Professional',
    description: 'Roomy spacing keeps a shorter resume from looking sparse.',
    useCase: 'Internships and placements',
    palette: 'emerald',
    layout: {
      header: 'initial',
      sectionTitle: 'dot',
      skills: 'pills',
      density: 'roomy',
      order: ['summary', 'education', 'skills', 'projects', 'experience', 'certifications'],
    },
  }),
  defineTemplate({
    id: 'finance-01',
    name: 'Capital',
    category: 'Professional',
    description: 'Dense, serif and formal — built for finance.',
    useCase: 'Banking, audit and analysis',
    palette: 'navy',
    layout: { header: 'split', sectionTitle: 'underline', experience: 'compact', skills: 'inline', density: 'compact' },
    type: { font: 'serif' },
  }),
  defineTemplate({
    id: 'marketing-01',
    name: 'Campaign',
    category: 'Modern',
    description: 'A bright banner with results-focused spacing.',
    useCase: 'Marketing and brand roles',
    palette: 'rose',
    layout: { header: 'banner', sectionTitle: 'side-rule', skills: 'pills', density: 'roomy' },
  }),
  defineTemplate({
    id: 'sales-01',
    name: 'Quota',
    category: 'Professional',
    description: 'Achievements sit high, with skills as prominent tags.',
    useCase: 'Sales and business development',
    palette: 'amber',
    layout: {
      header: 'underline',
      sectionTitle: 'bar',
      skills: 'pills',
      order: ['summary', 'experience', 'skills', 'education', 'projects', 'certifications'],
    },
  }),
  defineTemplate({
    id: 'healthcare-01',
    name: 'Practice',
    category: 'Professional',
    description: 'Certifications raised near the top, where they matter most.',
    useCase: 'Healthcare and licensed professions',
    palette: 'teal',
    layout: {
      header: 'centered',
      sectionTitle: 'underline',
      skills: 'list',
      dividers: true,
      order: ['summary', 'experience', 'certifications', 'education', 'skills', 'projects'],
    },
  }),
  defineTemplate({
    id: 'ops-01',
    name: 'Logistics',
    category: 'Professional',
    description: 'A compact two-column layout for detail-heavy histories.',
    useCase: 'Operations and supply chain',
    palette: 'steel',
    layout: {
      columns: 'sidebar-right',
      header: 'left',
      sectionTitle: 'plain',
      skills: 'list',
      density: 'compact',
      sidebar: ['skills', 'certifications', 'education'],
      order: ['summary', 'experience', 'projects'],
    },
  }),
]

/** The template used when a resume has none, or names one we don't recognise. */
export const DEFAULT_TEMPLATE_ID = 'classic'

const TEMPLATES_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]))

/**
 * Look up a template by id, falling back to the default.
 *
 * Never throws and never returns undefined: a resume saved with a template that
 * has since been renamed or removed still renders, just in the default design.
 */
export function getTemplate(id?: string | null): TemplateSpec {
  if (id) {
    const found = TEMPLATES_BY_ID.get(id)
    if (found) return found
  }
  return TEMPLATES_BY_ID.get(DEFAULT_TEMPLATE_ID) ?? TEMPLATES[0]
}

/** True when `id` names a template in the catalog. */
export function isKnownTemplate(id?: string | null): boolean {
  return !!id && TEMPLATES_BY_ID.has(id)
}
