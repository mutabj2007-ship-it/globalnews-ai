import { MAX_FEED_BYTES, readBoundedText } from './rss-feed.provider';

/** REASON TO RETURN R1 · §5 — fetched feed content is size-bounded, never buffered unbounded. */
describe('RSS bounded read', () => {
  it('reads an ordinary feed body', async () => {
    const res = new Response('<rss><channel><title>ok</title></channel></rss>');
    await expect(readBoundedText(res, MAX_FEED_BYTES)).resolves.toContain('<title>ok</title>');
  });

  it('refuses a body whose declared length is over the limit, before reading it', async () => {
    const res = new Response('x', { headers: { 'content-length': String(MAX_FEED_BYTES + 1) } });
    await expect(readBoundedText(res, MAX_FEED_BYTES)).rejects.toThrow(/exceeds/);
  });

  it('refuses a streamed body that grows past the limit without a declared length', async () => {
    const chunk = new Uint8Array(1024).fill(65);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.byteLength;
        if (sent > 8 * 1024) controller.close();
        else controller.enqueue(chunk);
      },
    });
    await expect(readBoundedText(new Response(stream), 4 * 1024)).rejects.toThrow(/exceeds/);
  });

  it('decodes UTF-8 across chunk boundaries', async () => {
    const res = new Response('Łódź — Kigali');
    await expect(readBoundedText(res, MAX_FEED_BYTES)).resolves.toBe('Łódź — Kigali');
  });
});
