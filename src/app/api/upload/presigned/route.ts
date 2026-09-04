import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const contentType = body.contentType || 'application/octet-stream';

    const key = crypto.randomUUID();
    const bucket = process.env.R2_BUCKET_NAME!;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });
    
    // Uses R2_PUBLIC_URL if defined, otherwise falls back to the bucket URL
    const baseUrl = process.env.R2_PUBLIC_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}`;
    const objectUrl = `${baseUrl}/${key}`;

    return NextResponse.json({
      presignedUrl,
      objectUrl,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Failed to generate presigned URL' }, { status: 500 });
  }
}
