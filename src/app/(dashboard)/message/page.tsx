'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

const Message = dynamic(
  () => import('@/src/client/screens/dashboard/message').then((mod) => mod.Message)
);

export default function MessagePage() {
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
