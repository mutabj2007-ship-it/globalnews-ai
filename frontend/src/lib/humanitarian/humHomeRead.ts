import { humanitarianHomeProjection, type HumanitarianHomeProjection } from './humHomeProjection';
import { readHumanitarianObservations, readHumanitarianReaderRuling } from './humanitarianRead';

/**
 * Home's Humanitarian projection, or null (Home then renders nothing Humanitarian). The ruling is
 * read only when the read actually carries retained rows, so an absence costs one small GET.
 */
export async function readHumanitarianHome(
  projectedAt: string,
): Promise<HumanitarianHomeProjection | null> {
  const read = await readHumanitarianObservations();
  if (read.kind !== 'RETAINED') return null;
  const ruling = await readHumanitarianReaderRuling();
  return ruling === null ? null : humanitarianHomeProjection(read, ruling, projectedAt);
}
