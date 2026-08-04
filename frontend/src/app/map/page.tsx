import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { MapPageClient } from '@/components/map/MapPageClient';

export const metadata: Metadata = {
  title: 'World Map \u2014 GlobalNews AI',
  description: 'Explore current news coverage by country on an interactive world map.',
};

export default function MapPage(): JSX.Element {
  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-void">
        <MapPageClient />
      </main>
      <Footer />
    </>
  );
}
