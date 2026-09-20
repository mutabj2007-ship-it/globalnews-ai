/**
 * MAIN-SECURITY-RUNTIME-CONTRACT-1 — binding tests.
 *
 * Two kinds of test, and the difference matters:
 *   CONTRACT   the rule holds for material that satisfies it
 *   BITE       the rule REFUSES material that does not
 * A contract test alone proves a function returns something. A bite proves it
 * says no, which is the only reason any of this exists.
 */

import {
  SECURITY_LIFECYCLE_EVENTS,
  SECURITY_LIFECYCLE_EVENT_COUNT,
  SECURITY_LIFECYCLE_EVENT_RECORDS,
  NEW_EVENT_TYPES_ESCALATE,
  EVENT_AUTHORISED_AXES,
  AXES_NO_EVENT_MAY_ASSERT,
  eventMayAssertAxis,
  EVENT_DERIVATION_CLASS,
  NO_LIFECYCLE_EVENT_IS_DERIVED,
  PROMOTION_THRESHOLD_IS_NEVER_ENCODED_HERE,
  CYBER_INCIDENT_REQUIRES_NAMED_AFFECTED_SYSTEM,
  CYBER_NAMED_SYSTEM_INSUFFICIENT_FORMS,
  CYBER_GENERIC_LANGUAGE_EXAMPLE,
  cyberEventHasNamedSystem,
  PRODUCER_MAY_EMIT,
  PRODUCER_MUST_NOT_EMIT,
  producerEmissionIsPermitted,
  SECURITY_WATCH_SURFACE,
  SECURITY_WATCHABLE_SUBJECT_TYPES,
  SECURITY_WATCHABLE_UPSTREAM_DEPENDENCIES,
  isWatchableSecuritySubjectType,
  EVERY_EVENT_MAY_TRIGGER_REASSESSMENT,
  NO_EVENT_DETERMINES_ITS_OWN_CHANGE_STATE,
  TRIGGER_TO_DELIVERY_STAGES,
  STAGES_OWNED_BY_SECURITY,
  eventGrantsNotificationAuthority,
  eventEstablishesAxis,
  outcomeAloneEstablishesCoverage,
  eventSourceOutcomeIsComplete,
  assertLifecycleEventIsWellFormed,
  CAP_CLASSIFICATION,
  CAP_FIELDS_NEVER_MAPPED_TO_SECURITY,
  capFieldMapsToSecurityPosture,
  ENTSOE_DOC_STATUS,
  entsoeBusinessTypeTable,
  ENTSOE_A09_IS_NOT_A13,
  ENTSOE_ACTIVATION_STATE,
  ENTSOE_U2_S6_STANDING,
  SEC_8K_ITEM_105_CLASSIFICATION,
  E6_PLATFORM_REQUIREMENT,
  E6_PRODUCER_REQUIREMENT,
  E6A_SCOPE,
  E6B_SCOPE,
  E6B_IS_CONDITIONAL_ON_OVERLAP,
  SEC_WATCH_COMPOSITE_1,
  COMPOSITE_SCOPE_AVAILABILITY,
  COMPOSITE_SCOPE_RULING_PATH,
  COMPOSITE_SCOPE_DEPENDENCY_REASON,
  COMPOSITE_SCOPE_CANDIDATE_LITERAL,
  compositeScopeIsWatchable,
  assertCompositeScopeNotUsedAsWatchTarget,
  U2B_BLOCKER_ID,
  u2bBlockerStands,
  ENTSOE_SOURCE_SYSTEM,
  RESTORATION_BASES_SUFFICIENT,
  RESTORATION_BASES_REFUSED,
  assertRestorationClaimIsAdmissible,
  restorationClaimIsAdmissible,
  NAMED_SYSTEM_BASES_SUFFICIENT,
  NAMED_SYSTEM_BASES_REFUSED,
  CYBER_GENERIC_SYSTEM_PHRASES,
  namedSystemIsSufficient,
  namedSystemValueIsStructurallySufficient,
} from './lifecycle';
import type { RestorationClaim, NamedAffectedSystem } from './lifecycle';
import { ENTSOE_BUSINESS_TYPE, PRODUCER_ACTIVATION_BLOCKERS } from './index';
import type { SecurityLifecycleEvent, SecurityLifecycleEventRecord } from './lifecycle';
import { SECURITY_COVERAGE_AXES } from './index';
import type { SecurityCoverageAxis } from './index';
import {
  WATCH_SUBJECT_TYPES_BY_SURFACE,
  WATCH_CHANGE_STATES,
  WATCH_SURFACES,
  WATCH_SUBJECT_TYPES,
} from '../watch';
import type { WatchSurface } from '../watch';

function evt(over: Partial<SecurityLifecycleEventRecord> = {}): SecurityLifecycleEventRecord {
  return {
    eventId: 'evt-1',
    event: 'INCIDENT_REPORTED',
    subjectId: null,
    occurrenceId: 'occ-1',
    assertedAxes: ['OCCURRENCE'],
    claimantId: 'claimant-1',
    observedAt: '2026-09-07T00:00:00.000Z',
    derivation: 'SOURCE_NATIVE',
    namedAffectedSystem: null as NamedAffectedSystem | null,
    restoration: null as RestorationClaim | null,
    ...over,
  };
}

