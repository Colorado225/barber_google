import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { getRolePermissions } from '../lib/permissions';
import {
  type SalonMembership,
  getActiveMemberships,
  persistSelectedSalonId,
  readErpSalonFromSearch,
  readStoredSalonId,
  resolveSelectedMembership,
} from '../lib/erpSalonSelection';

export type { SalonMembership };

interface SessionContext {
  user: AuthUser;
  memberships: SalonMembership[];
  onboarding: {
    currentStep: 'email_verification' | 'salon_creation' | 'setup' | 'completed';
    emailVerified: boolean;
    salonCreated: boolean;
    setupCompleted: boolean;
  } | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

export type SignUpResult = { status: 'confirmation-required' } | { status: 'authenticated' };

export interface AuthContextType {
  user: AuthUser | null;
  memberships: SessionContext['memberships'];
  activeMembership: SalonMembership | null;
  activeSalonId: string | null;
  onboarding: SessionContext['onboarding'];
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshSession: (preferredSalonId?: string) => Promise<void>;
  selectSalon: (salonId: string) => boolean;
  verifyEmail: (tokenHash: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
  createSalon: (data: { organizationName: string; salonName: string; branchName: string }) => Promise<string>;
  completeOnboarding: () => Promise<void>;
  isAuthenticated: boolean;
  hasWorkspace: boolean;
  hasPermission: (permission: string, salonId?: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function normalizeUserFromSupabase(user: User | null): AuthUser | null {
  if (!user) return null;
  const appMetadata = user.app_metadata as { name?: string };
  const userMetadata = user.user_metadata as { name?: string };
  return {
    id: user.id,
    name: userMetadata.name || appMetadata.name || user.email || '',
    email: user.email || '',
    emailVerified: Boolean(user.email_confirmed_at),
  };
}

async function loadMemberships(userId: string): Promise<SessionContext['memberships']> {
  const supabase = getSupabaseClient();
  const { data: membershipsData, error: membershipsError } = await supabase
    .from('memberships')
    .select('id, role, status, salon_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (membershipsError) throw membershipsError;

  const salonIds = (membershipsData ?? []).map((item) => item.salon_id).filter(Boolean);
  if (!salonIds.length) return [];

  const membershipIds = (membershipsData ?? []).map((membership) => membership.id);
  const [salonsResult, organizationsResult, branchesResult, branchMembershipsResult] = await Promise.all([
    supabase.from('salons').select('id, name, organization_id').in('id', salonIds),
    supabase.from('organizations').select('id, name'),
    supabase.from('branches').select('id, salon_id, name').in('salon_id', salonIds),
    supabase.from('branch_memberships').select('membership_id, branch_id').in('membership_id', membershipIds),
  ]);
  if (salonsResult.error) throw salonsResult.error;
  if (organizationsResult.error) throw organizationsResult.error;
  if (branchesResult.error) throw branchesResult.error;
  if (branchMembershipsResult.error) throw branchMembershipsResult.error;

  const organizationMap = new Map((organizationsResult.data ?? []).map((org) => [org.id, org.name]));
  const salonMap = new Map(
    (salonsResult.data ?? []).map((salon) => [
      salon.id,
      { name: salon.name, organizationId: salon.organization_id },
    ]),
  );
  const branchMap = new Map((branchesResult.data ?? []).map((branch) => [branch.id, branch]));
  const branchByMembership = new Map(
    (branchMembershipsResult.data ?? []).map((membership) => [
      membership.membership_id,
      membership.branch_id,
    ]),
  );

  return (membershipsData ?? []).map((membership) => {
    const salon = salonMap.get(membership.salon_id);
    const branchId = branchByMembership.get(membership.id) ?? null;
    const permissions = getRolePermissions(membership.role);

    return {
      id: membership.id,
      salonId: membership.salon_id,
      salonName: salon?.name ?? 'Salon',
      organizationId: salon?.organizationId ?? '',
      organizationName: salon
        ? (organizationMap.get(salon.organizationId) ?? 'Organisation')
        : 'Organisation',
      branchId,
      branchName: branchId ? (branchMap.get(branchId)?.name ?? null) : null,
      role: membership.role,
      status: membership.status,
      permissions,
    };
  });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<SessionContext['memberships']>([]);
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<SessionContext['onboarding']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userRef = useRef<AuthUser | null>(null);
  userRef.current = user;
  const membershipsRef = useRef<SessionContext['memberships']>([]);
  membershipsRef.current = memberships;
  const selectedSalonIdRef = useRef<string | null>(null);
  selectedSalonIdRef.current = selectedSalonId;

  const applySession = useCallback((context: SessionContext, preferredSalonId?: string) => {
    const nextMemberships = context.memberships ?? [];
    const urlSalonId = typeof window !== 'undefined' ? readErpSalonFromSearch(window.location.search) : null;
    const storedSalonId = readStoredSalonId(context.user.id);
    const resolved = resolveSelectedMembership(nextMemberships, {
      requestedSalonId: preferredSalonId ?? selectedSalonIdRef.current,
      urlSalonId,
      storedSalonId,
    });
    const nextSelectedSalonId = resolved?.salonId ?? null;

    setUser(context.user);
    setMemberships(nextMemberships);
    setOnboarding(context.onboarding ?? null);
    setSelectedSalonId(nextSelectedSalonId);
    if (nextSelectedSalonId) {
      persistSelectedSalonId(context.user.id, nextSelectedSalonId);
    }
  }, []);

  const clearSessionState = useCallback(() => {
    setUser(null);
    setMemberships([]);
    setOnboarding(null);
    setSelectedSalonId(null);
  }, []);

  const refreshSession = useCallback(
    async (preferredSalonId?: string) => {
      const supabase = getSupabaseClient();
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!authUser) {
        clearSessionState();
        setError(null);
        return;
      }

      const nextUser = normalizeUserFromSupabase(authUser);
      if (!nextUser) {
        clearSessionState();
        setError(null);
        return;
      }

      const nextMemberships = await loadMemberships(nextUser.id);
      const { data: onboardingData, error: onboardingError } = await supabase
        .from('onboarding_state')
        .select('current_step, email_verified, salon_created, setup_completed')
        .eq('user_id', nextUser.id)
        .maybeSingle();
      if (onboardingError) throw onboardingError;
      applySession(
        {
          user: nextUser,
          memberships: nextMemberships,
          onboarding: onboardingData
            ? {
                currentStep: onboardingData.current_step,
                emailVerified: onboardingData.email_verified,
                salonCreated: onboardingData.salon_created,
                setupCompleted: onboardingData.setup_completed,
              }
            : null,
        },
        preferredSalonId,
      );
      setError(null);
    },
    [applySession, clearSessionState],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        const {
          data: { session },
          error,
        } = await getSupabaseClient().auth.getSession();
        if (cancelled) return;
        if (error) throw error;
        if (!session) {
          clearSessionState();
          return;
        }
        await refreshSession();
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(
            bootstrapError instanceof Error
              ? bootstrapError.message
              : 'Impossible de vérifier la session. Réessayez.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSessionState, refreshSession]);

  const handle = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setError(null);
    try {
      setLoading(true);
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Service temporairement indisponible.';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = (email: string, password: string) =>
    handle(async () => {
      const { error } = await getSupabaseClient().auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (error) throw error;
      await refreshSession();
    });

  const emailRedirectTo = () => new URL('/verifier-email', window.location.origin).toString();

  const signUp = (name: string, email: string, password: string): Promise<SignUpResult> =>
    handle(async (): Promise<SignUpResult> => {
      const { data, error } = await getSupabaseClient().auth.signUp({
        email: normalizeEmail(email),
        password,
        options: {
          data: { name: name.trim().replace(/\s+/g, ' ') },
          emailRedirectTo: emailRedirectTo(),
        },
      });
      if (error) throw error;

      if (data.session) {
        await refreshSession();
        return { status: 'authenticated' };
      }

      return { status: 'confirmation-required' };
    });

  const signOut = () =>
    handle(async () => {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      clearSessionState();
    });

  const verifyEmail = useCallback(
    (tokenHash: string) =>
      handle(async () => {
        const { error } = await getSupabaseClient().auth.verifyOtp({ token_hash: tokenHash, type: 'signup' });
        if (error) throw error;
        await refreshSession();
      }),
    [handle, refreshSession],
  );

  const resendVerification = (email: string) =>
    handle(async () => {
      const { error } = await getSupabaseClient().auth.resend({
        type: 'signup',
        email: normalizeEmail(email),
        options: { emailRedirectTo: emailRedirectTo() },
      });
      if (error) throw error;
    });

  const requestPasswordReset = (email: string) =>
    handle(async () => {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(normalizeEmail(email), {
        redirectTo: new URL('/reinitialiser', window.location.origin).toString(),
      });
      if (error) throw error;
    });

  const resetPassword = (password: string) =>
    handle(async () => {
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
    });

  const createSalon = (data: { organizationName: string; salonName: string; branchName: string }) =>
    handle(async () => {
      const { data: result, error } = await getSupabaseClient().rpc('create_salon', {
        p_organization_name: data.organizationName,
        p_salon_name: data.salonName,
        p_branch_name: data.branchName,
      });
      if (error) throw error;
      const created = Array.isArray(result) ? result[0] : result;
      if (!created?.salon_id) throw new Error('La création du salon n’a pas retourné son identifiant.');

      const createdSalonId = created.salon_id as string;
      await refreshSession(createdSalonId);
      return createdSalonId;
    });

  const completeOnboarding = () =>
    handle(async () => {
      await refreshSession();
    });

  const selectSalon = useCallback((salonId: string): boolean => {
    const active = getActiveMemberships(membershipsRef.current);
    const match = active.find((membership) => membership.salonId === salonId);
    if (!match) return false;
    setSelectedSalonId(match.salonId);
    if (userRef.current?.id) {
      persistSelectedSalonId(userRef.current.id, match.salonId);
    }
    return true;
  }, []);

  const activeMemberships = useMemo(() => getActiveMemberships(memberships), [memberships]);

  const activeMembership = useMemo(
    () =>
      resolveSelectedMembership(memberships, {
        requestedSalonId: selectedSalonId,
        urlSalonId: typeof window !== 'undefined' ? readErpSalonFromSearch(window.location.search) : null,
        storedSalonId: user?.id ? readStoredSalonId(user.id) : null,
      }),
    [memberships, selectedSalonId, user?.id],
  );

  const hasPermission = useCallback(
    (permission: string, salonId?: string) => {
      const targetSalonId = salonId ?? activeMembership?.salonId;
      if (!targetSalonId) return false;
      return activeMemberships.some(
        (membership) => membership.salonId === targetSalonId && membership.permissions.includes(permission),
      );
    },
    [activeMemberships, activeMembership?.salonId],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        activeMembership,
        activeSalonId: activeMembership?.salonId ?? null,
        onboarding,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        refreshSession,
        selectSalon,
        verifyEmail,
        resendVerification,
        requestPasswordReset,
        resetPassword,
        createSalon,
        completeOnboarding,
        isAuthenticated: !!user,
        hasWorkspace: activeMemberships.length > 0,
        hasPermission,
      }}
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

export const useOptionalAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  return (
    context ?? {
      user: null,
      memberships: [],
      activeMembership: null,
      activeSalonId: null,
      onboarding: null,
      loading: false,
      error: null,
      signIn: async () => {},
      signUp: async (): Promise<SignUpResult> => ({ status: 'confirmation-required' }),
      signOut: async () => {},
      refreshSession: async () => {},
      selectSalon: () => false,
      verifyEmail: async () => {},
      resendVerification: async () => {},
      requestPasswordReset: async () => {},
      resetPassword: async () => {},
      createSalon: async () => '',
      completeOnboarding: async () => {},
      isAuthenticated: false,
      hasWorkspace: false,
      hasPermission: () => false,
    }
  );
};
