"""Offline exact-source decoder. No network imports; explicit execution gate."""
import argparse, hashlib, json, pathlib, re
import pypdf
from pypdf import PdfReader
ROOT = pathlib.Path(__file__).resolve().parents[2]
EXPECTED_SHA256 = 'fb858beb954de5912a737f05d27a65ddea4c7ba97c782dca26019f1e6847b0af'
SOURCE_URL = 'https://statistics.gov.rw/sites/default/files/documents/2026-03/Imihigo%202024~2025.pdf'

def decode():
    directory = ROOT / 'data/imihigo'
    meta = json.loads((directory / 'capture.json').read_text(encoding='utf-8'))
    raw = (directory / meta['artifact']).read_bytes()
    if hashlib.sha256(raw).hexdigest() != EXPECTED_SHA256 or meta['sha256'] != EXPECTED_SHA256 or meta['sourceUrl'] != SOURCE_URL:
        raise ValueError('Exact-source identity mismatch')
    pages = [p.extract_text() for p in PdfReader(directory / meta['artifact']).pages]
    norm = lambda s: ' '.join(s.split())
    assert 'Licensed under CC BY 4.0.' in pages[1]
    assert 'final evaluation in August 2025' in norm(pages[10])
    assert 'Figure 1: District performance in 2024/2025' in pages[8]
    assert 'Rank District Final Score' in pages[8]
    matches = re.findall(r'^\d+ ([A-Za-z]+) (\d+(?:\.\d+)?)$', pages[8], re.M)
    if len(matches) != 27 or len({name for name, _ in matches}) != 27:
        raise ValueError('Expected exactly 27 unique district rows')
    records = []
    for name, value in matches:
        line = next(line for line in pages[8].splitlines() if re.fullmatch(r'\d+ ' + re.escape(name) + ' ' + re.escape(value), line))
        records.append({
            'entity': name, 'entityClass': 'district',
            'result': {'label': 'Final Score', 'value': value, 'unit': None},
            'target': None, 'indicator': None, 'evaluationStatus': None,
            'provenance': {'pdfPage': 9, 'printedPage': '7', 'section': 'Figure 1: District performance in 2024/2025', 'quote': line, 'columnHeader': 'Rank District Final Score'}
        })
    city_quote = 'the City of Kigali and its affiliated districts achieved an overall performance score of 59.3%'
    assert city_quote in norm(pages[7])
    records.append({
        'entity': 'City of Kigali and its affiliated districts', 'entityClass': 'city-of-kigali',
        'result': {'label': 'overall performance score', 'value': '59.3', 'unit': '%'},
        'target': None, 'indicator': None, 'evaluationStatus': None,
        'provenance': {'pdfPage': 8, 'printedPage': '6', 'section': '1.2 Imihigo evaluation key findings and performance', 'quote': city_quote, 'columnHeader': None}
    })
    # Lexical identity ordering happens once at admission, never by result or in the UI.
    records.sort(key=lambda row: row['entity'])
    return {
        'schemaVersion': 1, 'captureId': EXPECTED_SHA256, 'documentId': 'nisr-imihigo-2024-2025-final',
        'revisionOf': None, 'revisionLabel': 'First retained publication; publisher revision number not stated',
        'cycle': '2024/2025', 'reportPeriod': '2024/2025',
        'evaluationDate': {'value': '2025-08', 'precision': 'month', 'pdfPage': 11, 'quote': 'a final evaluation in August 2025'},
        'publicationDate': None, 'sourceLanguage': 'en',
        'languageBasis': 'English source document; human verified, not inferred from display locale',
        'publisher': meta['publisher'], 'sourceUrl': SOURCE_URL,
        'sourceDocument': 'Imihigo Evaluation Report, 2024/2025', 'license': 'CC BY 4.0 (PDF page 2)',
        'artifact': 'data/imihigo/' + meta['artifact'], 'sha256': EXPECTED_SHA256,
        'capturedAt': meta['capturedAt'], 'byteLength': meta['byteLength'],
        'parser': 'imihigo-nisr-exact-source/1.0', 'decoder': 'pypdf/' + pypdf.__version__,
        'orderReason': 'LEXICAL', 'records': records,
        'coverage': '27 district final scores and the City of Kigali with its affiliated districts. No individual ministry/board scores or entity-level targets admitted. No earlier cycles admitted.'
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--authorize-offline-decode', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if not args.authorize_offline_decode:
        parser.error('Explicit --authorize-offline-decode required')
    capture = decode()
    destination = ROOT / 'frontend/src/lib/imihigo/retained.json'
    output = json.dumps(capture, ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if json.loads(destination.read_text(encoding='utf-8')) != capture:
            raise ValueError('Retained data differs from exact-source decoding')
        print('PASS: retained data reproduces from exact-source PDF')
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            raise ValueError('Append-only: retained capture already exists; use --check')
        destination.write_text(output, encoding='utf-8')
        print('Admitted', len(capture['records']), 'records; no calculated scores')

if __name__ == '__main__':
    main()