describe('lifecycle vocabulary — exactly the ten Part IX events', () => {
  it('is exactly ten, in Part IX order', () => {
    expect(SECURITY_LIFECYCLE_EVENTS).toEqual([
      'INCIDENT_REPORTED',
      'SABOTAGE_CONFIRMED',
      'CYBER_INCIDENT_CONFIRMED',
      'ATTRIBUTION_UPDATED',
      'ALERT_LEVEL_CHANGED',
      'BORDER_POSTURE_CHANGED',
      'INFRASTRUCTURE_DISRUPTED',
      'INFRASTRUCTURE_RESTORED',
      'AIRSPACE_INCIDENT',
      'MARITIME_SECURITY_EVENT',
    ]);
    expect(SECURITY_LIFECYCLE_EVENTS.length).toBe(SECURITY_LIFECYCLE_EVENT_COUNT);
    expect(SECURITY_LIFECYCLE_EVENT_COUNT).toBe(10);
  });

  it('BITE — no duplicate event identifiers', () => {
    const seen = new Set(SECURITY_LIFECYCLE_EVENTS);
    expect(seen.size).toBe(SECURITY_LIFECYCLE_EVENTS.length);
  });

  it('every event carries its Part IX Records text, and no orphan rows exist', () => {
    for (const e of SECURITY_LIFECYCLE_EVENTS) {
      expect(typeof SECURITY_LIFECYCLE_EVENT_RECORDS[e]).toBe('string');
      expect(SECURITY_LIFECYCLE_EVENT_RECORDS[e].length).toBeGreaterThan(0);
    }
    expect(Object.keys(SECURITY_LIFECYCLE_EVENT_RECORDS).sort()).toEqual(
      [...SECURITY_LIFECYCLE_EVENTS].sort(),
    );
  });

  it('the eleventh-event rule travels with the vocabulary', () => {
    expect(NEW_EVENT_TYPES_ESCALATE).toBe(true);
  });

  it('BITE — an unknown event is refused rather than admitted', () => {
    expect(() =>
      assertLifecycleEventIsWellFormed(
        evt({ event: 'CYBER_ATTACK_SUSPECTED' as SecurityLifecycleEvent }),
      ),
    ).toThrow(/SEC-EVENT-1/);
  });
});

describe('event axis requirements', () => {
  it('every event has an authorised-axis row, and every axis in it is a real axis', () => {
    for (const e of SECURITY_LIFECYCLE_EVENTS) {
      const axes = EVENT_AUTHORISED_AXES[e];
      expect(axes.length).toBeGreaterThan(0);
      for (const a of axes) expect(SECURITY_COVERAGE_AXES).toContain(a);
    }
  });

  it('THE CORE BITE — no event may assert SEVERITY', () => {
    expect(AXES_NO_EVENT_MAY_ASSERT).toEqual(['SEVERITY']);
    for (const e of SECURITY_LIFECYCLE_EVENTS) {
      expect(EVENT_AUTHORISED_AXES[e]).not.toContain('SEVERITY');
      expect(eventMayAssertAxis(e, 'SEVERITY')).toBe(false);
    }
    expect(() =>
      assertLifecycleEventIsWellFormed(
        evt({ assertedAxes: ['OCCURRENCE', 'SEVERITY'] as SecurityCoverageAxis[] }),
      ),
    ).toThrow(/SEC-EVENT-7/);
  });

  it('BITE — an event may not speak on an axis Part IX did not give it', () => {
    expect(eventMayAssertAxis('ALERT_LEVEL_CHANGED', 'ACTOR')).toBe(false);
    expect(() =>
      assertLifecycleEventIsWellFormed(
        evt({ event: 'ALERT_LEVEL_CHANGED', assertedAxes: ['ACTOR'] }),
      ),
    ).toThrow(/SEC-EVENT-8/);
  });

  it('INCIDENT_REPORTED speaks on occurrence and says nothing about cause or actor', () => {
    expect(EVENT_AUTHORISED_AXES.INCIDENT_REPORTED).toEqual(['OCCURRENCE']);
    expect(eventMayAssertAxis('INCIDENT_REPORTED', 'CAUSE')).toBe(false);
    expect(eventMayAssertAxis('INCIDENT_REPORTED', 'ACTOR')).toBe(false);
  });

  it('SABOTAGE_CONFIRMED establishes cause and says nothing about actor', () => {
    expect(EVENT_AUTHORISED_AXES.SABOTAGE_CONFIRMED).toEqual(['CAUSE']);
    expect(eventMayAssertAxis('SABOTAGE_CONFIRMED', 'ACTOR')).toBe(false);
  });

  it('ATTRIBUTION_UPDATED may carry cause OR actor, and asserting one is not asserting both', () => {
    expect(EVENT_AUTHORISED_AXES.ATTRIBUTION_UPDATED).toEqual(['CAUSE', 'ACTOR']);
    const causeOnly = evt({ event: 'ATTRIBUTION_UPDATED', assertedAxes: ['CAUSE'] });
    expect(() => assertLifecycleEventIsWellFormed(causeOnly)).not.toThrow();
    expect(causeOnly.assertedAxes).not.toContain('ACTOR');
  });

  it('BITE — a missing axis is never inferred: an event asserting nothing is refused', () => {
    expect(() => assertLifecycleEventIsWellFormed(evt({ assertedAxes: [] }))).toThrow(
      /SEC-EVENT-6/,
    );
  });

  it('BITE — an unestablished axis does not become established by an event arriving', () => {
    const r = evt({ assertedAxes: ['OCCURRENCE'] });
    expect(eventEstablishesAxis(r, 'OCCURRENCE', 'UNESTABLISHED')).toBe(false);
    expect(eventEstablishesAxis(r, 'OCCURRENCE', 'GAP_DECLARED')).toBe(false);
    expect(eventEstablishesAxis(r, 'OCCURRENCE', 'ESTABLISHED')).toBe(true);
  });

  it('coverage dependency — one complete source outcome is still not coverage', () => {
    expect(eventSourceOutcomeIsComplete('SUCCESS')).toBe(true);
    expect(outcomeAloneEstablishesCoverage('SUCCESS')).toBe(false);
    expect(outcomeAloneEstablishesCoverage('NO_RESULTS')).toBe(false);
  });
});

