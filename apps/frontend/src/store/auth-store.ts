import { create } from 'zustand';
import type { UserRole } from '@variedreach-vdr/shared';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organisationId: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isInitializing: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
  setInitializing: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isInitializing: true,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
  setInitializing: (value) => set({ isInitializing: value }),
}));
