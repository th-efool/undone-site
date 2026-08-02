import { Suspense } from 'react';
import { Play } from '@/src/client/components/screens/dashboard/play';
import { PlaySkeleton } from '@/src/client/components/global/Skeleton';

export default function PlayPage() {
  return (
    <Suspense fallback={<PlaySkeleton />}>
      <Play />
    </Suspense>
  );
}
