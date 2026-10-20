import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import RoomScreen from '@/src/client/screens/dashboard/studyroom/room/RoomScreen';
import { getRoomBySlug } from '@/src/client/screens/dashboard/studyroom/data/roomCatalog';
import type { ViewerRole } from '@/src/client/screens/dashboard/studyroom/types';

export const metadata: Metadata = {
  title: 'Study Room',
  description: 'A shared focus room on Undone.',
};

export default async function StudyRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomSlug: string }>;
  searchParams: Promise<{ viewAs?: string | string[] }>;
}) {
  const { roomSlug } = await params;
  const room = getRoomBySlug(roomSlug);
  if (!room) notFound();

  const { viewAs } = await searchParams;
  const viewAsStr = Array.isArray(viewAs) ? viewAs[0] : viewAs;
  const override: ViewerRole | undefined =
    viewAsStr === 'admin' || viewAsStr === 'member' ? viewAsStr : undefined;

  return (
    <main>
      <RoomScreen roomSlug={room.slug} viewAsOverride={override} />
    </main>
  );
}
