'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hero } from '@/src/client/components/screens/landing/01-hero';
import { Ikigai } from '@/src/client/components/screens/landing/02-ikigai';
import { Footer } from '@/src/client/components/screens/landing/06-footer';

function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
}

export default function Landing() {
  const router = useRouter();
  const [isNative, setIsNative] = useState<boolean | null>(null);

  useEffect(() => {
    if (isCapacitorNative()) {
      router.replace('/home');
    } else {
      setIsNative(false);
    }
  }, [router]);

  if (isNative === null) {
    return null;
  }

  return (
    <main className="overflow-x-hidden">
      <Hero />
      <Ikigai />
      <Footer />
    </main>
  );
}
