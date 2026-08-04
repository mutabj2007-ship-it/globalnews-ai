import { Suspense } from 'react';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { SearchPageClient } from '@/components/search/SearchPageClient';
import { LoadingStages } from '@/components/search/LoadingStages';

export const metadata: Metadata = {
  title: 'Search \u2014 GlobalNews AI',
  description: 'AI-powered, source-grounded analysis of a news question.',
};

export default function SearchPage(): JSX.Element {
  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-void">
        <Suspense
          fallback={
            <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
              <LoadingStages />
            </div>
          }
        >
          <SearchPageClient />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