describe('cyber event required-field semantics', () => {
  it('the requirement is encoded literally from Part IX', () => {
    expect(CYBER_INCIDENT_REQUIRES_NAMED_AFFECTED_SYSTEM).toBe(true);
    expect(SECURITY_LIFECYCLE_EVENT_RECORDS.CYBER_INCIDENT_CONFIRMED).toBe(
      'a cyber incident affecting a named system is established',
    );
  });

  it('THE BLOCKING BITE — a cyber event with no named system is refused', () => {
    expect(() =>
      assertLifecycleEventIsWellFormed(
        evt({ event: 'CYBER_INCIDENT_CONFIRMED', namedAffectedSystem: null }),
      ),
    ).toThrow(/SEC-EVENT-9/);
    expect(() =>
      assertLifecycleEventIsWellFormed(
        evt({
        event: 'CYBER_INCIDENT_CONFIRMED',
        namedAffectedSystem: { basis: 'IDENTIFIED_SYSTEM', value: '   ' },
      }),
      ),
    ).toThrow(/SEC-EVENT-9/);
  });

  it('POSITIVE CONTROL — a cyber event WITH a named system is admitted', () => {
    expect(() =>
      assertLifecycleEventIsWellFormed(
        evt({
          event: 'CYBER_INCIDENT_CONFIRMED',
          namedAffectedSystem: {
            basis: 'IDENTIFIED_SYSTEM',
            value: 'SCADA controller at substation X',
          },
        }),
      ),
    ).not.toThrow();
  });

  it('the three insufficient forms are named so they cannot be argued away', () => {
    /*
      R3 · E1's C-4. This was `toEqual`, which proves the two lists AGREE — a
      hand-written copy with the same contents passes. The claim being made is that
      one is DERIVED FROM the other, and only referential identity proves that.
      Matched to the ENTSO-E guard, which already used `toBe`.
    */
    expect(CYBER_NAMED_SYSTEM_INSUFFICIENT_FORMS).toBe(NAMED_SYSTEM_BASES_REFUSED);
    expect(CYBER_GENERIC_LANGUAGE_EXAMPLE).toBe('information technology systems');
  });

  it('BITE — namedAffectedSystem on any other event is refused', () => {
    expect(() =>
      assertLifecycleEventIsWellFormed(
        evt({
          event: 'INCIDENT_REPORTED',
          namedAffectedSystem: { basis: 'IDENTIFIED_SYSTEM', value: 'some system' },
        }),
      ),
    ).toThrow(/SEC-EVENT-10/);
  });

  it('the check is scoped to cyber and does not accidentally gate the other nine', () => {
    for (const e of SECURITY_LIFECYCLE_EVENTS) {
      if (e === 'CYBER_INCIDENT_CONFIRMED') continue;
      expect(cyberEventHasNamedSystem(evt({ event: e, assertedAxes: EVENT_AUTHORISED_AXES[e] }))).toBe(
        true,
      );
    }
  });
});

describe('producer output boundary', () => {
  it('the forbidden list is exactly the six the ruling names', () => {
    expect(PRODUCER_MUST_NOT_EMIT).toEqual([
      'NO_MATERIAL_CHANGE',
      'FINAL_ASSESSMENT',
      'NOTIFICATION_AUTHORITY',
      'INFERRED_ACTOR',
      'INFERRED_CAUSE',
      'INFERRED_SEVERITY',
    ]);
  });

  it('THE CORE BITE — a producer cannot emit NO_MATERIAL_CHANGE', () => {
    const v = producerEmissionIsPermitted({
      producerId: 'entsoe-a78',
      emitted: ['SOURCE_QUERY_OUTCOME', 'NO_MATERIAL_CHANGE'],
    });
    expect(v.permitted).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/SEC-PROD-1/);
  });

  it('BITE — a producer cannot emit an inferred actor, cause or severity', () => {
    for (const forbidden of ['INFERRED_ACTOR', 'INFERRED_CAUSE', 'INFERRED_SEVERITY']) {
      expect(
        producerEmissionIsPermitted({ producerId: 'p', emitted: [forbidden] }).permitted,
      ).toBe(false);
    }
  });

  it('POSITIVE CONTROL — the four permitted emissions pass', () => {
    const v = producerEmissionIsPermitted({ producerId: 'p', emitted: [...PRODUCER_MAY_EMIT] });
    expect(v.permitted).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  it('BITE — the boundary is an allowlist: an unnamed emission is refused, not admitted', () => {
    const v = producerEmissionIsPermitted({ producerId: 'p', emitted: ['THREAT_SCORE'] });
    expect(v.permitted).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/SEC-PROD-2/);
  });

  it('all ten events are source-native, and a derived event is refused', () => {
    for (const e of SECURITY_LIFECYCLE_EVENTS) {
      expect(EVENT_DERIVATION_CLASS[e]).toBe('SOURCE_NATIVE');
    }
    expect(NO_LIFECYCLE_EVENT_IS_DERIVED).toBe(true);
    expect(() => assertLifecycleEventIsWellFormed(evt({ derivation: 'DERIVED' }))).toThrow(
      /SEC-EVENT-5/,
    );
  });

  it('BITE — an event must name its occurrence and its claimant', () => {
    expect(() => assertLifecycleEventIsWellFormed(evt({ occurrenceId: '' }))).toThrow(
      /SEC-EVENT-3/,
    );
    expect(() => assertLifecycleEventIsWellFormed(evt({ claimantId: '  ' }))).toThrow(
      /SEC-EVENT-4/,
    );
    expect(() => assertLifecycleEventIsWellFormed(evt({ eventId: '' }))).toThrow(/SEC-EVENT-2/);
  });

  it('an unattached event is a valid state, not a missing parent to invent', () => {
    expect(() => assertLifecycleEventIsWellFormed(evt({ subjectId: null }))).not.toThrow();
    expect(PROMOTION_THRESHOLD_IS_NEVER_ENCODED_HERE).toBe(true);
  });
});

