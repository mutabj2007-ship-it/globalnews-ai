/**
 * REFERENCE BINDING — binds lane C's own reference oracle, so the portable runner is proven to
 * work before you point it at the canonical adapter. Copy this file, change the two imports,
 * and keep the shape.
 */
import { storeFor, LEAK_CANARY } from '../build/fixtures/store.fixture.js';
import { readHumanitarian, plannableForRead, buildIdentity } from '../build/src/reader.js';
import { identityMaterial as material } from '../build/src/ports.js';

export function makeStore(fixtureName) {
  return storeFor(fixtureName);
}

export function read(store, request) {
  const r = readHumanitarian(store, {
    countryIso3: request.countryIso3,
    questionKind: request.questionKind,
    ...(request.observationKeys ? { observationKeys: request.observationKeys } : {}),
    ...(request.statedWindow !== null ? { statedWindow: request.statedWindow } : {}),
  });
  return {
    availability: r.state,
    assessment: r.assessment,
    claims: r.claims,
    refusal: r.refusal,
    executionPlannable: plannableForRead(r),
    withheldTotal: r.withheldTotal,
    askTerminal: r.askTerminal,
    sinks: r.sinks,
  };
}

export function identityMaterial(request) {
  return material(
    buildIdentity({
      countryIso3: request.countryIso3,
      questionKind: request.questionKind,
      ...(request.observationKeys ? { observationKeys: request.observationKeys } : {}),
      ...(request.statedWindow !== null ? { statedWindow: request.statedWindow } : {}),
    }),
  );
}

/** Enables the five-sink leak check in the runner. */
export const sinksExposed = true;
export const leakCanary = LEAK_CANARY;

/** Lane C's own codes, so the convention assertions are exercised rather than noted. */
export const refusalAliases = {
  SPECIALIST_NOT_BOUND: 'SPECIALIST_NOT_BOUND',
  NO_DATA_FOR_GEOGRAPHY: 'NO_DATA_FOR_GEOGRAPHY',
  TEMPORARILY_UNAVAILABLE: 'TEMPORARILY_UNAVAILABLE',
  OBSERVATION_KEY_CONSTRUCT_ABSENT: 'OBSERVATION_KEY_CONSTRUCT_ABSENT',
};
