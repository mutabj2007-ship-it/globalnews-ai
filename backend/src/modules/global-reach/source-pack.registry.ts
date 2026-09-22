import { EAST_AFRICA_MEMBERS, MIDDLE_EAST_MEMBERS, loadSourcePacks } from '@globalnews-ai/shared';
import type { GovernedSourceRegion } from '@globalnews-ai/shared';
import { supranationalById } from '../geo/supranational-membership';
import eastAfrica from './data/n-canonical-packs.json';
import middleEast from './data/o-canonical-packs.json';
import eu27 from './data/p-canonical-packs.json';

/** M R2: primary programmes only; navigation geography does not define completeness. */
export const GLOBAL_REACH_REGIONS: readonly GovernedSourceRegion[] = [
  {
    id: 'region:east-africa',
    members: EAST_AFRICA_MEMBERS,
    provenanceNote: 'Product Owner Alpha monitoring membership, alpha-1',
  },
  {
    id: 'region:middle-east',
    members: MIDDLE_EAST_MEMBERS,
    provenanceNote: 'Product Owner Alpha monitoring membership, alpha-1',
  },
  ...['region:european-union'].map((id) => {
    const region = supranationalById(id);
    if (!region || region.members.length === 0)
      throw new Error('Missing governed membership: ' + id);
    return { id, members: region.members, provenanceNote: region.source };
  }),
];

/** N -> O -> P: only offline-normalized canonical records, never original research JSON.
 * Shared authority validates admission and derives all coverage states. No acquisition. */
export const GLOBAL_REACH_SOURCE_PACKS = loadSourcePacks(
  [...eastAfrica, ...middleEast, ...eu27],
  GLOBAL_REACH_REGIONS,
);