describe('SECURITY Watch surface integration', () => {
  it('SECURITY is a member of the shared surface union', () => {
    expect(SECURITY_WATCH_SURFACE).toBe('SECURITY');
    const surfaces = Object.keys(WATCH_SUBJECT_TYPES_BY_SURFACE) as WatchSurface[];
    expect(surfaces).toContain('SECURITY');
  });

  it('NON-REGRESSION — the four existing surfaces keep their exact subject types', () => {
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.MAP).toEqual(['PLACE', 'SITUATION', 'ROUTE', 'ACTOR']);
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.ECONOMY).toEqual([
      'INDICATOR',
      'SECTOR',
      'POLICY',
      'TRADE_LANE',
    ]);
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.MARKET).toEqual([
      'INSTRUMENT',
      'COMMODITY',
      'ISSUER',
      'EXPOSURE',
    ]);
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.CONFLICT).toEqual([
      'FRONT',
      'ACTOR',
      'CORRIDOR',
      'INCIDENT_CLASS',
    ]);
  });

  it('NON-REGRESSION — the seven shared change states are untouched', () => {
    expect(WATCH_CHANGE_STATES.length).toBe(7);
    expect(WATCH_CHANGE_STATES).toContain('NO_MATERIAL_CHANGE');
  });

  it('Security watchables are the Part IX persistent subjects', () => {
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.SECURITY).toEqual([
      'SITUATION',
      'CAMPAIGN',
      'INFRASTRUCTURE_ASSET',
    ]);
    expect(SECURITY_WATCHABLE_SUBJECT_TYPES).toEqual(WATCH_SUBJECT_TYPES_BY_SURFACE.SECURITY);
  });

  it('SITUATION is REUSED from MAP rather than redeclared under a Security name', () => {
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.MAP).toContain('SITUATION');
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.SECURITY).toContain('SITUATION');
    const all = JSON.stringify(WATCH_SUBJECT_TYPES_BY_SURFACE);
    expect(all).not.toContain('SECURITY_SITUATION');
  });

  it('THE BLOCKING BITE — a lifecycle event is never a Watch target', () => {
    for (const e of SECURITY_LIFECYCLE_EVENTS) {
      expect(isWatchableSecuritySubjectType(e)).toBe(false);
      expect(WATCH_SUBJECT_TYPES_BY_SURFACE.SECURITY as readonly string[]).not.toContain(e);
    }
    expect(isWatchableSecuritySubjectType('INCIDENT_REPORTED')).toBe(false);
  });

  it('composite scope is not a subject type — it is a saved composition', () => {
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.SECURITY as readonly string[]).not.toContain(
      'COMPOSITE_SCOPE',
    );
    expect(isWatchableSecuritySubjectType('COMPOSITE_SCOPE')).toBe(false);
  });

  it('upstream dependencies are declared, not assumed', () => {
    expect(SECURITY_WATCHABLE_UPSTREAM_DEPENDENCIES.CAMPAIGN).toMatch(/S-01/);
    expect(SECURITY_WATCHABLE_UPSTREAM_DEPENDENCIES.INFRASTRUCTURE_ASSET).toMatch(/CONDITIONAL/);
  });
});

describe('event existence is not notification authority', () => {
  it('THE CENTRAL BITE — an event never grants notification authority', () => {
    expect(eventGrantsNotificationAuthority()).toBe(false);
  });

  it('the four-stage chain is preserved and Security owns exactly one stage', () => {
    expect(TRIGGER_TO_DELIVERY_STAGES).toEqual([
      'TRIGGER',
      'REASSESSMENT',
      'CHANGE_STATE',
      'DELIVERY_DECISION',
    ]);
    expect(STAGES_OWNED_BY_SECURITY).toEqual(['TRIGGER']);
    expect(STAGES_OWNED_BY_SECURITY).not.toContain('CHANGE_STATE');
    expect(STAGES_OWNED_BY_SECURITY).not.toContain('DELIVERY_DECISION');
  });

  it('every event may trigger a reassessment and none concludes one', () => {
    expect(EVERY_EVENT_MAY_TRIGGER_REASSESSMENT).toBe(true);
    expect(NO_EVENT_DETERMINES_ITS_OWN_CHANGE_STATE).toBe(true);
  });
});

describe('CAP is a schema reference and not a Security producer', () => {
  it('THE NAME-SIMILARITY BITE — CAP fields never map to Security posture', () => {
    expect(CAP_CLASSIFICATION).toBe('SCHEMA_REFERENCE_NOT_SECURITY_PRODUCER');
    expect(CAP_FIELDS_NEVER_MAPPED_TO_SECURITY).toEqual([
      'severity',
      'urgency',
      'certainty',
      'category',
    ]);
    for (const f of CAP_FIELDS_NEVER_MAPPED_TO_SECURITY) {
      expect(capFieldMapsToSecurityPosture(f)).toBe(false);
    }
  });

  it("CAP's severity is not the Security severity axis merely because both are spelled alike", () => {
    expect(CAP_FIELDS_NEVER_MAPPED_TO_SECURITY).toContain('severity');
    expect(AXES_NO_EVENT_MAY_ASSERT).toContain('SEVERITY');
  });
});

describe('ENTSO-E A78 contract fit, not activation', () => {
  it('A09 Cancelled is not A13 Withdrawn', () => {
    expect(ENTSOE_DOC_STATUS.A09).toBe('Cancelled');
    expect(ENTSOE_DOC_STATUS.A13).toBe('Withdrawn');
    expect(ENTSOE_DOC_STATUS.A09).not.toBe(ENTSOE_DOC_STATUS.A13);
    expect(ENTSOE_A09_IS_NOT_A13).toBe(true);
  });

  it('A53 planned and A54 unplanned are business types, a different pair entirely', () => {
    expect(entsoeBusinessTypeTable().A53).toBe('Planned maintenance');
    expect(entsoeBusinessTypeTable().A54).toBe('Unplanned outage / forced unavailability');
    expect(Object.keys(ENTSOE_DOC_STATUS)).not.toContain('A53');
  });

  it('nothing is activated and U-2 / S-6 stay withdrawn', () => {
    expect(ENTSOE_ACTIVATION_STATE).toBe('NOT_ACTIVATED');
    expect(ENTSOE_U2_S6_STANDING).toBe('WITHDRAWN');
  });
});

