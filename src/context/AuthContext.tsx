import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as db from '../lib/db';
import type { User } from '../lib/db';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: 'admin' | 'manager-or-admin') => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Thu refresh session tu cookie (nguoi dung da login truoc do, F5 lai trang)
    (async () => {
      try {
        await db.refreshSession();
        const me = await db.fetchMe();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loggedInUser = await db.login(email, password);
    setUser(loggedInUser);
    queryClient.removeQueries({ queryKey: ['auth'] });
  }, [queryClient]);

  const logout = useCallback(async () => {
    await db.logout();
    setUser(null);
    queryClient.removeQueries({ queryKey: ['auth'] });
  }, [queryClient]);

  const can = useCallback(
    (permission: 'admin' | 'manager-or-admin') => {
      if (!user) return false;
      if (permission === 'admin') return user.role === 'admin';
      return user.role === 'admin' || user.role === 'manager';
    },
    [user],
  );

  const value = useMemo(() => ({ user, isLoading, login, logout, can }), [user, isLoading, login, logout, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
