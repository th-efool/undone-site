import type { Metadata } from 'next';
import { LandingClient } from './page.client';
import { DEFAULT_LANDING_JSON_LD, DEFAULT_LANDING_METADATA, type LandingPageProps } from './props';

export const metadata: Metadata = DEFAULT_LANDING_METADATA;

export default function Landing(_props: LandingPageProps) {
  const jsonLd = DEFAULT_LANDING_JSON_LD;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingClient />
    </>
  );
}
