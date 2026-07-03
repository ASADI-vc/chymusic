'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  username: string | null;
  isSuperadmin: boolean;
  setAuth: (token: string, username: string, isSuperadmin: boolean) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      username: null,
      isSuperadmin: false,
      setAuth: (token, username, isSuperadmin) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('chymusic:admin-token', token);
        }
        set({ token, username, isSuperadmin });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('chymusic:admin-token');
        }
        set({ token: null, username: null, isSuperadmin: false });
      },
      isAuthenticated: () => get().token !== null,
    }),
    { name: 'chymusic:auth' },
  ),
);
