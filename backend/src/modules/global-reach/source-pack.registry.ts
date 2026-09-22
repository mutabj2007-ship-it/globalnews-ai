import { EAST_AFRICA_MEMBERS, MIDDLE_EAST_MEMBERS } from '@globalnews-ai/shared';
import type { CountrySourcePack, GovernedSourceRegion } from '@globalnews-ai/shared';
import { supranationalById } from '../geo/supranational-membership';

/** Matches the four declared product regions. Undefined geographic labels are not scope. */
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
  ...['region:europe', 'region:east-african-community'].map((id) => {
    const region = supranationalById(id);
    if (!region || region.members.length === 0)
      throw new Error(`Missing governed membership: ${id}`);
    return { id, members: region.members, provenanceNote: region.source };
  }),
];

/** N/O/P own regional manifest imports here. No implicit import of legacy feed lists. */
export const GLOBAL_REACH_SOURCE_PACKS: readonly CountrySourcePack[] = [];
