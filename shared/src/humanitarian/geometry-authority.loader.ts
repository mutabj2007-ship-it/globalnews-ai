/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE AUTHORITY DOOR — PLATFORM LOADER ONLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-HUMANITARIAN-GX14-AUTHORITY-STORE-R1 · AS-E1-1, AS-E1-2.
 *
 * ── WHY THIS FILE EXISTS SEPARATELY FROM THE CONTRACT ─────────────────────
 *
 * E1 measured `NC-FORGE-3` compiling: a caller minted an authority with an EMPTY DARK
 * SET by importing one exported function — no cast, no symbol, no credential. An empty
 * dark set is the most dangerous value this system can hold, because it protects
 * nothing while looking exactly like an authority that protects everything.
 *
 * E1's remedy, in its stated order of preference: "a separate entry point the
 * application bundle does not import; a build-time boundary rule that fails CI on any
 * import outside the loader; or, at minimum, a loader-supplied token".
 *
 * ALL THREE ARE APPLIED, because each covers what the others miss:
 *
 *   1. SEPARATE ENTRY POINT. This module is not re-exported from `shared/src/index.ts`,
 *      so `import { sealProtectionAuthority } from '@globalnews-ai/shared'` does not
 *      resolve. The ordinary import path simply has no door.
 *   2. BUILD-TIME BOUNDARY. `geometry-authority.boundary.spec.ts` reads every source
 *      file and fails if anything outside the approved loader path names this module.
 *      That is what stops a deep relative import walking around (1).
 *   3. LOADER TOKEN. `sealProtectionAuthority` demands a token whose only constructor
 *      is `createLoaderToken`, which is itself callable once per process. That is what
 *      stops a caller who has already defeated (1) and (2).
 *
 * ── AND THE SEAL IS STILL NOT THE CONTROL ─────────────────────────────────
 *
 * E1 · R-A is explicit: "The seal is kept. It stops the accident, which is the common
 * case… It is not the control, and no evidence claim may cite it as one."
 *
 * The control is architectural and lives in the database: the reader process holds no
 * credential for the authority store, so a forged handle is a handle to data it cannot
 * read. The grants in `20260919090000_humanitarian_gx14_authority` are the control, and
 * the live-role proof is what measures it.
 *
 * AS-E1-2 adds the half the credential boundary lacks — a forgery is silent, and
 * nothing notices it occurred. `assertAuthorityIsInstalled` makes it DETECTABLE.
 */

import {
  assertProtectedPartitionRegistryIsWellFormed,
  type ProtectedClassRegistry,
  type ProtectedPartitionRegistry,
} from './spatial-geometry';

/**
 * MODULE-PRIVATE ON PURPOSE. Not exported, so a caller cannot name the key at all.
 *
 * The residual is the one Main states and the snapshot contract states as SR-12: a
 * determined caller can read it off a real authority with `Object.getOwnPropertySymbols`
 * and copy it. That is why AS-E1-2 exists — the copy is structurally perfect and fails
 * the IDENTITY check, which is the only check a perfect structural forgery cannot pass.
 */
const PROTECTION_AUTHORITY_SEAL: unique symbol = Symbol('globalnews.protectionAuthority');

/**
 * The resolved, governed protection authority.
 *
 * An object literal satisfying the other fields is REFUSED BY THE COMPILER, which is the
 * property R3 could not have: R3's `ProtectedPartitionRegistry` is a plain interface and
 * E1's proof run showed a fabricated one diverging.
 *
 * `epoch` and `sourceDigest` are carried so a later reader of an audit record can tell
 * WHICH authority produced a decision. Neither ever crosses the trust boundary — R3's
 * closed reader projection enforces that by comparing sorted own-property names.
 */
