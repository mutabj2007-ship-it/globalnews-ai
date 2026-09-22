import { EconomyController } from './economy.controller';
import { EconomyObservationReadService } from './economy-observation.read';
import { RetainedNisrCpiReader } from '../official-data/nisr/nisr-cpi-retained.reader';

describe('public retained Economy route', () => {
  it.each(['NO_ADMITTED_CAPTURE', 'PAYLOAD_NOT_RETAINED', 'EXTRACTOR_IDENTITY_MISMATCH', 'NO_RETRIEVAL_LINEAGE', 'LINEAGE_MISMATCH', 'PARSE_FAILED'])('returns a non-publishable gap for %s without provider calls', async refusal => {
    const originalFetch = global.fetch;
    const fetch = jest.fn().mockRejectedValue(new Error('Provider transport must not be called'));
    global.fetch = fetch;
    try {
      const read = jest.fn().mockResolvedValue({ kind: 'NONE', refusal });
      const service = new EconomyObservationReadService({ read } as unknown as RetainedNisrCpiReader);
      const controller = new EconomyController(service);
      expect(await controller.nisrHeadlineCpi()).toMatchObject({
        publishable: false, slot: { kind: 'GAP', reason: refusal === 'PARSE_FAILED' ? 'WITHHELD' : 'NO_PRODUCER' },
      });
      expect(read).toHaveBeenCalledWith('rw-nisr', 'cpi-monthly-en');
      expect(fetch).not.toHaveBeenCalled();
    } finally { global.fetch = originalFetch; }
  });
});
