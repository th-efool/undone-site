import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { reportSiteFailure } from '@/src/client/feedback/site-failures';

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: () => reportSiteFailure('data') }),
    mutationCache: new MutationCache({ onError: () => reportSiteFailure('data') }),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

