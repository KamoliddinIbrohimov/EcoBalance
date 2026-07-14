import type { Role } from '@eco/shared';
import { create } from 'zustand';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  locale: string;
  roles: Role[];
  permissions: string[];
  organization: { id: string; nameUz: string; type: string; code: string } | null;
}

interface AuthState {
  accessToken: string | null;
  expiresAt: number | null;
  user: AuthUser | null;
  hydrated: boolean;

  setAccessToken: (token: string, expiresIn: number) => void;
  setUser: (user: AuthUser | null) => void;
  hydrate: () => void;
  clear: () => void;

  hasRole: (role: Role) => boolean;
  hasPermission: (perm: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  expiresAt: null,
  user: null,
  hydrated: false,

  setAccessToken: (token, expiresIn) =>
    set({ accessToken: token, expiresAt: Date.now() + expiresIn * 1000 }),

  setUser: (user) => set({ user }),

  hydrate: () => set({ hydrated: true }),

  clear: () => set({ accessToken: null, expiresAt: null, user: null }),

  hasRole: (role) => get().user?.roles.includes(role) ?? false,
  hasPermission: (perm) => get().user?.permissions.includes(perm) ?? false,
}));
