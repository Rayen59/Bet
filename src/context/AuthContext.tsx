import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch, registerTokenGetter } from '../lib/api';
import { UserProfile, UserStats } from '../types/sportzone';

interface AuthContextValue {
  user: UserProfile | null;
  stats: UserStats | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (username: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateLocalBalance: (newBalance: number) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Store tokens strictly in memory (never in localStorage)
  const localTokenRef = useRef<string | null>(null);
  const firebaseUserRef = useRef<FirebaseUser | null>(null);

  useEffect(() => {
    registerTokenGetter(async () => {
      if (localTokenRef.current) return localTokenRef.current;
      if (firebaseUserRef.current) {
        return await firebaseUserRef.current.getIdToken();
      }
      return null;
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!localTokenRef.current && !firebaseUserRef.current) {
      setUser(null);
      setStats(null);
      return;
    }
    try {
      const data = await apiFetch<{ user: UserProfile; stats: UserStats }>('/api/auth/me');
      setUser(data.user);
      setStats(data.stats);
    } catch {
      setUser(null);
      setStats(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      firebaseUserRef.current = fbUser;
      if (fbUser) {
        localTokenRef.current = null;
        await refreshProfile();
      } else if (!localTokenRef.current) {
        setUser(null);
        setStats(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [refreshProfile]);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localTokenRef.current = res.token;
      firebaseUserRef.current = null;
      setUser(res.user);
      await refreshProfile();
    },
    [refreshProfile]
  );

  const registerWithEmail = useCallback(
    async (username: string, email: string, password: string) => {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      localTokenRef.current = res.token;
      firebaseUserRef.current = null;
      setUser(res.user);
      await refreshProfile();
    },
    [refreshProfile]
  );

  const loginWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    firebaseUserRef.current = cred.user;
    localTokenRef.current = null;
    await apiFetch('/api/auth/firebase', { method: 'POST' });
    await refreshProfile();
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    localTokenRef.current = null;
    firebaseUserRef.current = null;
    try {
      await signOut(auth);
    } catch {
      // Ignore if not signed into Firebase
    }
    setUser(null);
    setStats(null);
  }, []);

  const updateLocalBalance = useCallback((newBalance: number) => {
    setUser((prev) => (prev ? { ...prev, virtualBalance: newBalance } : prev));
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream');
      es.addEventListener('balance_updated', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data || '{}') as {
            userId?: number;
            newBalance?: number;
            reason?: string;
          };
          if (payload.userId === user.id) {
            if (typeof payload.newBalance === 'number') {
              setUser((prev) => (prev ? { ...prev, virtualBalance: payload.newBalance! } : prev));
            }
            refreshProfile();
            window.dispatchEvent(new CustomEvent('sportzone:balance_updated', { detail: payload }));
          }
        } catch {
          // Ignore malformed SSE payload
        }
      });
    } catch {
      // EventSource not available
    }

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshProfile();
      }
    }, 6_000);

    return () => {
      es?.close();
      clearInterval(poll);
    };
  }, [user?.id, refreshProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        stats,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        refreshProfile,
        updateLocalBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
