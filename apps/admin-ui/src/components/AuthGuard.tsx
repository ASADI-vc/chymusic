'use client';

import { redirect, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const pathname = usePathname();

  useEffect(() => {
    if (!token && pathname !== '/login') {
      redirect('/login');
    }
  }, [token, pathname]);

  if (!token && pathname !== '/login') {
    return null;
  }

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
