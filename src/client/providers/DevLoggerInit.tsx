'use client';

import { useEffect } from 'react';
import { devLogger } from '@/src/shared/lib/dev-logger';

export function DevLoggerInit() {
  useEffect(() => {
    devLogger.info('Browser', 'DevLogger initialized on client root', {
      url: window.location.href,
      time: new Date().toISOString(),
    });
  }, []);
  return null;
}
