import { exploreMock } from '@/src/client/components/screens/dashboard/explore/mock/explore.mock';
import type { ExploreModel } from '@/src/client/components/screens/dashboard/explore/models';

export const exploreRepository = {
  getExplore(): ExploreModel {
    return structuredClone(exploreMock);
  },
};
