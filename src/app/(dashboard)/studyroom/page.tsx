import StudyRoomScreen from '@/src/client/screens/dashboard/studyroom/StudyRoomScreen';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study Rooms | Undone',
  description: 'Join virtual study rooms on Undone to collaborate and learn with peers in real-time.',
};

export default function StudyRoomPage() {
  return (
    <main>
      <StudyRoomScreen />
    </main>
  );
}
