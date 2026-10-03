import type { Metadata } from 'next';
import { Hero, Section2 } from '@/src/client/screens/landing';

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
      <Section2 />
    </main>
  );
}
