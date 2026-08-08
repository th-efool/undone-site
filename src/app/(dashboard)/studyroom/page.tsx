import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study Rooms | SideQuestHQ',
  description: 'Join virtual study rooms on SideQuestHQ to collaborate and learn with peers in real-time.',
  openGraph: {
    title: 'Study Rooms | SideQuestHQ',
    description: 'Join virtual study rooms on SideQuestHQ to collaborate and learn with peers in real-time.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Study Rooms | SideQuestHQ',
    description: 'Join virtual study rooms on SideQuestHQ to collaborate and learn with peers in real-time.',
  },
};

export default function StudyRoomPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Study Rooms | SideQuestHQ',
    description: 'Join virtual study rooms on SideQuestHQ to collaborate and learn with peers in real-time.',
  };

  return (
    <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1>Study Rooms</h1>
      <section>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '1rem' }}>
          This space is reserved for Study Rooms. We will replace this mock with real functionality later!
        </p>
      </section>
    </main>
  );
}
