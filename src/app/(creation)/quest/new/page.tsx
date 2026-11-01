import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'New Quest',
};

export default function NewQuestPage() {
  redirect('/quest/start');
}
