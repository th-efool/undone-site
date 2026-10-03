import type { Metadata } from 'next';
import { ReconstructedHero } from '@/src/client/screens/landing/ReconstructedHero/ReconstructedHero';

export const metadata: Metadata = {
  title: {
    absolute: 'Undone',
  },
  description: 'Turn a curiosity, skill, or question into a learning journey.',
};

export default function LandingPage() {
  return (
    <main>
      <ReconstructedHero />
    </main>
  );
}
