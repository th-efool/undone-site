import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Cohorts',
  description: 'View and manage your Undone cohorts.',
  openGraph: {
    title: 'Undone - Cohorts',
    description: 'View and manage your Undone cohorts.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone - Cohorts',
    description: 'View and manage your Undone cohorts.',
  },
};

export default async function CohortIndexPage() {
  redirect('/explore');
}