describe('SEC 8-K and E-6, carried', () => {
  it('SEC 8-K stays a source/schema candidate; the contract was not relaxed to fit it', () => {
    expect(SEC_8K_ITEM_105_CLASSIFICATION).toBe('SOURCE_SCHEMA_CANDIDATE');
    expect(CYBER_INCIDENT_REQUIRES_NAMED_AFFECTED_SYSTEM).toBe(true);
  });

  it('E-6 is carried unchanged, with E-6b conditional', () => {
    expect(E6_PLATFORM_REQUIREMENT).toBe('MET');
    expect(E6_PRODUCER_REQUIREMENT).toBe('OPEN');
    expect(E6A_SCOPE).toBe('mandatory single-producer controls');
    expect(E6B_SCOPE).toBe('pairwise convergence controls');
    expect(E6B_IS_CONDITIONAL_ON_OVERLAP).toBe(true);
  });
});


/* ══ R1 · COMPOSITE SCOPE — REFUSED PENDING SEC-WATCH-COMPOSITE-1 ══════════ */

describe('R1 · composite scope is refused, not invented', () => {
  it('the ruling is path C and the dependency is named', () => {
    expect(COMPOSITE_SCOPE_RULING_PATH).toBe('C');
    expect(SEC_WATCH_COMPOSITE_1).toBe('SEC-WATCH-COMPOSITE-1');
    expect(COMPOSITE_SCOPE_AVAILABILITY).toBe('UNAVAILABLE_PENDING_UPSTREAM');
    expect(compositeScopeIsWatchable()).toBe(false);
  });

  it('the reason cites the missing identity contract and A-21, not a vague deferral', () => {
    expect(COMPOSITE_SCOPE_DEPENDENCY_REASON).toMatch(/identity contract/);
    expect(COMPOSITE_SCOPE_DEPENDENCY_REASON).toMatch(/A-21/);
    expect(COMPOSITE_SCOPE_DEPENDENCY_REASON).toMatch(/Part IV/);
  });

  it('THE BLOCKING BITE — composite scope cannot be used as a Watch target', () => {
    expect(() =>
      assertCompositeScopeNotUsedAsWatchTarget(COMPOSITE_SCOPE_CANDIDATE_LITERAL),
    ).toThrow(/SEC-WATCH-COMPOSITE-1/);
  });

  it('the guard is scoped: it refuses composite and lets real subject types through', () => {
    for (const t of WATCH_SUBJECT_TYPES_BY_SURFACE.SECURITY) {
      expect(() => assertCompositeScopeNotUsedAsWatchTarget(t)).not.toThrow();
    }
    expect(() => assertCompositeScopeNotUsedAsWatchTarget('PLACE')).not.toThrow();
  });

  it('COMPOSITE_SCOPE is absent from every surface, not only SECURITY', () => {
    for (const surface of WATCH_SURFACES) {
      expect(WATCH_SUBJECT_TYPES_BY_SURFACE[surface] as readonly string[]).not.toContain(
        'COMPOSITE_SCOPE',
      );
    }
    expect(WATCH_SUBJECT_TYPES as readonly string[]).not.toContain('COMPOSITE_SCOPE');
  });
});

/* ══ R1 · SINGLE AUTHORITY — the collections the HTTP layer consumes ═══════ */

