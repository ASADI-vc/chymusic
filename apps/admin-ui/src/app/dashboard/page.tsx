'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatsCards } from '@/components/StatsCards';
import { RecentScrapeJobs } from '@/components/RecentScrapeJobs';
import { GenreChart } from '@/components/GenreChart';

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['content-stats'],
    queryFn: async () => (await api.get('/content/stats')).data,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-chy-muted mt-1">Overview of the CHYMUSIC catalog.</p>
      </div>

      {isLoading ? (
        <div className="text-chy-muted">Loading stats…</div>
      ) : stats ? (
        <StatsCards stats={stats} />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GenreChart />
        <RecentScrapeJobs />
      </div>
    </div>
  );
}
