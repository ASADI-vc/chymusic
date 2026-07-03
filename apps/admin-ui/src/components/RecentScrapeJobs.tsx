'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function RecentScrapeJobs() {
  const { data } = useQuery({
    queryKey: ['scrape-jobs'],
    queryFn: async () => (await api.get('/scrape')).data,
    refetchInterval: 5000,
  });

  const jobs = (data ?? []) as Array<{
    id: string;
    scraper: string;
    status: string;
    items_total: number;
    items_success: number;
    items_failed: number;
    started_at: string | null;
    created_at: string;
  }>;

  return (
    <div className="bg-chy-panel border border-chy-border rounded-lg p-4">
      <h2 className="text-sm font-semibold mb-4">Recent scrape jobs</h2>
      {jobs.length === 0 ? (
        <p className="text-chy-muted text-sm">No jobs yet — trigger one from the Scrapers page.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-chy-muted border-b border-chy-border">
              <th className="py-2">Scraper</th>
              <th className="py-2">Status</th>
              <th className="py-2">Items</th>
              <th className="py-2">Started</th>
            </tr>
          </thead>
          <tbody>
            {jobs.slice(0, 8).map((j) => (
              <tr key={j.id} className="border-b border-chy-border/50">
                <td className="py-2">{j.scraper}</td>
                <td className="py-2">
                  <span
                    className={
                      'px-2 py-0.5 rounded text-xs ' +
                      (j.status === 'completed'
                        ? 'bg-chy-accent/20 text-chy-accent'
                        : j.status === 'failed'
                          ? 'bg-chy-danger/20 text-chy-danger'
                          : 'bg-white/5 text-chy-muted')
                    }
                  >
                    {j.status}
                  </span>
                </td>
                <td className="py-2">
                  {j.items_success}/{j.items_total}
                  {j.items_failed > 0 && (
                    <span className="text-chy-danger text-xs"> · {j.items_failed} failed</span>
                  )}
                </td>
                <td className="py-2 text-chy-muted text-xs">
                  {j.started_at ? new Date(j.started_at).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
