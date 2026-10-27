import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

// Shared React Query client for all server state. Defaults tuned for a mobile
// app: a short stale window so data refreshes when a screen is revisited, a
// single retry, and no refetch-on-window-focus (React Native has no window;
// screens opt into refetch-on-focus explicitly). gcTime is 24h so cached
// queries survive long enough to be persisted (it must be >= the persister
// maxAge below).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

// Persists the query cache to AsyncStorage so a cold start — including an offline
// launch — can hydrate the last-seen data instead of showing empty screens, then
// refetch in the background. Only server data is cached here; the auth token
// lives in SecureStore (AuthContext), never in the query cache.
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'ironlog-react-query-cache'
});
