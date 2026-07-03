'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Play, RefreshCw } from 'lucide-react';

export default function ScrapePage() {
  const [scraper, setScraper] = useState('musicsbaran');
  const [targetUrl, setTargetUrl] = useState('');
  const [maxItems, setMaxItems] = useState(50);
  const [clean, setClean] = useState(true);
  const [classify, setClassify] = useState(true);
  const qc = useQueryClient();

  const { data: jobs } = useQuery({
    queryKey: ['scrape-jobs'],
    queryFn: async () => (await api.get('/scrape')).data,
    refetchInterval: 3000,
  });

  const trigger = useMutation({
    mutationFn: async () =>
      api.post('/scrape', {
        scraper,
        target_url: targetUrl || null,
        max_items: maxItems,
        clean,
        classify,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scrape-jobs'] });
      setTargetUrl('');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scrapers</h1>
        <p className="text-chy-muted mt-1">Trigger and monitor scraper jobs.</p>
      </div>

      <div className="bg-chy-panel border border-chy-border rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold">New job</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-chy-muted">Scraper</span>
            <select
              value={scraper}
              onChange={(e) => setScraper(e.target.value)}
              className="mt-1 w-full bg-chy-bg border border-chy-border rounded px-3 py-2 text-sm"
            >
              <option value="musicsbaran">musicsbaran — Persian music</option>
              <option value="kashoob">kashoob — Madahi / Noheh</option>
              <option value="rss_feed">RSS feed — Podcasts</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-chy-muted">Target URL (optional — leave empty for full crawl)</span>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://musicsbaran.ir/some-album"
              className="mt-1 w-full bg-chy-bg border border-chy-border rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-chy-muted">Max items</span>
            <input
              type="number"
              min={1}
              max={500}
              value={maxItems}
              onChange={(e) => setMaxItems(parseInt(e.target.value || '50', 10))}
              className="mt-1 w-full bg-chy-bg border border-chy-border rounded px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} />
              Clean data
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={classify}
                onChange={(e) => setClassify(e.target.checked)}
              />
              Classify genre
            </label>
          </div>
        </div>
        <button
          onClick={() => trigger.mutate()}
          disabled={trigger.isPending}
          className="bg-chy-accent text-black font-semibold px-4 py-2 rounded text-sm hover:bg-chy-accent-hover disabled:opacity-50 inline-flex items-center gap-2"
        >
          {trigger.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          Start scrape
        </button>
        {trigger.isError && (
          <p className="text-chy-danger text-xs">
            Trigger failed: {(trigger.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'unknown error'}
          </p>
        )}
      </div>

      <div className="bg-chy-panel border border-chy-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Jobs</h2>
        {(jobs ?? []).length === 0 ? (
          <p className="text-chy-muted text-sm">No jobs yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-chy-muted border-b border-chy-border">
                <th className="py-2">Scraper</th>
                <th className="py-2">Status</th>
                <th className="py-2">Progress</th>
                <th className="py-2">Started</th>
                <th className="py-2">Finished</th>
              </tr>
            </thead>
            <tbody>
              {(jobs ?? []).map((j: any) => (
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
                            : j.status === 'running'
                              ? 'bg-chy-warn/20 text-chy-warn'
                              : 'bg-white/5 text-chy-muted')
                      }
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="py-2 text-xs">
                    {j.items_success}/{j.items_total}
                    {j.items_failed > 0 && (
                      <span className="text-chy-danger"> · {j.items_failed} failed</span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-chy-muted">
                    {j.started_at ? new Date(j.started_at).toLocaleString() : '—'}
                  </td>
                  <td className="py-2 text-xs text-chy-muted">
                    {j.finished_at ? new Date(j.finished_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
