'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';

export function useCohortViewer(cohortId: string) {
  const { data: session, status } = useSession();
  const isLoggedIn = status === 'authenticated' && !!session?.user;

  const { data } = useQuery({
    queryKey: ['cohort-viewer', cohortId, session?.user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/cohort/${cohortId}/viewer`);
      if (!res.ok) return { enrolled: false };
      return res.json() as Promise<{ enrolled: boolean }>;
    },
    enabled: isLoggedIn,
    staleTime: 60_000,
  });

  return {
    isLoggedIn,
    isEnrolled: isLoggedIn && Boolean(data?.enrolled),
  };
}
