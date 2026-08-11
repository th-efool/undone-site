import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_PEOPLE = new Set(['sia', 'yash', 'vanshika', 'shagun', 'agrim', 'ava1', 'ava2', 'ava3', 'ava4', 'official']);

const PLATFORM_MAP: Record<string, string> = {
  wa: 'whatsapp',
  reddit: 'reddit',
  discord: 'discord',
  telegram: 'telegram',
  twitter: 'twitter',
  threads: 'threads',
  insta: 'instagram',
  linkedin: 'linkedin',
  substack: 'substack',
  medium: 'medium',
  facebook: 'facebook',
  youtube: 'youtube',
  tiktok: 'tiktok',
  bluesky: 'bluesky',
  mastodon: 'mastodon',
  devto: 'devto',
  hashnode: 'hashnode',
  producthunt: 'producthunt',
};

const BASE_URL = 'https://play.google.com/store/apps/details';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ person: string; platform: string }> }
) {
  const { person, platform } = await params;

  // Validate inputs against allowlists to prevent arbitrary redirects
  if (!ALLOWED_PEOPLE.has(person) || !(platform in PLATFORM_MAP)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const utmSource = PLATFORM_MAP[platform];
  const utmCampaign = person;

  // Construct destination URL
  const url = new URL(BASE_URL);
  url.searchParams.set('id', 'com.sidequesthq.in');
  url.searchParams.set('utm_source', utmSource);
  url.searchParams.set('utm_campaign', utmCampaign);

  // Perform a 307 Temporary Redirect to prevent aggressive caching
  // and ensure tracking counts accurately over time.
  return NextResponse.redirect(url, 307);
}
