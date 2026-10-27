import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  getApiErrorMessage,
  login as apiLogin,
  me,
  register as apiRegister,
  setUnauthorizedHandler,
  tokenStorage,
  updateProfile as apiUpdateProfile,
  UpdateProfilePayload,
  UserProfile
} from './api';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rehydrate = async () => {
      try {
        const savedToken = await tokenStorage.get();
        if (!savedToken) {
          return;
        }

        setToken(savedToken);
        const profile = await me();
        setUser(profile);
      } catch {
        await tokenStorage.remove();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    rehydrate();
  }, []);

  // Any 401 on an authenticated request (expired / missing token) drops the user
  // back to the auth stack. The API layer already cleared the stored token; here
  // we clear the in-memory session so RootNavigator renders the auth stack.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    await tokenStorage.save(response.access_token);
    setToken(response.access_token);
    const profile = await me();
    setUser(profile);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await apiRegister(name, email, password);
      await tokenStorage.save(response.access_token);
      setToken(response.access_token);
      const profile = await me();
      setUser(profile);
    },
    []
  );

  const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
    const profile = await apiUpdateProfile(payload);
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    await tokenStorage.remove();
    setToken(null);
    setUser(null);
  }, []);

  // The callbacks are stable (useCallback), so the context value only changes
  // when the auth state does — satisfying exhaustive-deps and avoiding needless
  // re-renders of every consumer.
  const value = useMemo(
    () => ({ user, token, loading, login, register, updateProfile, logout }),
    [user, token, loading, login, register, updateProfile, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

export const authErrorMessage = (error: unknown) =>
  getApiErrorMessage(error, 'Authentication failed');
