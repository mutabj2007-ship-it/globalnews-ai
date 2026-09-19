import { createHash } from 'node:crypto';

import type {
  ProtectedClassDeclaration,
  ProtectedPartitionDeclaration,
  ProtectedClassRegistry,
  ProtectedPartitionRegistry,
} from '@globalnews-ai/shared';

import {
  __resetLoaderTokenForTests,
  authorityIsInstalledInstance,
  createLoaderToken,
  currentProtectionAuthority,
  installProtectionAuthority,
  sealProtectionAuthority,
  type ProtectionAuthority,
} from '../../../../shared/dist/humanitarian/geometry-authority.loader';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE HUMANITARIAN COMPOSITION ROOT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G-HUMANITARIAN-COPERNICUS-PRODUCER-R1.
 *
 * ── WHY THIS FILE HAS THIS NAME ───────────────────────────────────────────
 *
 * `gx14-authority.spec.ts` already allowlists exactly two files to import the loader
 * module — itself and `humanitarian-authority.loader.ts` — with the comment
 * *"This spec and the composition root are the allowed callers."* The name was reserved
 * for a file that did not exist. This is that file, and nothing else in `backend/src`
 * or `frontend/src` may import the loader: the guard walks both trees and fails naming
 * the offender.
 *
 * The import reaches the BUILT declarations (`shared/dist`) rather than `shared/src`,
 * because the backend's build config pins `rootDir` to `backend/src`: a relative reach
 * into `shared/src` pulls a real source file into the program and fails TS6059, while a
 * `.d.ts` is not emitted and so is not subject to it. The accepted spec reaches the same
 * module by the same path, and the allowlist guard matches on the module name either way.
 *
 * ── WHAT IT DOES, AND THE ONE THING IT REFUSES TO DO ──────────────────────
 *
 * It reads GOVERNED rows, proves they are stable, and ONLY THEN seals and installs an
 * authority. It does NOT author declarations: E1 records that the protected-class
 * declarations are E1's to author, and a composition root that invented them would be
 * the system protecting whatever it felt like.
 *
 * ── R1.2 · CHECK BEFORE INSTALL ───────────────────────────────────────────
 *
 * R1 read, sealed, INSTALLED, then re-read and compared. E1 found the defect: on drift
 * the throw arrived after a stale authority was already globally reachable, and a
 * process that throws during startup does not necessarily stop — an outer `catch` that
 * logs and continues, a supervisor that restarts the HTTP layer but not the module, or
 * a test harness that swallows the rejection all leave `currentProtectionAuthority()`
 * returning rows nobody verified. "Verified afterwards" is not verified.
 *
 * The order is now:
 *
 *     read A → read B → compare → REFUSE ON MISMATCH → seal → install → confirm
 *
 * Nothing before the comparison touches the module-scope install slot, so a refused
 * start leaves the process with NO authority — which `currentProtectionAuthority()`
 * already treats as "does not serve" rather than "serve unprotected" (GA-44).
 *
 * ── GA-33, AND WHY THIS IS THE SUBJECT THAT WAS MISSING ───────────────────
 *
 * E1's GA-33 ruling is **B**: *"Producer implementation may proceed under HOLD;
 * activation stays blocked until GA-33's third clause is measured through the real
 * composition root. A is circular — it demands evidence about a process only the
 * blocked work would create."* And Claude Code's framing, which E1 endorsed:
 * *"writing a loader that boots nothing, to satisfy an assertion about a process that
 * does not start, would produce evidence about a fixture."*
 *
 * So the recompute runs HERE, inside the real load, against the real rows — not in a
 * test helper that imitates one. Whether that satisfies GA-33 is E1's ruling to issue;
 * this lane supplies the subject and refuses to grade its own work.
 */

/** The governed rows, as the authority store holds them. READ-ONLY to this module. */
export interface GovernedAuthorityRows {
  readonly classes: readonly ProtectedClassDeclaration[];
  readonly partitions: readonly ProtectedPartitionDeclaration[];
}

/** The store the platform reads governed rows from. Implemented by the authority system. */
export interface GovernedAuthorityStore {
  readGovernedRows(): Promise<GovernedAuthorityRows>;
}

/**
 * AS-10 / GA-33 — the digest is over the GOVERNED ROWS, canonically ordered.
 *
 * Ordering is by declared key and the serialization pins field order explicitly, because
 * a digest that changes when a store returns the same rows in a different order is a
 * digest that fails for a reason nobody can act on — and the first response to a digest
 * that flaps is to stop checking it.
 */
