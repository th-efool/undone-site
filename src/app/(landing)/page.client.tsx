'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hero } from '@/src/client/screens/landing/01-hero';
import dynamic from 'next/dynamic';

const Ikigai = dynamic(() => import('@/src/client/screens/landing/02-ikigai').then((mod) => mod.Ikigai));
const Footer = dynamic(() => import('@/src/client/screens/landing/06-footer').then((mod) => mod.Footer));

function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
}

export function LandingClient() {
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
