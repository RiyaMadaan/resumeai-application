import type { Resume } from '@/types/resume'

/**
 * Realistic sample content for template previews.
 *
 * Gallery thumbnails render this through the same renderer the real resume
 * uses, so a card shows the actual design rather than a mock-up of one. It is
 * only ever used for previews — nothing here is written to a user's resume.
 */
export const SAMPLE_RESUME: Resume = {
  _id: 'sample',
  userId: 'sample',
  title: 'Sample',
  personalInfo: {
    fullName: 'Alex Morgan',
    email: 'alex.morgan@email.com',
    phone: '(555) 234-8890',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexmorgan',
    website: 'alexmorgan.dev',
  },
  summary:
    'Senior product engineer with eight years building customer-facing web applications. Leads cross-functional teams, ships measurable outcomes, and mentors engineers through design and delivery.',
  experience: [
    {
      company: 'Northwind Technologies',
      role: 'Senior Product Engineer',
      location: 'San Francisco, CA',
      startDate: 'Mar 2021',
      endDate: '',
      current: true,
      bullets: [
        'Led the checkout rebuild that lifted conversion 23% across 1.2M monthly sessions.',
        'Cut median page load from 3.1s to 1.4s by reworking the rendering pipeline.',
        'Mentored five engineers; three were promoted within eighteen months.',
      ],
    },
    {
      company: 'Brightlane Software',
      role: 'Product Engineer',
      location: 'Austin, TX',
      startDate: 'Jun 2018',
      endDate: 'Feb 2021',
      current: false,
      bullets: [
        'Shipped a self-serve onboarding flow adopted by 40% of new accounts.',
        'Built the design system now used across four product teams.',
      ],
    },
    {
      company: 'Cedar Analytics',
      role: 'Software Engineer',
      location: 'Remote',
      startDate: 'Aug 2016',
      endDate: 'May 2018',
      current: false,
      bullets: ['Delivered reporting dashboards for 200+ enterprise customers.'],
    },
  ],
  education: [
    {
      institution: 'University of Washington',
      degree: 'B.S.',
      field: 'Computer Science',
      startDate: '2012',
      endDate: '2016',
    },
  ],
  skills: [
    'TypeScript',
    'React',
    'Node.js',
    'PostgreSQL',
    'AWS',
    'System Design',
    'Testing',
    'Mentoring',
  ],
  projects: [
    {
      name: 'Openbench',
      description: 'Open-source benchmarking suite for web rendering performance.',
      technologies: ['TypeScript', 'Playwright'],
      link: 'github.com/example/openbench',
    },
  ],
  certifications: ['AWS Solutions Architect – Associate'],
  template: 'classic',
  createdAt: '',
  updatedAt: '',
}