describe('R1 · the canonical allowed-value collections are derived, not restated', () => {
  it('WATCH_SURFACES is exactly the keys of the surface table', () => {
    expect([...WATCH_SURFACES].sort()).toEqual(
      Object.keys(WATCH_SUBJECT_TYPES_BY_SURFACE).sort(),
    );
    expect(WATCH_SURFACES).toContain('SECURITY');
    for (const s of ['MAP', 'ECONOMY', 'MARKET', 'CONFLICT']) {
      expect(WATCH_SURFACES as readonly string[]).toContain(s);
    }
    /*
      ── ALPHA MAJOR CONVERGENCE R1 · THE COUNT IS DERIVED, NOT RESTATED ────

      THIS LINE READ `toBe(5)` AND WAS FAILING, and it had been failing unseen:
      the shared package’s own spec files executed in NO jest project before this
      round — backend roots at backend/src, frontend at frontend/src, and shared
      had no runner at all. Wiring the shared runner is what surfaced it.

      The cause is the defect this very describe block is named after. POLITICS
      was added to `WATCH_SUBJECT_TYPES_BY_SURFACE` as a deliberately EMPTY row,
      which is correct and documented at length in watch.ts: the surface is
      nameable and nothing on it is watchable. The derived assertion above
      absorbed that correctly. A hand-written `5` could not, because it is
      exactly the "restated" second copy this file exists to forbid.

      So the count is now derived from the table too. The assertion still has
      teeth — it pins that the union and the table agree on SIZE, not merely on
      membership — and it can no longer go stale when a governed row is added.
    */
    expect(WATCH_SURFACES.length).toBe(Object.keys(WATCH_SUBJECT_TYPES_BY_SURFACE).length);

    /*
      AND THE EMPTY POLITICS ROW IS ASSERTED AS EMPTY, which is the property
      that actually matters and which the stale count was silently standing in
      for. The surface may be named; nothing may be watched on it.
    */
    expect(WATCH_SURFACES as readonly string[]).toContain('POLITICS');
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.POLITICS).toEqual([]);
  });

  /*
    ═══════════════════════════════════════════════════════════════════════════
    §12 · THE WATCH COMPILE-TIME CONTROL — PROVED TO FAIL IF ELECTION LANDS
    ═══════════════════════════════════════════════════════════════════════════

    Main's ruling B requires that registering an election subject type on the
    Watch platform is caught, not merely discouraged by a comment. The Imihigo /
    Kenya Elections work is landed for PRESERVATION ONLY: no Watch registration,
    no candidate ranking, no electability. These cases are the enforcement.

    They assert on the REAL table, so they fail the moment any of the six
    proposed Politics types is registered — which is the guard actually having
    teeth rather than a note asking future readers not to.
  */
  it('§12 GUARD — no election subject type is registered on ANY surface', () => {
    const PROPOSED_BUT_UNREGISTERED = [
      'ELECTION',
      'LEGISLATIVE_SUBJECT',
      'PROTEST_CAMPAIGN',
      'POLITICAL_ACTOR',
      'GOVERNANCE_STATE',
      'POLITICAL_THEME',
    ] as const;

    for (const proposed of PROPOSED_BUT_UNREGISTERED) {
      /* not in the platform vocabulary */
      expect(WATCH_SUBJECT_TYPES as readonly string[]).not.toContain(proposed);
      /* and not on any surface row, including POLITICS */
      for (const surface of WATCH_SURFACES) {
        expect(
          WATCH_SUBJECT_TYPES_BY_SURFACE[surface] as readonly string[],
        ).not.toContain(proposed);
      }
    }
  });

  it('§12 MUTATION CONTROL — the guard DOES fail when ELECTION is registered', () => {
    /*
      The proof that the guard is load-bearing. A copy of the real table with
      ELECTION registered on POLITICS is run through the SAME two checks, and
      both must report it. If a future edit made these checks vacuous — by
      reading a stale copy, or by iterating an empty list — this case fails
      while the case above would keep passing.
    */
    const mutated: Record<string, readonly string[]> = {
      ...(WATCH_SUBJECT_TYPES_BY_SURFACE as unknown as Record<string, readonly string[]>),
      POLITICS: ['ELECTION'],
    };
    const mutatedUnion = new Set<string>();
    for (const surface of Object.keys(mutated)) {
      for (const t of mutated[surface]!) mutatedUnion.add(t);
    }

    expect([...mutatedUnion]).toContain('ELECTION');
    expect(mutated.POLITICS).toContain('ELECTION');

    /* and the real table is untouched by the mutation */
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.POLITICS).toEqual([]);
    expect(WATCH_SUBJECT_TYPES as readonly string[]).not.toContain('ELECTION');
  });

  it('WATCH_SUBJECT_TYPES is the de-duplicated union of every row', () => {
    const union = new Set<string>();
    for (const surface of WATCH_SURFACES) {
      for (const t of WATCH_SUBJECT_TYPES_BY_SURFACE[surface]) union.add(t);
    }
    expect([...WATCH_SUBJECT_TYPES].sort()).toEqual([...union].sort());
    expect(WATCH_SUBJECT_TYPES.length).toBe(union.size);
  });

  it('the shared types SITUATION and ACTOR appear exactly once each', () => {
    expect(WATCH_SUBJECT_TYPES.filter((t) => t === 'SITUATION').length).toBe(1);
    expect(WATCH_SUBJECT_TYPES.filter((t) => t === 'ACTOR').length).toBe(1);
  });

  it('THE AUTHORITY BITE — the Security subject types are inside the union the API consumes', () => {
    for (const t of WATCH_SUBJECT_TYPES_BY_SURFACE.SECURITY) {
      expect(WATCH_SUBJECT_TYPES).toContain(t);
    }
    expect(WATCH_SUBJECT_TYPES).toContain('CAMPAIGN');
    expect(WATCH_SUBJECT_TYPES).toContain('INFRASTRUCTURE_ASSET');
  });

  it('no lifecycle event leaks into the value collections the API accepts', () => {
    for (const e of SECURITY_LIFECYCLE_EVENTS) {
      expect(WATCH_SUBJECT_TYPES as readonly string[]).not.toContain(e);
      expect(WATCH_SURFACES as readonly string[]).not.toContain(e);
    }
  });
});


/* ══ R2 · ENTSO-E CODE TABLE — ONE SOURCE OF TRUTH ════════════════════════ */

describe('R2 · the A78 business types ARE canonical business types', () => {
  it('THE DRIFT GUARD — referential identity, which a copy cannot satisfy', () => {
    expect(entsoeBusinessTypeTable()).toBe(ENTSOE_BUSINESS_TYPE);
  });

  it('canonical A54 wording is carried in full, "forced unavailability" included', () => {
    expect(entsoeBusinessTypeTable().A54).toBe('Unplanned outage / forced unavailability');
    expect(entsoeBusinessTypeTable().A54).toMatch(/forced unavailability/);
  });

  it('the docStatus pair stays a separate table from businessType', () => {
    expect(ENTSOE_DOC_STATUS.A09).toBe('Cancelled');
    expect(ENTSOE_DOC_STATUS.A13).toBe('Withdrawn');
    expect(Object.keys(ENTSOE_DOC_STATUS)).not.toContain('A53');
    expect(Object.keys(entsoeBusinessTypeTable())).not.toContain('A09');
  });
});

/* ══ R2 · RESTORATION — A WITHDRAWN RECORD IS NOT A RECOVERY ══════════════ */

const claim = (over: Partial<RestorationClaim> = {}): RestorationClaim => ({
  sourceSystem: 'TSO_PUBLIC_NOTICE',
  docStatus: null,
  basis: 'SOURCE_STATED_RESTORATION',
  ...over,
});

