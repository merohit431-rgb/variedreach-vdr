'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';

// On first load, the access token only lives in memory — this silently
// exchanges the httpOnly refresh cookie (if any) for a fresh one so a page
// reload doesn't look logged-out.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, setInitializing, clearAuth } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const refreshResponse = await apiClient.post('/auth/refresh');
        const accessToken = refreshResponse.data.data.accessToken as string;
        const meResponse = await apiClient.get('/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (isMounted) {
          setAuth(meResponse.data.data, accessToken);
        }
      } catch {
        if (isMounted) {
          clearAuth();
        }
      } finally {
        if (isMounted) {
          setInitializing(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
