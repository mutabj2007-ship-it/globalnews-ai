import { StoryInspectionScreen } from '@/components/admin/screens/StoryInspectionScreen';

/**
 * PUBLIC VISUAL CONVERGENCE — Admin → News → Story inspection.
 *
 * Thin by design, like every other admin page: a Server Component that renders one screen. The
 * story is chosen by query (`?storyId=` or `?articleRef=`), handed to the screen as props; identity,
 * capabilities and the dictionary come from AdminShell.
 */
export default function Page({
  searchParams,
}: {
  searchParams: { storyId?: string | string[]; articleRef?: string | string[] };
}): JSX.Element {
  const one = (value: string | string[] | undefined): string | null => (typeof value === 'string' ? value : null);
  return <StoryInspectionScreen storyId={one(searchParams.storyId)} articleRef={one(searchParams.articleRef)} />;
}
