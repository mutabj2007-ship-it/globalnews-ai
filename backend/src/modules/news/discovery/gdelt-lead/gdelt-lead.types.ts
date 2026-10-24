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

/*
  E1 ADDENDUM-22 (V5 GO WITH CONDITIONS, C-V5-1…C-V5-9) — the governed record. The wording is E1's,
  verbatim. The hash is over the RAW bytes Main captured over HTTPS (E1 would not hash model-processed
  text): R153-RETRIEVAL/MAIN/GDELT-TERMS-CAPTURE-20261024/ (www.gdeltproject.org 301 → gdeltproject.org,
  24,355 bytes, last-modified 2022-09-03; the grant and citation sentences E1 quoted are present).
  Filling it switches NOTHING on: discovery still needs GDELT_LEAD_DISCOVERY_ENABLED=true (Alpha BE
  only) and the UI needs COVERAGE_LEADS_UI_ENABLED. Re-read the terms at every expansion (C-V5-3).
*/
export const GDELT_LEAD_USE_RECORD: GdeltLeadUseRecord | null = Object.freeze({
  termsUrl: 'https://gdeltproject.org/about.html',
  termsSha256: '384754b514042255c4542d51dc1e631da55c83c67d46a92b53b48a812d94be6b',
  termsReadAt: '2026-10-24T08:09:08Z',
  e1VerdictRef:
    'E1 ADDENDUM-19 §2, §2.1–§2.4, C-G1…C-G4 + ADDENDUM-22 (V5 GO WITH CONDITIONS), C-V5-1…C-V5-9',
  e1Wording:
    "GDELT's published terms grant unlimited and unrestricted use of the GDELT datasets, for any purpose including commercial, provided every use or redistribution carries a citation to The GDELT Project and a link to its website; those terms are silent on the publishers' articles the index points at, so GlobalNewsAI may use only GDELT's own observed fields — the URL, the outlet domain, the observation time (never presented as a publication date), the language, and the outlet country as GDELT asserts it — must never render, store or model a publisher's title, snippet or image, and must never fetch anything from a publisher's host on the strength of this licence.",
});

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
