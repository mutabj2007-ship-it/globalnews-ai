import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256, validateBundle } from './election-validation';
import type { ElectionBundle, ElectionEvidence } from './election-evidence';
import { ADMITTED_BUNDLE_SHA256 } from './election-admitted';

const labels = {
  en: {
    FORM_AVAILABLE: 'FORM AVAILABLE',
    FORM_REPORTED: 'FORM REPORTED',
    TALLY_OBSERVATION: 'TALLY OBSERVATION',
    OFFICIAL_DECLARATION: 'OFFICIAL DECLARATION',
  },
  pl: {
    FORM_AVAILABLE: 'FORMULARZ DOSTĘPNY',
    FORM_REPORTED: 'FORMULARZ ZGŁOSZONY',
    TALLY_OBSERVATION: 'OBSERWACJA ZLICZANIA GŁOSÓW',
    OFFICIAL_DECLARATION: 'OFICJALNE OGŁOSZENIE',
  },
} as const;

/** Pure projection: source language never follows the product locale. */
export function electionReadView(bundle: ElectionBundle, locale: 'en' | 'pl', now: number) {
  const superseded = new Set(bundle.records.map((r) => r.revision.supersedes));
  const records = bundle.records
    .filter((r) => !superseded.has(r.revision.id))
    .filter((r) => r.kind !== 'TALLY_OBSERVATION' || Date.parse(r.expiresAt) >= now);
  return {
    state: records.length ? ('EVIDENCE' as const) : ('COVERAGE_GAP' as const),
    domain: 'ELECTION' as const,
    locale,
    records: records.map((r: ElectionEvidence) => {
      const base = {
        id: r.id,
        kind: r.kind,
        label: labels[locale][r.kind],
        election: r.election,
        form: r.form,
        capturedAt: r.capturedAt,
        sourceLanguage: r.sourceLanguage,
        source: r.source,
        revision: r.revision,
        citation: r.citation,
      };
      switch (r.kind) {
        case 'FORM_AVAILABLE':
          return { ...base, availability: r.availability, documentRole: r.documentRole };
        case 'FORM_REPORTED':
          return {
            ...base,
            publisherStatus: r.publisherStatus,
            reported: r.reported,
            total: r.total,
            unitLabel: r.unitLabel,
          };
        case 'TALLY_OBSERVATION':
          return {
            ...base,
            publisherStatus: r.publisherStatus,
            publisherStatedAt: r.publisherStatedAt,
            scope: r.scope,
            readings: r.votes.map((v) => ({
              candidateBallotName: v.candidateBallotName,
              partyAsPublished: v.partyAsPublished,
              qualifiedReading: `${labels[locale].TALLY_OBSERVATION} · ${r.publisherStatus} · ${v.votesAsPublished}`,
              citation: v.citation,
            })),
          };
        case 'OFFICIAL_DECLARATION':
          return {
            ...base,
            publisherStatus: r.publisherStatus,
            declaredAt: r.declaredAt,
            declaredPerson: r.declaredPerson,
            qualifiedReading:
              r.votesAsPublished === null
                ? null
                : `${labels[locale].OFFICIAL_DECLARATION} · ${r.votesAsPublished}`,
          };
      }
    }),
  };
}

@Injectable()
export class ElectionReadService {
  private readonly logger = new Logger(ElectionReadService.name);
  read(locale: 'en' | 'pl') {
    const gap = {
      state: 'COVERAGE_GAP' as const,
      domain: 'ELECTION' as const,
      locale,
      records: [],
    };
    // Production HOLD. This switch is also the tested immediate stop control.
    if (process.env.ELECTION_EVIDENCE_READ_ENABLED !== 'true') return gap;
    try {
      const bytes = readFileSync(join(__dirname, 'data', `${ADMITTED_BUNDLE_SHA256}.json`));
      if (sha256(bytes) !== ADMITTED_BUNDLE_SHA256) throw new Error('retained digest mismatch');
      return electionReadView(
        validateBundle(JSON.parse(bytes.toString('utf8'))),
        locale,
        Date.now(),
      );
    } catch {
      this.logger.error('ELECTION_EVIDENCE_WITHHELD: retained evidence validation failed');
      return gap;
    }
  }
}
