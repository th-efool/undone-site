'use client';

import React, { Suspense } from 'react';
import { Message } from '@/src/client/screens/dashboard/message';
import { MessageSkeleton } from '@/src/client/components/global/Skeleton';

export default function MessagePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Undone > Messages',
    description: 'Connect and chat with your cohort members on Undone. Stay updated with your study groups.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={<MessageSkeleton />}>
        <Message />
      </Suspense>
    </>
  );
}
