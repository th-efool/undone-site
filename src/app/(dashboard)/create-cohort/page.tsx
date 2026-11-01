import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Create a Cohort',
  description: 'Create and organize a new cohort on Undone. Bring your community together to learn and grow.',
  openGraph: {
    title: 'Undone > Create a Cohort',
    description: 'Create and organize a new cohort on Undone. Bring your community together to learn and grow.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone > Create a Cohort',
    description: 'Create and organize a new cohort on Undone. Bring your community together to learn and grow.',
  },
};

export default function CreateCohortPage() {
  redirect('/quest/start');
}
