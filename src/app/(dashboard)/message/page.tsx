'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { isNativeApp } from '@/src/client/utils/isNative';

const Message = dynamic(
  () => import('@/src/client/components/screens/dashboard/message').then((mod) => mod.Message)
);

export default function MessagePage() {
  const router = useRouter();

  useEffect(() => {
    if (isNativeApp()) {
      router.replace('/home');
    }
  }, [router]);

  if (isNativeApp()) {
    return null;
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Messages | SideQuestHQ',
    description: 'Connect and chat with your cohort members on SideQuestHQ. Stay updated with your study groups.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <Message />
      </Suspense>
    </>
  );
}
