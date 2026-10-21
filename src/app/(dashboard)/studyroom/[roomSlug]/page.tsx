import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import RoomScreen from '@/src/client/screens/dashboard/studyroom/room/RoomScreen';
import { getRoomBySlug } from '@/src/client/screens/dashboard/studyroom/data/roomCatalog';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomSlug: string }>;
}): Promise<Metadata> {
  const { roomSlug } = await params;
  const dbRoom = await prisma.studyRoom.findFirst({
    where: { OR: [{ slug: roomSlug }, { id: roomSlug }] },
    select: { title: true },
  });
  const catalogRoom = getRoomBySlug(roomSlug);
  const title = dbRoom?.title || catalogRoom?.title || 'Study Room';
  return {
    title: `${title} | Study Room`,
    description: 'A shared focus room on Undone.',
  };
}

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
      status: { not: 'ARCHIVED' },
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
