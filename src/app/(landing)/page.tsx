import type { Metadata } from 'next';
import { Hero, VideoExplainer, Ikigai } from '@/src/client/screens/landing';

export const metadata: Metadata = {
  title: {
    absolute: 'Undone',
  },
  description: 'A little curiosity goes a long way.',
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
