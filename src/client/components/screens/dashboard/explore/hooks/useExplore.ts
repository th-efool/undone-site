import { useEffect, useMemo, useState } from 'react';

import { exploreRepository } from '@/src/client/repositories/exploreRepository';

export function useExplore() {
  const [loading, setLoading] = useState(true);
  const explore = useMemo(() => exploreRepository.getExplore(), []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  return { ...explore, loading };
}
