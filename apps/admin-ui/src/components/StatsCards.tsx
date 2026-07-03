'use client';

import clsx from 'clsx';

interface Stats {
  total: number;
  by_kind: Record<string, number>;
  by_source: Record<string, number>;
  featured: number;
  curated: number;
  hidden: number;
}

const LABELS: Record<string, string> = {
  total: 'Total items',
  featured: 'Featured on home',
  curated: 'Curated',
  hidden: 'Hidden',
};

export function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    { label: 'Total items', value: stats.total, accent: 'text-chy-accent' },
    { label: 'Featured on home', value: stats.featured, accent: 'text-chy-accent' },
    { label: 'Curated', value: stats.curated, accent: 'text-chy-fg' },
    { label: 'Hidden', value: stats.hidden, accent: 'text-chy-danger' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-chy-panel border border-chy-border rounded-lg p-4">
          <div className="text-xs text-chy-muted uppercase tracking-wider">{c.label}</div>
          <div className={clsx('text-3xl font-bold mt-2', c.accent)}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
