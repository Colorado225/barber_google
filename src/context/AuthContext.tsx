import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, ApiError } from '../lib/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // La session vit dans un cookie HttpOnly : on la valide au chargement.
  useEffect(() => {
    let cancelled = false;
    authApi
      .session()
      .then((data) => {
        if (!cancelled) setUser(data?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handle = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : 'Service temporairement indisponible.';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = (email: string, password: string) =>
    handle(async () => {
      const data = await authApi.login(email, password);
      setUser(data.user);
    });

  const signUp = (name: string, email: string, password: string) =>
    handle(async () => {
      // L'inscription ne connecte pas automatiquement : on enchaîne sur la connexion
      // uniquement après création réussie du compte.
      await authApi.signup(name, email, password);
      const data = await authApi.login(email, password);
      setUser(data.user);
    });

  const signOut = () =>
    handle(async () => {
      await authApi.logout();
      setUser(null);
    });

  return (
    <AuthContext.Provider
      value={{ user, loading, error, signIn, signUp, signOut, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
