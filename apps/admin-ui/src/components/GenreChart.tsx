'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function GenreChart() {
  const { data } = useQuery({
    queryKey: ['content-genre-distribution'],
    queryFn: async () => {
      // Fetch a sample to compute genre distribution client-side.
      const res = await api.get('/content', { params: { limit: 500 } });
      const items = res.data as Array<{ normalized_genre?: string; kind: string }>;
      const counts: Record<string, number> = {};
      for (const it of items) {
        const g = it.normalized_genre || it.kind || 'unknown';
        counts[g] = (counts[g] || 0) + 1;
      }
      return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
  });

  return (
    <div className="bg-chy-panel border border-chy-border rounded-lg p-4">
      <h2 className="text-sm font-semibold mb-4">Top genres (sample of 500)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data ?? []}>
          <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#9198a1" fontSize={11} angle={-30} textAnchor="end" height={60} />
          <YAxis stroke="#9198a1" fontSize={11} />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}
          />
          <Bar dataKey="value" fill="#1db954" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
