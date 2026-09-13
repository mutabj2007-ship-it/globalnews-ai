/**
 * ════════════════════════════════════════════════════════════════════════════
 * PNG → RGB, WITH NO DEPENDENCY — C907 R2
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `spatial-visual.spec.ts` imported `./decodePng` and no such module existed,
 * so Part B could not have run even with a browser present. This is that
 * module, written rather than pulled in, for one reason: the comparator's
 * thresholds are measurements taken from the two approved golden captures, and
 * a decoder that silently resamples, premultiplies or colour-manages would move
 * every one of them. A 200-line inflate-and-unfilter has no opinions.
 *
 * Supports what a Playwright `page.screenshot({ type: 'png' })` actually emits:
 * 8-bit, non-interlaced, colour type 2 (RGB) or 6 (RGBA). Anything else is
 * REJECTED BY NAME rather than guessed at — a decoder that quietly mishandles a
 * bit depth produces plausible pixels and therefore a plausible, wrong verdict.
 *
 * Output is tightly packed RGB triples, which is exactly what
 * `compare-golden-frame.mjs` indexes (`pixels[i]`, `[i+1]`, `[i+2]`, stride 3).
 * Alpha is dropped, not blended: these captures are fully opaque, and blending
 * against an assumed background would invent colour the frame does not contain.
 */

import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

/**
 * @param {Buffer|Uint8Array} input a complete PNG file
 * @returns {{ pixels: Uint8Array, width: number, height: number }} packed RGB
 */
export function decodePng(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);

  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('decodePng: not a PNG (signature mismatch)');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = -1;
  let interlace = 0;
  let sawIhdr = false;
  const idat = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colourType = body[9];
      interlace = body[12];
      sawIhdr = true;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length; // length + type + body + CRC
  }

  if (!sawIhdr) throw new Error('decodePng: no IHDR chunk');
  if (idat.length === 0) throw new Error('decodePng: no IDAT data');
  if (bitDepth !== 8) throw new Error(`decodePng: unsupported bit depth ${bitDepth}; only 8 is supported`);
  if (colourType !== 2 && colourType !== 6) {
    throw new Error(`decodePng: unsupported colour type ${colourType}; only 2 (RGB) and 6 (RGBA) are supported`);
  }
  if (interlace !== 0) throw new Error('decodePng: interlaced PNGs are not supported');

  const channels = colourType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));

  if (raw.length < height * (stride + 1)) {
    throw new Error('decodePng: truncated image data');
  }

  /* Un-filter in place, one scanline at a time. Bytes are relative to the
     PREVIOUS BYTE OF THE SAME PIXEL, not the previous byte — hence `channels`
     as the left offset, which is the part most hand-rolled decoders get wrong
     on RGBA. */
  const lines = Buffer.allocUnsafe(height * stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;

    for (let x = 0; x < stride; x += 1) {
      const value = raw[src + x];
      const left = x >= channels ? lines[dst + x - channels] : 0;
      const above = y > 0 ? lines[up + x] : 0;
      const upLeft = y > 0 && x >= channels ? lines[up + x - channels] : 0;

      let out;
      switch (filter) {
        case 0: out = value; break;
        case 1: out = value + left; break;
        case 2: out = value + above; break;
        case 3: out = value + ((left + above) >> 1); break;
        case 4: out = value + paeth(left, above, upLeft); break;
        default: throw new Error(`decodePng: unknown filter type ${filter} on row ${y}`);
      }
      lines[dst + x] = out & 0xff;
    }
  }

  if (channels === 3) {
    return { pixels: new Uint8Array(lines.buffer, lines.byteOffset, lines.length), width, height };
  }

  const pixels = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < lines.length; i += 4, j += 3) {
    pixels[j] = lines[i];
    pixels[j + 1] = lines[i + 1];
    pixels[j + 2] = lines[i + 2];
  }
  return { pixels, width, height };
}

export default decodePng;
