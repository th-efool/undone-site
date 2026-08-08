import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cohorts | SideQuestHQ',
  description: 'View and manage your SideQuestHQ cohorts.',
  openGraph: {
    title: 'Cohorts | SideQuestHQ',
    description: 'View and manage your SideQuestHQ cohorts.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cohorts | SideQuestHQ',
    description: 'View and manage your SideQuestHQ cohorts.',
  },
};

export default function cohort() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Cohorts | SideQuestHQ",
    "description": "View and manage your SideQuestHQ cohorts."
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="sr-only">Your Cohorts</h1>
    </main>
  );
}
