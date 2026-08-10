'use client';

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { cohortRepository } from '@/src/client/repositories/cohortRepository';

/**
 * useCohort hook that properly hydrates from localStorage on the client.
 *
 * On the server (SSR), localStorage is unavailable so cohortStore.getById()
 * cannot find user-published cohorts. This hook uses useSyncExternalStore
 * to ensure the component always shows the latest data once the client hydrates.
 */
export function useCohort(cohortId: string) {
  // Use useState + useEffect to force a client-side re-lookup after hydration
  const [cohort, setCohort] = useState(() => cohortRepository.getById(cohortId));

  useEffect(() => {
    // On the client, re-lookup from cohortStore which now reads localStorage
    const found = cohortRepository.getById(cohortId);
    setCohort(found);
  }, [cohortId]);

  return cohort;
}
