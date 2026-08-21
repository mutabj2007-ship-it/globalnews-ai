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

/**
 * Milestone #53 — MVP release-gate remediation. Every entry
 * previously here (About, Careers, Contact, Privacy Policy, Terms of
 * Service, API) pointed at a route that does not currently exist in
 * this Next.js app (confirmed via direct route inspection — only '/'
 * and '/map' are real). Footer.tsx renders these flattened with no
 * group-title UI (see that file's own comment), so an empty array
 * here renders zero footer links with no leftover visual artifact —
 * the same "remove the dead destination, don't fabricate a page"
 * correction applied to primaryNavLinks in navigation.ts. Re-add an
 * entry to the appropriate group only once its real route exists.
 *
 * B2 — Public Legal Surfaces: /privacy and /terms are now real
 * Next.js routes (frontend/src/app/privacy/page.tsx and
 * frontend/src/app/terms/page.tsx), so exactly these two entries are
 * reintroduced here. About/Careers/Contact/API remain excluded —
 * none of those have real routes yet. label values here are the
 * English fallback only; Footer.tsx already prefers
 * t.linkLabels[link.href] when present (see its own
 * `t.linkLabels[link.href] ?? link.label`), and both '/privacy' and
 * '/terms' already have real English and Polish entries in
 * footer.linkLabels in both dictionary files.
 *
 * M66.10B — SOURCE POLICY. A third entry joins the Legal group on
 * exactly the same terms as the B2 pair: the route is real and shipped
 * in this same change (frontend/src/app/source-policy/page.tsx), and
 * '/source-policy' has real English and Polish footer.linkLabels
 * entries in both dictionary files. The route is created BEFORE the
 * link is added, never the other way round.
 *
 * This is the ONLY file that had to change for the Footer to render a
 * third link. Footer.tsx holds no destination list of its own — it
 * maps footerLinkGroups.flatMap(...) — so it is untouched by this
 * milestone (M66.10A §D.1, CTO decision: "Footer.tsx MUST remain
 * untouched unless a concrete contradiction is discovered"; none was).
 *
 * About/Careers/Contact/API remain excluded and remain guarded as dead
 * destinations in footerGeometry.spec.ts and footerNavHud.spec.ts. The
 * MVP footer destination set is exactly: /privacy, /source-policy,
 * /terms.
 */
export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/source-policy', label: 'Source Policy' },
    ],
  },
];
