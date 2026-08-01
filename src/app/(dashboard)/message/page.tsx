'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Message } from '@/src/client/components/screens/dashboard/message';
import { isNativeApp } from '@/src/client/utils/isNative';

export default function MessagePage() {
  const router = useRouter();

  useEffect(() => {
    if (isNativeApp()) {
      router.replace('/home');
    }
  }, [router]);

  if (isNativeApp()) {
    return null;
  }

  return (
    <>
      <Message />
    </>
  );
}
