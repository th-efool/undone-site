import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import RoomScreen from '@/src/client/screens/dashboard/studyroom/room/RoomScreen';
import { getRoomBySlug } from '@/src/client/screens/dashboard/studyroom/data/roomCatalog';

export const metadata: Metadata = {
  title: 'Study Room | Undone',
  description: 'A shared focus room on Undone.',
};

export default async function StudyRoomPage({
  params,
}: {
  params: Promise<{ roomSlug: string }>;
}) {
  const { roomSlug } = await params;

  // 1. Check database for existing room
  const dbRoom = await prisma.studyRoom.findFirst({
    where: {
      OR: [{ slug: roomSlug }, { id: roomSlug }],
    },
    select: { id: true, slug: true, title: true, status: true },
  });

  // 2. Fallback to default catalog rooms
  const catalogRoom = getRoomBySlug(roomSlug);

  if (!dbRoom && !catalogRoom) {
    notFound();
  }

  const canonicalSlug = dbRoom?.slug || catalogRoom?.slug || roomSlug;

  return (
    <main>
      <RoomScreen roomSlug={canonicalSlug} />
    </main>
  );
}
