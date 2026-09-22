/** Release capability only. No observation, withheld-record count or approval toggle. */
export const SECURITY_PUBLIC_CONTENT_BLOCKER = 'PUBLIC_CONTENT_NOT_AUTHORISED' as const;

export const HUMANITARIAN_PUBLIC_READ_BLOCKERS = Object.freeze([
  'REVIEWED_CAPTURE_REQUIRED',
  'CURRENT_PROTECTION_AUTHORITY_REQUIRED',
  'PUBLIC_OBSERVATION_READER_REQUIRED',
] as const);
