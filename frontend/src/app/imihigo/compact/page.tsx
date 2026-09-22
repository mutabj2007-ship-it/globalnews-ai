import type { JSX } from 'react';
import ImihigoPage from '../page';
export { metadata } from '../page';
export default function CompactImihigoPage(): JSX.Element {
  return <ImihigoPage searchParams={{ compact: '1' }} />;
}
