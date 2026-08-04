import {
  Search,
  Layers,
  BookOpenCheck,
  ShieldCheck,
  Scale,
  Sparkles,
  RadioTower,
  GraduationCap,
} from 'lucide-react';
import type { ProcessStep, TrustItem, FooterLinkGroup } from '@/types/home';

/**
 * Rotating example queries shown in/under the hero search bar.
 */
export const exampleSearches: string[] = [
  'What\u2019s happening in the Middle East right now?',
  'Explain the new EU AI regulation in plain English',
  'Summarize today\u2019s central bank announcement',
  'What are scientists saying about the latest climate report?',
  'Break down this week\u2019s tech earnings',
  'What changed in the election polling this week?',
];

/**
 * "How It Works" is a genuine three-step sequence, so numbering here
 * encodes real order rather than decorating the section.
 */
export const processSteps: ProcessStep[] = [
  {
    step: '01',
    title: 'Ask anything',
    description:
      'Type a question the way you\u2019d ask a well-informed friend \u2014 no keywords or search syntax required.',
    icon: Search,
  },
  {
    step: '02',
    title: 'AI reads the coverage',
    description:
      'GlobalNews AI scans reporting from multiple outlets and viewpoints, then reconciles what they agree and disagree on.',
    icon: Layers,
  },
  {
    step: '03',
    title: 'You get a clear answer',
    description:
      'A concise, sourced summary \u2014 with the original articles linked, so you can always go deeper.',
    icon: BookOpenCheck,
  },
];

export const trustItems: TrustItem[] = [
  {
    title: 'Full transparency',
    description:
      'Every summary links back to its original sources, so you can verify anything GlobalNews AI tells you.',
    icon: ShieldCheck,
  },
  {
    title: 'Multiple viewpoints',
    description:
      'We surface how different outlets and regions are covering the same story \u2014 not just one narrative.',
    icon: Scale,
  },
  {
    title: 'AI summaries, clearly labeled',
    description:
      'AI-generated context is always marked as such, and kept separate from direct reporting.',
    icon: Sparkles,
  },
  {
    title: 'Live updates',
    description:
      'Stories evolve as new reporting comes in, and your summary updates with them.',
    icon: RadioTower,
  },
  {
    title: 'Educational context',
    description:
      'Unfamiliar with a topic? GlobalNews AI fills in the background you need, not just the headline.',
    icon: GraduationCap,
  },
];

export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
  {
    title: 'Developers',
    links: [{ label: 'API', href: '/api', comingSoon: true }],
  },
];
