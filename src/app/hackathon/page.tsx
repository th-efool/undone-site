import type { Metadata } from 'next';
import HackathonClient from './HackathonClient';

export const metadata: Metadata = {
  title: 'Hackathon MVP Submission | BuildBank Embedded Financial Rewards',
  description:
    'Live working MVP submission for BuildBank × SideQuestHQ. An embedded financial rewards layer that turns user behavior into real financial value with instant in-context redemption.',
  openGraph: {
    title: 'Hackathon MVP Submission | BuildBank Embedded Financial Rewards',
    description:
      'Live working MVP submission for BuildBank × SideQuestHQ. Turning everyday user actions into real financial opportunities.',
    type: 'website',
  },
};

export default function HackathonPage() {
  return <HackathonClient />;
}
