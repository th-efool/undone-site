import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { exploreRepository } from '@/src/client/repositories/exploreRepository';
import type { ArticlePreview } from '../models';

export function useExplore() {
  const { data, isLoading } = useQuery({
    queryKey: ['explore'],
    queryFn: async () => exploreRepository.getExplore(),
  });

  const explore = data ?? exploreRepository.getExplore();

  const [page, setPage] = useState(0);
  const [appendedItems, setAppendedItems] = useState<ArticlePreview[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const initialBatch = useMemo(
    () => explore.recentlyPublished.slice(0, 6),
    [explore.recentlyPublished],
  );

  const allFreshDiscoveries = useMemo(() => {
    const map = new Map<string, ArticlePreview>();
    initialBatch.forEach((item) => map.set(item.id, item));
    appendedItems.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }, [initialBatch, appendedItems]);

  const hasMoreFreshDiscoveries = (page + 1) * 6 < explore.recentlyPublished.length;

  const loadMoreFreshDiscoveries = useCallback(async () => {
    if (isLoadingMore || !hasMoreFreshDiscoveries) return;
    setIsLoadingMore(true);

    // Simulate async network request
    await new Promise((resolve) => setTimeout(resolve, 400));

    const nextPage = page + 1;
    const nextBatch = explore.recentlyPublished.slice(nextPage * 6, (nextPage + 1) * 6);

    if (nextBatch.length > 0) {
      setAppendedItems((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const unique = nextBatch.filter((b) => !existingIds.has(b.id));
        return [...prev, ...unique];
      });
      setPage(nextPage);
    }
    setIsLoadingMore(false);
  }, [page, isLoadingMore, hasMoreFreshDiscoveries, explore.recentlyPublished]);

  return {
    ...explore,
    freshDiscoveries: allFreshDiscoveries,
    loadMoreFreshDiscoveries,
    hasMoreFreshDiscoveries,
    isLoadingMoreFreshDiscoveries: isLoadingMore,
    loading: isLoading,
  };
}