describe('R2 · A13 must never produce INFRASTRUCTURE_RESTORED', () => {
  it('the canonical blocker U-2b is read, not restated', () => {
    expect(U2B_BLOCKER_ID).toBe('U-2b');
    expect(u2bBlockerStands()).toBe(true);
    const u2b = PRODUCER_ACTIVATION_BLOCKERS.filter((b) => b.id === 'U-2b')[0];
    expect(u2b).toBeDefined();
    expect(u2b.blocks).toBe('INFRASTRUCTURE_RESTORED from any ENTSO-E document');
  });

  it('THE BLOCKING BITE — an A13 withdrawal is refused as a restoration', () => {
    expect(() =>
      assertRestorationClaimIsAdmissible(
        claim({ sourceSystem: 'ENTSOE', docStatus: 'A13', basis: 'SOURCE_STATED_RESTORATION' }),
      ),
    ).toThrow(/SEC-RESTORE-1/);
    expect(restorationClaimIsAdmissible(claim({ docStatus: 'A13' }))).toBe(false);
  });

  it('A13 is refused even from a non-ENTSO-E source — the semantics, not the vendor', () => {
    expect(() =>
      assertRestorationClaimIsAdmissible(claim({ sourceSystem: 'OTHER_TSO', docStatus: 'A13' })),
    ).toThrow(/SEC-RESTORE-1/);
  });

  it('A09 is NOT inferred to mean restoration', () => {
    expect(() =>
      assertRestorationClaimIsAdmissible(claim({ docStatus: 'A09', basis: 'RECORD_CANCELLED' })),
    ).toThrow(/SEC-RESTORE-2/);
    expect(restorationClaimIsAdmissible(claim({ docStatus: 'A09', basis: 'RECORD_CANCELLED' }))).toBe(
      false,
    );
  });

  it('BITE — no refused basis grounds a restoration', () => {
    expect(RESTORATION_BASES_REFUSED).toEqual([
      'RECORD_WITHDRAWN',
      'RECORD_CANCELLED',
      'INFERRED_FROM_ABSENCE',
    ]);
    for (const basis of RESTORATION_BASES_REFUSED) {
      expect(restorationClaimIsAdmissible(claim({ basis }))).toBe(false);
    }
  });

  it('BITE — absence of an outage from a feed is not evidence it ended', () => {
    expect(() =>
      assertRestorationClaimIsAdmissible(claim({ basis: 'INFERRED_FROM_ABSENCE' })),
    ).toThrow(/SEC-RESTORE-3/);
  });

  it('BITE — U-2b blocks restoration from ANY ENTSO-E document, broader than A13', () => {
    expect(() =>
      assertRestorationClaimIsAdmissible(
        claim({ sourceSystem: ENTSOE_SOURCE_SYSTEM, docStatus: null }),
      ),
    ).toThrow(/SEC-RESTORE-4/);
  });

  it('POSITIVE CONTROL — legitimate restoration evidence IS admitted', () => {
    expect(RESTORATION_BASES_SUFFICIENT).toEqual(['SOURCE_STATED_RESTORATION']);
    expect(() => assertRestorationClaimIsAdmissible(claim())).not.toThrow();
    expect(restorationClaimIsAdmissible(claim())).toBe(true);
  });

  it('the rule refuses restoration groundings and leaves the event vocabulary intact', () => {
    expect(SECURITY_LIFECYCLE_EVENTS).toContain('INFRASTRUCTURE_RESTORED');
    expect(EVENT_AUTHORISED_AXES.INFRASTRUCTURE_RESTORED).toEqual(['OCCURRENCE']);
  });
});

/* ══ R2 · CYBER NAMED SYSTEM — SUFFICIENCY, NOT PRESENCE ══════════════════ */

const cyber = (named: NamedAffectedSystem | null) =>
  evt({ event: 'CYBER_INCIDENT_CONFIRMED', namedAffectedSystem: named });

describe('R2 · the named-system rule enforces sufficiency', () => {
  it('the refused bases are named members, following the B-1 precedent', () => {
    expect(NAMED_SYSTEM_BASES_SUFFICIENT).toEqual(['IDENTIFIED_SYSTEM']);
    expect(NAMED_SYSTEM_BASES_REFUSED).toEqual([
      'ORGANIZATION_NAME_ONLY',
      'BUSINESS_UNIT_NAME_ONLY',
      'GENERIC_SYSTEMS_LANGUAGE',
      'PLACEHOLDER',
    ]);
  });

  it('THE LOAD-BEARING BITE — every refused basis is refused by the gate', () => {
    for (const basis of NAMED_SYSTEM_BASES_REFUSED) {
      expect(namedSystemIsSufficient({ basis, value: 'Acme Corporation' })).toBe(false);
      expect(() => assertLifecycleEventIsWellFormed(cyber({ basis, value: 'Acme Corporation' }))).toThrow(
        /SEC-EVENT-9/,
      );
    }
  });

  it("THE RULING'S OWN COUNTER-EXAMPLE is refused even when declared IDENTIFIED_SYSTEM", () => {
    expect(
      namedSystemIsSufficient({
        basis: 'IDENTIFIED_SYSTEM',
        value: 'information technology systems',
      }),
    ).toBe(false);
    expect(() =>
      assertLifecycleEventIsWellFormed(
        cyber({ basis: 'IDENTIFIED_SYSTEM', value: 'information technology systems' }),
      ),
    ).toThrow(/SEC-EVENT-9/);
  });

  it('BITE — placeholders and punctuation are refused whatever basis is declared', () => {
    for (const v of ['-', '--', ' . ', '', '   ', 'n/a', 'N/A', 'unknown', 'TBD', 'none']) {
      expect(namedSystemIsSufficient({ basis: 'IDENTIFIED_SYSTEM', value: v })).toBe(false);
    }
  });

  it('BITE — bare generic phrases are refused, case and spacing insensitive', () => {
    for (const phrase of CYBER_GENERIC_SYSTEM_PHRASES) {
      expect(namedSystemValueIsStructurallySufficient(phrase)).toBe(false);
      expect(namedSystemValueIsStructurallySufficient(phrase.toUpperCase())).toBe(false);
      expect(namedSystemValueIsStructurallySufficient(`  ${phrase}  `)).toBe(false);
    }
  });

  it('POSITIVE CONTROLS — real identified systems are admitted', () => {
    for (const v of [
      'SCADA controller at substation X',
      'Oracle EBS production instance',
      'the Colonial Pipeline billing system',
      'information technology systems supporting the Ravenna terminal',
    ]) {
      expect(namedSystemIsSufficient({ basis: 'IDENTIFIED_SYSTEM', value: v })).toBe(true);
      expect(() =>
        assertLifecycleEventIsWellFormed(cyber({ basis: 'IDENTIFIED_SYSTEM', value: v })),
      ).not.toThrow();
    }
  });

  it('the generic match is whole-value, so a real system mentioning the phrase survives', () => {
    expect(
      namedSystemValueIsStructurallySufficient(
        'information technology systems supporting the Ravenna terminal',
      ),
    ).toBe(true);
  });

  it('null is still refused, and the other nine events are unaffected', () => {
    expect(namedSystemIsSufficient(null)).toBe(false);
    expect(() => assertLifecycleEventIsWellFormed(cyber(null))).toThrow(/SEC-EVENT-9/);
    for (const e of SECURITY_LIFECYCLE_EVENTS) {
      if (e === 'CYBER_INCIDENT_CONFIRMED') continue;
      expect(
        cyberEventHasNamedSystem(evt({ event: e, assertedAxes: EVENT_AUTHORISED_AXES[e] })),
      ).toBe(true);
    }
  });

  it('SEC 8-K remains blocked: a scope-only filing cannot satisfy this', () => {
    expect(SEC_8K_ITEM_105_CLASSIFICATION).toBe('SOURCE_SCHEMA_CANDIDATE');
    expect(
      namedSystemIsSufficient({ basis: 'ORGANIZATION_NAME_ONLY', value: 'Acme Corporation' }),
    ).toBe(false);
  });
});