export interface ProtectionAuthority {
  readonly [PROTECTION_AUTHORITY_SEAL]: true;
  /** Monotonic. Never decreases. AS-5. */
  readonly epoch: number;
  readonly classes: ProtectedClassRegistry;
  readonly partitions: ProtectedPartitionRegistry;
  /** ISO-8601, when the platform loaded it. Not when a reader asked. */
  readonly loadedAt: string;
  /** sha256 of the governed source rows this authority was built from. AS-10 / GA-33. */
  readonly sourceDigest: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE LOADER TOKEN — E1's THIRD LAYER
 * ═══════════════════════════════════════════════════════════════════════════ */

declare const LOADER_TOKEN_BRAND: unique symbol;

/**
 * A token the platform loader holds and nobody else can construct.
 *
 * The brand is `declare const` — it exists in the type system and has NO RUNTIME VALUE,
 * so there is no symbol to read off an instance and copy. That is the difference between
 * this and the authority seal, and it is deliberate: the seal must be a real property
 * because the authority crosses module boundaries as data; the token never does.
 */
export interface AuthorityLoaderToken {
  readonly [LOADER_TOKEN_BRAND]: true;
}

let tokenIssued = false;

/**
 * Issues the one token, once per process.
 *
 * ONCE is the point. A loader that can mint a second token after startup is a loader
 * that can be asked to mint one at request time, and the call site that does it will
 * look entirely reasonable.
 */
export function createLoaderToken(): AuthorityLoaderToken {
  if (tokenIssued) {
    throw new Error(
      'GEOMETRY_AUTHORITY_TOKEN_ALREADY_ISSUED: the loader token is issued once per process. ' +
        'A second issuance means something other than the platform loader is asking for one.',
    );
  }
  tokenIssued = true;
  return {} as AuthorityLoaderToken;
}

/** Test-only reset. Never called by production code — asserted by the boundary spec. */
export function __resetLoaderTokenForTests(): void {
  tokenIssued = false;
  installed = undefined;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SEALING
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * AS-2 · THE LOADER IS THE ONLY DOOR, AND IT ASSERTS AT LOAD.
 *
 * `assertProtectedPartitionRegistryIsWellFormed` runs HERE — once, at load, in the
 * platform process — and never at first use. A registry checked when it is first
 * consulted is a registry checked in production, by a reader, and the check that fires
 * then has already served the request it should have refused.
 */
export function sealProtectionAuthority(
  token: AuthorityLoaderToken,
  input: {
    readonly epoch: number;
    readonly classes: ProtectedClassRegistry;
    readonly partitions: ProtectedPartitionRegistry;
    readonly loadedAt: string;
    readonly sourceDigest: string;
  },
): ProtectionAuthority {
  if (token === undefined || token === null || typeof token !== 'object') {
    throw new Error(
      'GEOMETRY_AUTHORITY_TOKEN_REQUIRED: only the platform loader may seal an authority.',
    );
  }
  if (!Number.isInteger(input.epoch) || input.epoch < 1) {
    throw new Error(
      `GEOMETRY_AUTHORITY_EPOCH_INVALID: '${String(input.epoch)}'. Epochs are integers from 1 ` +
        'and never decrease, so an audit record can always be placed against the authority ' +
        'that produced it.',
    );
  }
  if (!/^[0-9a-f]{64}$/.test(input.sourceDigest)) {
    throw new Error(
      'GEOMETRY_AUTHORITY_DIGEST_INVALID: the digest is the lowercase-hex sha256 of the governed ' +
        'rows. An authority that cannot be tied back to its source cannot be checked by GA-33.',
    );
  }
  if (input.loadedAt === '') {
    throw new Error('GEOMETRY_AUTHORITY_UNDATED: an authority states when it was loaded.');
  }

  /*
    GA-44 · AN EMPTY REGISTRY IS A FAILED LOAD, NOT A PERMISSIVE ONE.

    E1: "There is no fallback authority and no 'protect nothing' default — E1 confirms
    this is the most dangerous value the system can hold." An authority protecting
    nothing is indistinguishable, at every call site, from an authority protecting
    everything correctly. It is refused here rather than at the reader, because by the
    reader it is already serving.
  */
  if (input.classes.declarations.length === 0) {
    throw new Error(
      'GEOMETRY_AUTHORITY_EMPTY: an authority with no protected-class declarations protects ' +
        'nothing while looking exactly like one that protects everything. A failed load is a ' +
        'failed start.',
    );
  }

  // AS-2 — the structural rules R3 already defines, enforced once, here.
  assertProtectedPartitionRegistryIsWellFormed(input.partitions, input.classes);

  return Object.freeze({
    [PROTECTION_AUTHORITY_SEAL]: true as const,
    epoch: input.epoch,
    classes: input.classes,
    partitions: input.partitions,
    loadedAt: input.loadedAt,
    sourceDigest: input.sourceDigest,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * AS-E1-2 · A FORGERY MUST BE DETECTABLE, NOT MERELY USELESS
 * ═══════════════════════════════════════════════════════════════════════════ */

let installed: ProtectionAuthority | undefined;

/** The loader installs exactly one authority. Later installs must advance the epoch. */
export function installProtectionAuthority(
  token: AuthorityLoaderToken,
  authority: ProtectionAuthority,
): void {
  if (token === undefined || token === null || typeof token !== 'object') {
    throw new Error('GEOMETRY_AUTHORITY_TOKEN_REQUIRED: only the platform loader may install.');
  }
  if (installed !== undefined && authority.epoch < installed.epoch) {
    // AS-5 — monotonic. A rollback to an earlier epoch is how a narrower dark set
    // returns after a correction widened it.
    throw new Error(
      `GEOMETRY_AUTHORITY_EPOCH_REGRESSED: ${String(installed.epoch)} -> ${String(authority.epoch)}.`,
    );
  }
  installed = authority;
}

export function currentProtectionAuthority(): ProtectionAuthority {
  if (installed === undefined) {
    // GA-44 — no authority means no serving. Not "serve unprotected".
    throw new Error(
      'GEOMETRY_AUTHORITY_NOT_INSTALLED: the process has no governed authority, so it does not ' +
        'serve. There is no fallback and no protect-nothing default.',
    );
  }
  return installed;
}

/**
 * AS-E1-2 · IDENTITY, NOT STRUCTURE.
 *
 * E1: "the reader path asserts, once per request batch, that the authority it holds is
 * the one the loader sealed — identity comparison against the module-scope value, not a
 * structural comparison, SINCE A FORGERY IS STRUCTURALLY VALID BY CONSTRUCTION."
 *
 * That sentence is the whole design. Anyone who copies the seal symbol off a real
 * authority produces an object that passes every structural check there is — same
 * fields, same types, same symbol key. `===` against the installed instance is the one
 * comparison it cannot pass, because it is a different object.
 */
export function authorityIsInstalledInstance(authority: ProtectionAuthority): boolean {
  return installed !== undefined && authority === installed;
}
