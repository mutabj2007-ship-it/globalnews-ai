import { Injectable } from '@nestjs/common';
import {
  QuestionKind,
  SPECIALIST_SHA256_PATTERN,
  SpecialistClaimDefinition,
  SpecialistClaimOutcome,
  SpecialistClaimRequest,
  RegisteredSpecialistDomainId,
  resolveSpecialistClaim,
} from '@globalnews-ai/shared';

/**
 * SPECIALIST CLAIM BOUNDARY — THE REGISTRY.
 *
 * The platform half of Shared Specialist Addendum v1.0 R1 §16. The contract and the resolver are
 * pure and live in `@globalnews-ai/shared`; this file adds the one thing that needs Nest — a
 * process-wide registry with a lifetime.
 *
 * PUSH, NEVER PULL. This module imports no domain module. Each domain registers itself from its
 * own module's initialisation. A pull model would make the platform depend on Conflict, Election
 * and Delivery, and would mean adding a domain edits the platform.
 *
 * OWNERSHIP.
 *   platform  this file, the contract, the resolution rules, and the fact that exactly one domain
 *             may claim a kind
 *   domain    its own SpecialistClaimDefinition, in its own module
 *   Support   nothing. Support injects this registry and reads outcomes. It never registers.
 *
 * THIS REGISTRY CANNOT ANSWER A QUESTION. It names an owner. There is deliberately no method that
 * returns content, and no path from here to AnalysisService or to any provider.
 */

/**
 * Design authorities a registration may cite — KEYED BY HASH, NOT BY NAME.
 *
 * A domain registers against a document. The key of this table is the document's sha256 because
 * the hash is the authority: the Addendum's R1 revision kept the superseded document's exact
 * filename, so a name-keyed table would accept a domain built against the stale document. The
 * label beside each hash is prose for error messages and audit; nothing resolves by it.
 *
 * A registration citing a hash that is not here is refused, which is how a domain definition built
 * against a superseded or unreviewed document is caught.
 *
 * TRADEOFF, STATED: this couples registration to a document revision. A revised design document
 * means one added line here, ratified by the platform, before a domain built against it can
 * register. That is deliberate — it is the platform, not a domain, that accepts a new authority —
 * but it does mean a design revision must reach this constant before it reaches a domain.
 */
export const ACCEPTED_SPECIALIST_DESIGN_AUTHORITIES: Readonly<Record<string, string>> = {
  '50b4b882576e76722eb57044de80289a5559b64dc0b6832ba838605902b90acd':
    'Shared Specialist Addendum v1.0 R1',
  b8425fa996fa5cfc6415df8b938ee4dd5ac118257e5c62d41bd161fce141c1d2:
    'Part V Conflict Intelligence v1.0 R2 - SPEC (prose authority)',
  '711443b6e4832ad630ee736059863aa9ded144148a9bd0a49069776f57a93d8c':
    'Part V Conflict Intelligence v1.0 R2 - visual specification',
};

/** The superseded Addendum, kept here so the guard against it is explicit rather than implied. */
export const SUPERSEDED_SPECIALIST_DESIGN_AUTHORITIES: readonly string[] = [
  '71646a05b4055ec547527b22cae68bd2ecc50d054370d0db91b3bd350fdd2ff5',
];

@Injectable()
export class SpecialistClaimRegistry {
  private readonly definitions = new Map<RegisteredSpecialistDomainId, SpecialistClaimDefinition>();

  /**
   * THE CANONICAL QUESTION-KIND OWNERSHIP REGISTER — PLATFORM-OWNED (CTO ruling).
   *
   * kind → the single domain that owns it. This map is the whole of "canonical QuestionKind is
   * platform-owned; domains register ownership": the vocabulary's type and constructor live in the
   * platform's shared contract, a kind acquires an owner only by passing through `register` here,
   * and no domain and no Support module holds a register of its own. Routing rule 2 is enforced on
   * the way in, not consulted on the way out.
   *
   * It starts EMPTY and no kind is declared by this package. A canonical vocabulary invented by the
   * platform ahead of the domains that use it would be fabricated design.
   */
  private readonly kindOwner = new Map<QuestionKind, RegisteredSpecialistDomainId>();

  /**
   * Register one domain's §16 row. Called by that domain's own module, once, at initialisation.
   * Every rejection below throws at startup rather than degrading at request time.
   */
  register(definition: SpecialistClaimDefinition): void {
    this.assertAuthority(definition);
    this.assertNotAlreadyRegistered(definition);
    this.assertKindsAreCoherent(definition);

    for (const kind of definition.claimedKinds) {
      const existing = this.kindOwner.get(kind);
      if (existing !== undefined) {
        this.onDuplicateKind(kind, existing, definition.domainId);
      }
    }

    for (const kind of definition.claimedKinds) {
      this.kindOwner.set(kind, definition.domainId);
    }
    this.definitions.set(definition.domainId, definition);
  }