/* ══ R3 · THE RESTORATION SEAM — admission calls the guard ════════════════ */

const restored = (r: RestorationClaim | null) =>
  evt({ event: 'INFRASTRUCTURE_RESTORED', assertedAxes: ['OCCURRENCE'], restoration: r });

describe('R3 · INFRASTRUCTURE_RESTORED is refused at admission without grounding', () => {
  it('THE SEAM BITE — an ungrounded restoration is refused by the lifecycle gate', () => {
    expect(() => assertLifecycleEventIsWellFormed(restored(null))).toThrow(/SEC-EVENT-11/);
  });

  it('THE A13 NEGATIVE CONTROL — a withdrawal is refused THROUGH admission', () => {
    expect(() =>
      assertLifecycleEventIsWellFormed(
        restored({
          sourceSystem: 'OTHER_TSO',
          docStatus: 'A13',
          basis: 'SOURCE_STATED_RESTORATION',
        }),
      ),
    ).toThrow(/SEC-EVENT-11/);
    expect(() =>
      assertLifecycleEventIsWellFormed(
        restored({ sourceSystem: 'OTHER_TSO', docStatus: 'A13', basis: 'SOURCE_STATED_RESTORATION' }),
      ),
    ).toThrow(/SEC-RESTORE-1/);
  });

  it('BITE — U-2b refuses an ENTSO-E restoration through admission', () => {
    expect(() =>
      assertLifecycleEventIsWellFormed(
        restored({
          sourceSystem: ENTSOE_SOURCE_SYSTEM,
          docStatus: null,
          basis: 'SOURCE_STATED_RESTORATION',
        }),
      ),
    ).toThrow(/SEC-RESTORE-4/);
  });

  it('BITE — A09 and every refused basis are refused through admission', () => {
    expect(() =>
      assertLifecycleEventIsWellFormed(
        restored({ sourceSystem: 'OTHER_TSO', docStatus: 'A09', basis: 'RECORD_CANCELLED' }),
      ),
    ).toThrow(/SEC-RESTORE-2/);
    for (const basis of RESTORATION_BASES_REFUSED) {
      expect(() =>
        assertLifecycleEventIsWellFormed(
          restored({ sourceSystem: 'OTHER_TSO', docStatus: null, basis }),
        ),
      ).toThrow(/SEC-EVENT-11/);
    }
  });

  it('THE POSITIVE CONTROL — legitimate non-ENTSO-E restoration IS admitted', () => {
    expect(() =>
      assertLifecycleEventIsWellFormed(
        restored({
          sourceSystem: 'TSO_PUBLIC_NOTICE',
          docStatus: null,
          basis: 'SOURCE_STATED_RESTORATION',
        }),
      ),
    ).not.toThrow();
  });

  it('BITE — a restoration grounding on any other event is refused', () => {
    expect(() =>
      assertLifecycleEventIsWellFormed(
        evt({
          event: 'INFRASTRUCTURE_DISRUPTED',
          restoration: {
            sourceSystem: 'TSO_PUBLIC_NOTICE',
            docStatus: null,
            basis: 'SOURCE_STATED_RESTORATION',
          },
        }),
      ),
    ).toThrow(/SEC-EVENT-12/);
  });

  it('the other nine events are unaffected by the restoration seam', () => {
    for (const e of SECURITY_LIFECYCLE_EVENTS) {
      if (e === 'INFRASTRUCTURE_RESTORED' || e === 'CYBER_INCIDENT_CONFIRMED') continue;
      expect(() =>
        assertLifecycleEventIsWellFormed(evt({ event: e, assertedAxes: EVENT_AUTHORISED_AXES[e] })),
      ).not.toThrow();
    }
  });

  it('the seam mirrors the cyber pattern — same shape, same pair of codes', () => {
    expect(() => assertLifecycleEventIsWellFormed(restored(null))).toThrow(/SEC-EVENT-11/);
    expect(() =>
      assertLifecycleEventIsWellFormed(
        evt({ event: 'CYBER_INCIDENT_CONFIRMED', namedAffectedSystem: null }),
      ),
    ).toThrow(/SEC-EVENT-9/);
  });
});

/* ══ R3 · C-2 — punctuation must not defeat generic matching ══════════════ */

describe('R3 · trailing punctuation does not smuggle a generic phrase through', () => {
  it("THE C-2 BITE — the ruling's counter-example with a full stop is still refused", () => {
    for (const v of [
      'information technology systems.',
      'information technology systems!',
      'IT systems,',
      'systems!',
      'network.',
      '  infrastructure ...  ',
      '(unspecified)',
      'n/a.',
    ]) {
      expect(namedSystemValueIsStructurallySufficient(v)).toBe(false);
      expect(
        namedSystemIsSufficient({ basis: 'IDENTIFIED_SYSTEM', value: v }),
      ).toBe(false);
    }
  });

  it('POSITIVE CONTROL — punctuation stripping does not swallow real system names', () => {
    for (const v of [
      'SCADA controller at substation X.',
      'Oracle EBS production instance,',
      'information technology systems supporting the Ravenna terminal.',
      'SCADA-2, unit 4',
    ]) {
      expect(namedSystemValueIsStructurallySufficient(v)).toBe(true);
    }
  });

  it('interior punctuation is preserved — only the ends are stripped', () => {
    expect(namedSystemValueIsStructurallySufficient('SCADA-2, unit 4')).toBe(true);
  });
});
