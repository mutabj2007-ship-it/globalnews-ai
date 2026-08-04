import type { LucideIcon } from 'lucide-react';

export interface NavLink {
  label: string;
  href: string;
}

export interface ProcessStep {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface TrustItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface FooterLinkGroup {
  title: string;
  links: Array<{
    label: string;
    href: string;
    comingSoon?: boolean;
  }>;
}