  /** Every registered domain id, ordered, for audit and for tests. Never a way to answer. */
  registeredDomains(): readonly RegisteredSpecialistDomainId[] {
    return [...this.definitions.keys()].sort();
  }

  /** The single domain claiming a kind, or undefined. Rule 2 guarantees there is at most one. */
  ownerOfKind(kind: QuestionKind): RegisteredSpecialistDomainId | undefined {
    return this.kindOwner.get(kind);
  }

  /**
   * Every canonical question kind the platform currently knows an owner for, ordered.
   *
   * This is the platform's register, readable by anyone and writable only through `register`. It is
   * empty until a domain registers, and that emptiness is the honest state — it is what makes
   * `NO_DOMAINS_REGISTERED` a fact about the register rather than a guess about a request.
   */
  canonicalKinds(): readonly QuestionKind[] {
    return [...this.kindOwner.keys()].sort();
  }

  /**
   * Resolve a claim. Delegates entirely to the pure resolver — this method adds no rule of its own,
   * which is what keeps routing rule 7 ("deterministic, costs no user AI") true of the live path
   * and not merely of the library.
   */
  resolve<G = unknown, T = unknown>(
    request: SpecialistClaimRequest<G, T>,
  ): SpecialistClaimOutcome<G, T> {
    return resolveSpecialistClaim<G, T>([...this.definitions.values()], request);
  }

  /**
   * ROUTING RULE 2: "Exactly one domain may claim a kind."
   *
   * Two live domains claiming one kind is refused, naming both, so the overlap surfaces for a
   * ruling instead of hiding behind whichever module happened to initialise first. §16's "first
   * registration wins; overlaps are resolved by ruling, not by code" is read as governing the
   * reservation of future domain SLOTS — and "resolved by ruling, not by code" only means anything
   * if the code refuses to arbitrate.
   *
   * THIS METHOD IS THE WHOLE OF THAT POLICY. If the CTO rules literal first-wins at runtime
   * instead, this method becomes a no-op and nothing else in the file changes.
   */
  private onDuplicateKind(
    kind: QuestionKind,
    incumbent: RegisteredSpecialistDomainId,
    challenger: RegisteredSpecialistDomainId,
  ): never {
    throw new Error(
      `SPECIALIST CLAIM: question kind "${kind}" is claimed by both "${incumbent}" and ` +
        `"${challenger}". Exactly one domain may claim a kind (Addendum §16, routing rule 2). ` +
        `This overlap is resolved by ruling, not by code.`,
    );
  }

  private assertAuthority(definition: SpecialistClaimDefinition): void {
    if (!SPECIALIST_SHA256_PATTERN.test(definition.authoritySha256)) {
      throw new Error(
        `SPECIALIST CLAIM: domain "${definition.domainId}" cites authority hash ` +
          `"${definition.authoritySha256}", which is not a sha256. The filename is not the ` +
          `authority; the hash is.`,
      );
    }
    if (definition.authorityRef.trim().length === 0) {
      throw new Error(
        `SPECIALIST CLAIM: domain "${definition.domainId}" cites no authority document.`,
      );
    }
    const accepted = ACCEPTED_SPECIALIST_DESIGN_AUTHORITIES[definition.authoritySha256];
    if (accepted === undefined) {
      const superseded = SUPERSEDED_SPECIALIST_DESIGN_AUTHORITIES.includes(
        definition.authoritySha256,
      );
      throw new Error(
        `SPECIALIST CLAIM: domain "${definition.domainId}" cites "${definition.authorityRef}" at ` +
          `${definition.authoritySha256}, which the platform has not accepted` +
          (superseded ? ' — that hash is a SUPERSEDED document.' : '.'),
      );
    }
  }

  private assertNotAlreadyRegistered(definition: SpecialistClaimDefinition): void {
    if (this.definitions.has(definition.domainId)) {
      throw new Error(
        `SPECIALIST CLAIM: domain "${definition.domainId}" is already registered. ` +
          `A domain registers once, from its own module.`,
      );
    }
  }

  private assertKindsAreCoherent(definition: SpecialistClaimDefinition): void {
    if (definition.claimedKinds.length === 0) {
      throw new Error(
        `SPECIALIST CLAIM: domain "${definition.domainId}" claims no kinds. ` +
          `A domain that claims nothing does not register; absence is how non-existence is expressed.`,
      );
    }
    const refused = new Set<string>(definition.refusedKinds);
    const contradictory = definition.claimedKinds.filter((kind) => refused.has(kind));
    if (contradictory.length > 0) {
      throw new Error(
        `SPECIALIST CLAIM: domain "${definition.domainId}" both claims and refuses ` +
          `${contradictory.join(', ')}. A row cannot say two things about one kind.`,
      );
    }
  }
}
