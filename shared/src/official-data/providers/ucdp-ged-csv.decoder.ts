import type {
  ArtifactDecodeResult,
  ArtifactDecoder,
  ParserBinding,
} from '../parser-registry';

/**
 * UCDP Candidate GED 26.0.7 — captured schema authority.
 *
 * CF-D4 was measured against the publisher's real CSV bytes on 2026-09-20:
 * sha256 9fc2c6dd85eee91845512e8ef1055281d9fd028fb98748a6f2a27c6e8aa8c562,
 * 1,357,690 bytes, Content-Type text/csv, 49 columns.
 *
 * The header is pinned exactly. A future UCDP release whose schema moves is refused
 * until it is measured and this adapter is deliberately revised.
 */
export const UCDP_CANDIDATE_GED_CAPTURED_HEADER = Object.freeze([
  'id',
  'relid',
  'year',
  'active_year',
  'code_status',
  'type_of_violence',
  'conflict_dset_id',
  'conflict_new_id',
  'conflict_name',
  'dyad_dset_id',
  'dyad_new_id',
  'dyad_name',
  'side_a_dset_id',
  'side_a_new_id',
  'side_a',
  'side_b_dset_id',
  'side_b_new_id',
  'side_b',
  'number_of_sources',
  'source_article',
  'source_office',
  'source_date',
  'source_headline',
  'source_original',
  'where_prec',
  'where_coordinates',
  'where_description',
  'adm_1',
  'adm_2',
  'latitude',
  'longitude',
  'geom_wkt',
  'priogrid_gid',
  'country',
  'country_id',
  'region',
  'event_clarity',
  'date_prec',
  'date_start',
  'date_end',
  'deaths_a',
  'deaths_b',
  'deaths_civilians',
  'deaths_unknown',
  'best',
  'high',
  'low',
  'gwnoa',
  'gwnob',
] as const);

export type UcdpCandidateGedColumn = (typeof UCDP_CANDIDATE_GED_CAPTURED_HEADER)[number];

export interface UcdpGedCsvDecoded {
  readonly header: readonly string[];
  readonly rows: readonly Readonly<Record<UcdpCandidateGedColumn, string>>[];
}

function parseCsv(text: string): ArtifactDecodeResult<UcdpGedCsvDecoded> {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const finishField = (): void => {
    row.push(field);
    field = '';
  };
  const finishRow = (): void => {
    finishField();
    /* Ignore one terminal empty record produced by a final newline. */
    if (!(row.length === 1 && row[0] === '' && records.length > 0)) records.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (field.length !== 0) {
        return {
          ok: false,
          refusalKey: 'PARSE_FAILED',
          detail: 'CSV_QUOTE_AFTER_UNQUOTED_TEXT',
        };
      }
      quoted = true;
    } else if (ch === ',') {
      finishField();
    } else if (ch === '\n') {
      if (field.endsWith('\r')) field = field.slice(0, -1);
      finishRow();
    } else {
      field += ch;
    }
  }

  if (quoted) {
    return { ok: false, refusalKey: 'PARSE_FAILED', detail: 'CSV_UNTERMINATED_QUOTED_FIELD' };
  }
  if (field.length > 0 || row.length > 0) finishRow();

  if (records.length < 2) {
    return { ok: false, refusalKey: 'PARSE_FAILED', detail: 'CSV_HAS_NO_DATA_ROWS' };
  }

  const header = records[0]!;
  if (new Set(header).size !== header.length) {
    return { ok: false, refusalKey: 'PARSE_FAILED', detail: 'CSV_DUPLICATE_HEADER' };
  }

  const rows: Readonly<Record<UcdpCandidateGedColumn, string>>[] = [];
  for (let i = 1; i < records.length; i += 1) {
    const values = records[i]!;
    if (values.length !== header.length) {
      return {
        ok: false,
        refusalKey: 'PARSE_FAILED',
        detail: 'CSV_ROW_WIDTH_MISMATCH',
      };
    }

    const record: Record<string, string> = {};
    for (let j = 0; j < header.length; j += 1) {
      record[header[j]!] = values[j] ?? '';
    }
    rows.push(record as Record<UcdpCandidateGedColumn, string>);
  }

  return { ok: true, value: { header: Object.freeze([...header]), rows: Object.freeze(rows) } };
}

export const decodeUcdpCandidateGedCsv: ArtifactDecoder<UcdpGedCsvDecoded> = (decoded) => {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(decoded);
  } catch {
    return { ok: false, refusalKey: 'PARSE_FAILED', detail: 'CSV_NOT_UTF8' };
  }
  return parseCsv(text);
};

export function assertUcdpCandidateGedEnvelope(value: UcdpGedCsvDecoded): true | string {
  if (value.header.length !== UCDP_CANDIDATE_GED_CAPTURED_HEADER.length) {
    return 'UCDP_GED_HEADER_WIDTH_CHANGED';
  }
  for (let i = 0; i < UCDP_CANDIDATE_GED_CAPTURED_HEADER.length; i += 1) {
    if (value.header[i] !== UCDP_CANDIDATE_GED_CAPTURED_HEADER[i]) {
      return 'UCDP_GED_HEADER_CHANGED';
    }
  }
  if (value.rows.length === 0) return 'UCDP_GED_NO_ROWS';
  return true;
}

export const UCDP_CANDIDATE_GED_BINDING: ParserBinding<UcdpGedCsvDecoded> = Object.freeze({
  parserId: 'ucdp.candidate-ged.csv',
  parserVersion: '26.0.7-schema1',
  mediaType: 'text/csv',
  decode: decodeUcdpCandidateGedCsv,
  assertEnvelope: assertUcdpCandidateGedEnvelope,
});
