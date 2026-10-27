import { QueryClient } from '@tanstack/react-query';

// Shared React Query client for all server state. Defaults tuned for a mobile
// app: a short stale window so data refreshes when a screen is revisited, a
// single retry (the API is normally reachable or clearly down), and no
// refetch-on-window-focus (React Native has no window; screens that want
// refetch-on-focus opt in explicitly).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});
