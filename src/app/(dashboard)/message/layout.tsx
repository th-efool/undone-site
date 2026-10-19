import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Connect and chat with your cohort members on Undone. Stay updated with your study groups.',
  openGraph: {
    title: 'Undone - Messages',
    description: 'Connect and chat with your cohort members on Undone. Stay updated with your study groups.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone - Messages',
    description: 'Connect and chat with your cohort members on Undone. Stay updated with your study groups.',
  },
};

export default function MessageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
