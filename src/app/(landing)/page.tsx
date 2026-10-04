import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Hero } from '@/src/client/screens/landing';

const VideoExplainer = dynamic(
  () => import('@/src/client/screens/landing/VideoExplainer').then((mod) => mod.VideoExplainer),
  {
    loading: () => <div style={{ minHeight: '100vh', backgroundColor: '#0E1738' }} />,
  }
);

const Ikigai = dynamic(
  () => import('@/src/client/screens/landing/Ikigai').then((mod) => mod.Ikigai)
);

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