export function computeGovernedDigest(rows: GovernedAuthorityRows): string {
  const classes = [...rows.classes]
    .sort((a, b) => a.classId.localeCompare(b.classId))
    .map((c) => [c.classId, c.declaredAt, c.basis, c.partitionUnitLevel]);

  const partitions = [...rows.partitions]
    .sort((a, b) => a.partitionKey.localeCompare(b.partitionKey))
    .map((p) => [
      p.partitionKey,
      p.unitLevel,
      p.declaredAt,
      String(p.minimumMembership),
      String(p.declaredEligibleMembership),
      [...p.coversClassIds].sort().join(','),
    ]);

  return createHash('sha256').update(JSON.stringify({ classes, partitions })).digest('hex');
}

export class AuthorityLoadFailure extends Error {}

export interface AuthorityLoadReport {
  readonly epoch: number;
  readonly sourceDigest: string;
  /** GA-33 · the digest recomputed from a SECOND governed read, BEFORE anything is sealed. */
  readonly recomputedDigest: string;
  readonly digestsMatch: boolean;
  readonly isInstalledInstance: boolean;
  readonly classCount: number;
  readonly partitionCount: number;
}

/**
 * THE REAL LOAD. Validate, then seal, then install — in that order and no other.
 *
 * GA-44 is enforced by the loader itself: an authority with no declarations is a failed
 * load rather than a permissive one, and that refusal is not re-implemented here. It
 * fires inside `sealProtectionAuthority`, which is BEFORE the install call, so an empty
 * registry also leaves the process with no authority.
 */
export async function loadHumanitarianAuthority(
  store: GovernedAuthorityStore,
  input: { readonly epoch: number; readonly loadedAt: string },
): Promise<{ authority: ProtectionAuthority; report: AuthorityLoadReport }> {
  /*
    ── GA-33 · TWO READS AND A COMPARISON, ALL BEFORE ANYTHING IS INSTALLED ──

    Read A is what the authority would be built from. Read B is the independent
    recompute GA-33 asks for. They are compared HERE, while the install slot is still
    empty, because the only refusal worth having is one that leaves nothing behind.

    A mismatch means the governed rows moved under the loader. The honest response is a
    FAILED START — not a warning, not a narrower authority that keeps serving, and not
    an installed authority accompanied by an exception somebody may catch.
  */
  const rowsA = await store.readGovernedRows();
  const sourceDigest = computeGovernedDigest(rowsA);

  const rowsB = await store.readGovernedRows();
  const recomputedDigest = computeGovernedDigest(rowsB);

  if (recomputedDigest !== sourceDigest) {
    throw new AuthorityLoadFailure(
      `GEOMETRY_AUTHORITY_DIGEST_DRIFTED: the governed rows digest to ${sourceDigest} and then ` +
        `to ${recomputedDigest} within one load. Nothing has been sealed and nothing has been ` +
        'installed: an authority that cannot be tied back to its source is a failed start, not a ' +
        'degraded one.',
    );
  }

  const classes: ProtectedClassRegistry = { declarations: rowsA.classes };
  const partitions: ProtectedPartitionRegistry = { declarations: rowsA.partitions };

  const token = createLoaderToken();

  // GA-44 fires in here, and `sealProtectionAuthority` is still before the install.
  const authority = sealProtectionAuthority(token, {
    epoch: input.epoch,
    classes,
    partitions,
    loadedAt: input.loadedAt,
    sourceDigest,
  });

  installProtectionAuthority(token, authority);

  /*
    ── AS-E1-2 · AND THEN CONFIRM WHAT IS ACTUALLY SERVING ──────────────────

    This is a POST-CONDITION on the install, not a validation of the rows — those were
    validated above, before the slot was touched. Directly after `installProtectionAuthority`
    it is close to a tautology, and it is kept anyway for one reason: it stops being one
    the moment installing moves, is wrapped, or acquires a branch. A post-condition that
    is trivially true today is how you find out the day it is not.

    The identity comparison is the AS-E1-2 property: a forgery is structurally valid by
    construction, so `===` against the installed instance is the one check it cannot pass.
  */
  const isInstalledInstance = authorityIsInstalledInstance(authority);
  if (!isInstalledInstance) {
    throw new AuthorityLoadFailure(
      'GEOMETRY_AUTHORITY_NOT_THE_INSTALLED_INSTANCE: the sealed authority is not the object the ' +
        'process is serving from. A structurally identical copy passes every other check.',
    );
  }

  return {
    authority,
    report: {
      epoch: authority.epoch,
      sourceDigest: authority.sourceDigest,
      recomputedDigest,
      digestsMatch: true,
      isInstalledInstance,
      classCount: rowsA.classes.length,
      partitionCount: rowsA.partitions.length,
    },
  };
}

/** Read-side accessor, so no other module needs the loader import. */
export function humanitarianProtectionAuthority(): ProtectionAuthority {
  return currentProtectionAuthority();
}

/**
 * Test-only reset, exposed HERE so that a spec never has to import the loader itself and
 * trip the allowlist guard. The guard is the control; a convenience that defeats it
 * would be worse than the inconvenience.
 */
export function __resetHumanitarianAuthorityForTests(): void {
  __resetLoaderTokenForTests();
}
