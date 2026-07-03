'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Music, Download, Star, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import clsx from 'clsx';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/content', label: 'Content', icon: Music },
  { href: '/scrape', label: 'Scrapers', icon: Download },
  { href: '/curate', label: 'Home Curation', icon: Star },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="w-60 shrink-0 border-r border-chy-border bg-chy-panel flex flex-col">
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-chy-accent text-black font-extrabold text-xs flex items-center justify-center">
          CHY
        </div>
        <strong className="text-sm tracking-wide">CHYMUSIC</strong>
      </div>
      <nav className="flex-1 px-2 flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-white/5 text-chy-fg'
                : 'text-chy-muted hover:text-chy-fg hover:bg-white/5',
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-chy-border">
        <div className="text-xs text-chy-muted mb-2">Signed in as {username}</div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs text-chy-muted hover:text-chy-danger"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
