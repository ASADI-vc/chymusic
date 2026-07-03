'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Search, Star, Eye, EyeOff, Trash2, Check } from 'lucide-react';
import clsx from 'clsx';

interface ContentItem {
  id: string;
  kind: string;
  title: string;
  artist: string;
  album: string | null;
  source: string;
  normalized_genre: string | null;
  is_curated: boolean;
  is_featured: boolean;
  is_hidden: boolean;
  created_at: string;
}

const KINDS = ['music', 'podcast', 'madahi', 'speech'];
const SOURCES = ['musicsbaran', 'kashoob', 'extension_scrape', 'user_upload', 'admin_import', 'rss_feed'];

export default function ContentPage() {
  const [filters, setFilters] = useState<{
    q: string;
    kind: string;
    source: string;
    is_curated: string;
    is_featured: string;
  }>({ q: '', kind: '', source: '', is_curated: '', is_featured: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-content', filters],
    queryFn: async () => {
      const params: Record<string, string | boolean | number> = { limit: 100 };
      if (filters.q) params.q = filters.q;
      if (filters.kind) params.kind = filters.kind;
      if (filters.source) params.source = filters.source;
      if (filters.is_curated) params.is_curated = filters.is_curated === 'true';
      if (filters.is_featured) params.is_featured = filters.is_featured === 'true';
      const res = await api.get('/content', { params });
      return res.data as ContentItem[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ContentItem> }) =>
      api.patch(`/content/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-content'] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/content/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-content'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content</h1>
        <p className="text-chy-muted mt-1">Browse, curate, feature, and delete scraped content.</p>
      </div>

      {/* Filters */}
      <div className="bg-chy-panel border border-chy-border rounded-lg p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-2.5 text-chy-muted" />
          <input
            type="text"
            placeholder="Search title/artist…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="w-full bg-chy-bg border border-chy-border rounded pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-chy-accent"
          />
        </div>
        <select
          value={filters.kind}
          onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}
          className="bg-chy-bg border border-chy-border rounded px-3 py-2 text-sm"
        >
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          value={filters.source}
          onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
          className="bg-chy-bg border border-chy-border rounded px-3 py-2 text-sm"
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filters.is_curated}
          onChange={(e) => setFilters((f) => ({ ...f, is_curated: e.target.value }))}
          className="bg-chy-bg border border-chy-border rounded px-3 py-2 text-sm"
        >
          <option value="">Curated: any</option>
          <option value="true">Curated only</option>
          <option value="false">Not curated</option>
        </select>
        <select
          value={filters.is_featured}
          onChange={(e) => setFilters((f) => ({ ...f, is_featured: e.target.value }))}
          className="bg-chy-bg border border-chy-border rounded px-3 py-2 text-sm"
        >
          <option value="">Featured: any</option>
          <option value="true">Featured only</option>
          <option value="false">Not featured</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-chy-panel border border-chy-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left text-chy-muted">
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Artist</th>
              <th className="p-3 font-medium">Kind</th>
              <th className="p-3 font-medium">Source</th>
              <th className="p-3 font-medium">Genre</th>
              <th className="p-3 font-medium">Flags</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-chy-muted">
                  Loading…
                </td>
              </tr>
            ) : data && data.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-chy-muted">
                  No content matches your filters.
                </td>
              </tr>
            ) : (
              (data ?? []).map((c) => (
                <tr
                  key={c.id}
                  className={clsx(
                    'border-t border-chy-border/50 hover:bg-white/5',
                    selectedId === c.id && 'bg-white/5',
                  )}
                  onClick={() => setSelectedId(c.id)}
                >
                  <td className="p-3 max-w-xs truncate">{c.title}</td>
                  <td className="p-3 max-w-xs truncate">{c.artist}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-white/5">{c.kind}</span>
                  </td>
                  <td className="p-3 text-xs text-chy-muted">{c.source}</td>
                  <td className="p-3 text-xs">{c.normalized_genre || '—'}</td>
                  <td className="p-3 flex gap-1">
                    {c.is_curated && (
                      <span title="Curated" className="text-chy-accent">
                        <Check size={14} />
                      </span>
                    )}
                    {c.is_featured && (
                      <span title="Featured" className="text-chy-accent">
                        <Star size={14} />
                      </span>
                    )}
                    {c.is_hidden && (
                      <span title="Hidden" className="text-chy-danger">
                        <EyeOff size={14} />
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        title={c.is_featured ? 'Unfeature' : 'Feature on home'}
                        onClick={(e) => {
                          e.stopPropagation();
                          update.mutate({ id: c.id, patch: { is_featured: !c.is_featured } });
                        }}
                        className={clsx(
                          'p-1.5 rounded hover:bg-white/10',
                          c.is_featured ? 'text-chy-accent' : 'text-chy-muted',
                        )}
                      >
                        <Star size={14} />
                      </button>
                      <button
                        title={c.is_hidden ? 'Unhide' : 'Hide'}
                        onClick={(e) => {
                          e.stopPropagation();
                          update.mutate({ id: c.id, patch: { is_hidden: !c.is_hidden } });
                        }}
                        className={clsx(
                          'p-1.5 rounded hover:bg-white/10',
                          c.is_hidden ? 'text-chy-danger' : 'text-chy-muted',
                        )}
                      >
                        {c.is_hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${c.title}"?`)) del.mutate(c.id);
                        }}
                        className="p-1.5 rounded hover:bg-white/10 text-chy-muted hover:text-chy-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
