import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Quest Draft',
};

export default function QuestDraftPage() {
  redirect('/quest/start');
}
