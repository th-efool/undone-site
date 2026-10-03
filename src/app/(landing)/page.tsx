import type { Metadata } from 'next';
import { Hero, VideoExplainer, Ikigai } from '@/src/client/screens/landing';

export const metadata: Metadata = {
  title: {
    absolute: 'Undone',
  },
  description: 'Turn a curiosity, skill, or question into a learning journey.',
};

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <VideoExplainer />
      <Ikigai />
    </main>
  );
}
