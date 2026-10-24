/*
  GDELT LEAD-ONLY DISCOVERY — OFFLINE, UNREGISTERED (CTO R165, #95 6380702906; spec #95 6377028893).

  A lead is a PRIVATE HINT that a URL exists. It is not an article, not evidence, not a citation,
  not a "source searched", and not permission to read the publisher. Nothing in this folder is
  imported by a Nest module, an answer/telemetry builder or the frontend (a structural spec proves it).

  E1 ADDENDUM-19 §2 / C-G4 — exactly five GDELT fields, allowlisted on the TYPE:
    url, domain, seendate (as an OBSERVATION date), language, sourcecountry (provider-asserted).
  The publisher's title is HOLD: there is no field for it, so it can never be logged, stored,
  rendered or sent to a model from here.
*/

/** E1 C-G1 — attribution travels in provenance with every lead. */
export const GDELT_ATTRIBUTION = Object.freeze({
  citation: 'The GDELT Project',
  link: 'https://www.gdeltproject.org/',
} as const);

export interface GdeltLead {
  /** canonical https URL; an address used for routing, never rendered as a link to content */
  readonly url: string;
  /** outlet host as GDELT reports it (a fact) */
  readonly domain: string;
  /** GDELT `seendate`: when GDELT SAW it. Never a publication date (E1 §2.1). */
  readonly observedAt: string;
  /** GDELT's own language classification, verbatim */
  readonly language: string | null;
  /** GDELT `sourcecountry`: the OUTLET's country name, verbatim; never an ISO-3, never the story's place (E1 §2.2) */
  readonly providerCountry: string | null;
  readonly attribution: typeof GDELT_ATTRIBUTION;
}

/** The six keys a lead may carry. Built, never filtered (R-B): anything else cannot exist. */
export const GDELT_LEAD_KEYS = Object.freeze([
  'url',
  'domain',
  'observedAt',
  'language',
  'providerCountry',
  'attribution',
] as const);

/*
  CTO R165 §GDELT 3 — the governed record live use requires: the ACTUAL terms hash read over HTTPS,
  the read time, and E1's affirmative wording for this exact use. There is no placeholder: until a
  reviewed commit fills it, the record is `null` and discovery answers NOT_AUTHORIZED.
*/
export interface GdeltLeadUseRecord {
  readonly termsUrl: string;
  readonly termsSha256: string;
  readonly termsReadAt: string;
  readonly e1VerdictRef: string;
  readonly e1Wording: string;
}

export const GDELT_LEAD_USE_RECORD: GdeltLeadUseRecord | null = null;

/*
  CTO R165 §GDELT 1 — a host-wide clearance is NOT a fetch licence. The only positive answer names
  the publisher RESOURCE (an exact path prefix on an exact host), the METHOD, a robots verdict for
  that path, and the E1 per-use reference. Anything else refuses.
*/
export type ResourceAdmission =
  | {
      readonly admitted: true;
      readonly host: string;
      readonly pathPrefix: string;
      readonly method: 'GET';
      readonly robots: 'ALLOWED';
      readonly e1PerUseRef: string;
    }
  | { readonly admitted: false; readonly reason: LeadDropReason };

export interface ResourceRequest {
  readonly host: string;
  readonly path: string;
  readonly method: 'GET';
}

export type ResourceAdmitter = (request: ResourceRequest) => ResourceAdmission;

export type LeadDropReason =
  | 'URL_REFUSED'
  | 'HOST_NOT_CLEARED'
  | 'RESOURCE_NOT_COVERED'
  | 'ROBOTS_DISALLOWED'
  | 'NO_RECORDED_RIGHT'
  | 'REDIRECT_REFUSED';

/** A URL to read through an ALREADY-cleared lane. Never content. */
export interface CandidateUrl {
  readonly url: string;
  readonly e1PerUseRef: string;
  readonly attribution: typeof GDELT_ATTRIBUTION;
}

export interface DroppedLead {
  readonly url: string;
  readonly reason: LeadDropReason;
  readonly detail?: string;
}

/*
  Counting rule (spec §5): the result has NO articles, sourcesSearched, citations or
  reportingClusters field, so no builder can add a lead to any count.
*/
export type LeadDiscoveryState = 'OFF' | 'NOT_AUTHORIZED' | 'LIVE_WIRING_ABSENT' | 'LEADS';

export interface LeadDiscoveryResult {
  readonly state: LeadDiscoveryState;
  readonly leads: readonly GdeltLead[];
}
