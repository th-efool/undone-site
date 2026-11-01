'use client';

import React from 'react';
import { SiteFailureBridge } from '@/src/client/feedback/SiteFailureBridge';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/src/client/react-query/query-client';

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return <QueryClientProvider client={queryClient}><SiteFailureBridge />{children}</QueryClientProvider>;
}
