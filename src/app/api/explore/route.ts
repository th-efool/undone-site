import { NextResponse } from 'next/server';
import { exploreRepo } from '@/src/server/infrastructure/db/mock/repositories/explore.repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const data = exploreRepo.getExplore();
  return NextResponse.json(data);
}

