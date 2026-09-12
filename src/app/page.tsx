import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/hackathon');
  return null;
}
