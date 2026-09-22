"""Explicitly gated, single-request NISR R1 capture. Never imported by the reader."""
import argparse, datetime, hashlib, json, pathlib, urllib.request
URL = 'https://statistics.gov.rw/sites/default/files/documents/2026-03/Imihigo%202024~2025.pdf'
ROOT = pathlib.Path(__file__).resolve().parents[2]
DEST = ROOT / 'data/imihigo'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--authorize-one-capture', action='store_true')
    args = parser.parse_args()
    if not args.authorize_one_capture:
        parser.error('Explicit --authorize-one-capture is required; no acquisition performed')
    if any(DEST.iterdir()):
        parser.error('Capture already retained; R1 refuses another acquisition')
    request = urllib.request.Request(URL, headers={'User-Agent': 'GlobalNewsAI-Imihigo-R1/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        if response.url != URL:
            raise ValueError('Unexpected redirect: exact source identity refused')
        raw = response.read(5 * 1024 * 1024 + 1)
        if len(raw) > 5 * 1024 * 1024 or not raw.startswith(b'%PDF-'):
            raise ValueError('Unexpected source bytes')
    captured = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    digest = hashlib.sha256(raw).hexdigest()
    (DEST / 'nisr-imihigo-2024-2025.pdf').write_bytes(raw)
    (DEST / 'capture.json').write_text(json.dumps({
        'sourceUrl': URL, 'artifact': 'nisr-imihigo-2024-2025.pdf',
        'capturedAt': captured, 'sha256': digest, 'byteLength': len(raw),
        'publisher': 'National Institute of Statistics of Rwanda (NISR)',
        'reportPeriod': '2024/2025', 'captureAgent': 'imihigo-single-capture/1.0',
        'mediaType': 'application/pdf'
    }, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'capturedAt': captured, 'sha256': digest, 'byteLength': len(raw)}))

if __name__ == '__main__':
    main()
