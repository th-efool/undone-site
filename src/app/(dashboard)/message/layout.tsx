import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages | SideQuestHQ',
  description: 'Connect and chat with your cohort members on SideQuestHQ. Stay updated with your study groups.',
  openGraph: {
    title: 'Messages | SideQuestHQ',
    description: 'Connect and chat with your cohort members on SideQuestHQ. Stay updated with your study groups.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Messages | SideQuestHQ',
    description: 'Connect and chat with your cohort members on SideQuestHQ. Stay updated with your study groups.',
  },
};

export default function MessageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
