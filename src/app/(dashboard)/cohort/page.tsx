import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cohorts | Undone',
  description: 'View and manage your Undone cohorts.',
  openGraph: {
    title: 'Cohorts | Undone',
    description: 'View and manage your Undone cohorts.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cohorts | Undone',
    description: 'View and manage your Undone cohorts.',
  },
};

export default function cohort() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Cohorts | Undone",
    "description": "View and manage your Undone cohorts."
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
    </>
  );
}
