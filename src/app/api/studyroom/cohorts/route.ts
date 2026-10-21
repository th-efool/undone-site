import { NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { roomDiscoveryService } from '@/src/server/domain/studyroom/room-discovery.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ cohorts: [] }, { status: 200 });
    }

    const cohorts = await roomDiscoveryService.getEligibleCohortsForCreation(user.id);
    return NextResponse.json({ cohorts }, { status: 200 });
  } catch (error) {
    console.error('Failed to get eligible cohorts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
