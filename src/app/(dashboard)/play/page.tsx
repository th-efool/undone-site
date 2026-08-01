import { Suspense } from 'react';
import { Play } from '@/src/client/components/screens/dashboard/play';

export default function PlayPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#fff' }}>Loading microlearning player...</div>}>
      <Play />
    </Suspense>
  );
}
