import retained from './retained.json';
import authorities from './authorities.json';
import { admitRetained, type ImihigoView } from './retainedModel';

/** Reader-only entry point. Acquisition and decoding live in gated offline scripts. */
export function readRetainedImihigo(): ImihigoView {
  return admitRetained([retained], authorities);
}
