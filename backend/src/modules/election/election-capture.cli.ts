/** Operator-only acquisition. Never import from an HTTP module. One GET, no redirects/retries. */
import { get } from 'node:https';
import { TLSSocket } from 'node:tls';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { officialUrl, sha256 } from './election-validation';
import type { RetainedArtifact } from './election-evidence';

export async function captureOfficial(
  url: string,
  discoveredFrom: string | null,
): Promise<RetainedArtifact> {
  officialUrl(url);
  if (discoveredFrom !== null) officialUrl(discoveredFrom);
  return new Promise((resolveCapture, reject) => {
    const req = get(
      url,
      {
        headers: {
          'User-Agent': 'GlobalNewsAI-bounded-evidence-review/1.0',
          Accept: 'application/pdf,text/html',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(
            new Error(
              `STOP: HTTP ${res.statusCode}; no retry; respect Retry-After ${res.headers['retry-after'] ?? ''}`,
            ),
          );
          return;
        }
        const peer = (res.socket as TLSSocket).getPeerCertificate();
        // Reviewed during the first authorized capture; renewal requires operator review.
        const pinned =
          'E8:25:C5:AB:67:C9:F1:01:4D:BA:D9:8D:8F:92:62:AA:12:29:73:A8:1D:9A:77:12:4E:77:CF:14:B3:31:F7:9E';
        if (new URL(url).hostname !== 'www.iebc.or.ke' || peer.fingerprint256 !== pinned) {
          res.destroy();
          reject(new Error('STOP: unreviewed TLS identity'));
          return;
        }
        const mediaType = String(res.headers['content-type'] ?? '');
        if (!peer.fingerprint256 || !/^(application\/pdf|text\/html)/.test(mediaType)) {
          res.destroy();
          reject(new Error('STOP: transport or media type'));
          return;
        }
        const chunks: Buffer[] = [];
        let length = 0;
        res.on('data', (chunk: Buffer) => {
          length += chunk.length;
          if (length > 8 * 1024 * 1024) {
            res.destroy(new Error('STOP: byte ceiling'));
          } else chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolveCapture({
            sha256: sha256(body),
            bodyBase64: body.toString('base64'),
            requestedUrl: url,
            finalUrl: url,
            capturedAt: new Date().toISOString(),
            mediaType,
            httpStatus: 200,
            etag: res.headers.etag ?? null,
            lastModified: res.headers['last-modified'] ?? null,
            tlsPeerFingerprint256: peer.fingerprint256,
            discoveredFrom,
          });
        });
      },
    );
    const timer = setTimeout(() => req.destroy(new Error('STOP: 30 second deadline')), 30000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
  });
}

if (require.main === module) {
  const [url, output, parent] = process.argv.slice(2);
  if (!url || !output)
    throw new Error('Usage: capture URL REVIEW_OUTPUT_DIRECTORY [DISCOVERY_URL]');
  captureOfficial(url, parent ?? null)
    .then((a) => {
      const dir = resolve(output);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${a.sha256}.capture.json`), JSON.stringify(a, null, 2), {
        flag: 'wx',
      });
      writeFileSync(join(dir, `${a.sha256}.source`), Buffer.from(a.bodyBase64, 'base64'), {
        flag: 'wx',
      });
      process.stdout.write(
        JSON.stringify({
          sha256: a.sha256,
          capturedAt: a.capturedAt,
          bytes: Buffer.from(a.bodyBase64, 'base64').length,
          tlsPeerFingerprint256: a.tlsPeerFingerprint256,
        }) + '\n',
      );
    })
    .catch((error) => {
      process.stderr.write(String(error) + '\n');
      process.exitCode = 1;
    });
}
