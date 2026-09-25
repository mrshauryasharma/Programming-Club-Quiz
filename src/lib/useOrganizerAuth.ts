'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function useOrganizerAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const res = await fetch('/api/organizer/auth');
        const data = await res.json();
        if (!res.ok || !data.authenticated) {
          if (isMounted) {
            setIsAuthenticated(false);
            const fromParam = encodeURIComponent(pathname || '/organizer/dashboard');
            router.replace(`/organizer/login?from=${fromParam}`);
          }
          return;
        }

        if (isMounted) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthenticated(false);
          const fromParam = encodeURIComponent(pathname || '/organizer/dashboard');
          router.replace(`/organizer/login?from=${fromParam}`);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router, pathname]);

  return { isAuthenticated };
}
