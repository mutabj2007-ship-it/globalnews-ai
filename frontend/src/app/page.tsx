import { NavBar } from '@/components/navigation/NavBar';
import { LiveStatusStrip } from '@/components/home/LiveStatusStrip';
import { Hero } from '@/components/home/Hero';
import { NewsroomSection } from '@/components/home/NewsroomSection';
import { CategoryCards } from '@/components/home/CategoryCards';
import { LatestUpdatesFeed } from '@/components/home/LatestUpdatesFeed';
import { HowItWorks } from '@/components/home/HowItWorks';
import { TrustSection } from '@/components/home/TrustSection';
import { Footer } from '@/components/layout/Footer';
import { getHomeFeed } from '@/lib/homeFeed';

export default async function HomePage(): Promise<JSX.Element> {
  const feed = await getHomeFeed();

  return (
    <>
      <NavBar />
      <LiveStatusStrip isLive={feed.isLive} dataMode={feed.dataMode} />
      <main>
        <Hero />
        <NewsroomSection story={feed.featured} trending={feed.trending} dataMode={feed.dataMode} />
        <CategoryCards cards={feed.categoryCards} />
        <LatestUpdatesFeed updates={feed.latestUpdates} dataMode={feed.dataMode} />
        <HowItWorks />
        <TrustSection />
      </main>
      <Footer />
    </>
  );
}
