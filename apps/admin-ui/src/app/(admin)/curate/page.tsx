'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Star } from 'lucide-react';
import clsx from 'clsx';

interface ContentItem {
  id: string;
  title: string;
  artist: string;
  cover_image_url: string | null;
  kind: string;
  is_featured: boolean;
}

export default function CuratePage() {
  const qc = useQueryClient();

  const { data: featured } = useQuery({
    queryKey: ['curate-featured'],
    queryFn: async () =>
      (await api.get('/content', { params: { is_featured: true, limit: 24 } })).data as ContentItem[],
  });

  const { data: candidates } = useQuery({
    queryKey: ['curate-candidates'],
    queryFn: async () =>
      (await api.get('/content', { params: { is_featured: false, limit: 48 } })).data as ContentItem[],
  });

  const update = useMutation({
    mutationFn: async ({ id, is_featured }: { id: string; is_featured: boolean }) =>
      api.patch(`/content/${id}`, { is_featured }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['curate-featured'] });
      qc.invalidateQueries({ queryKey: ['curate-candidates'] });
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Home Screen Curation</h1>
        <p className="text-chy-muted mt-1">
          Choose what users see first when they open the standalone app. The home screen renders
          featured items as the top row.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-3">Currently featured ({featured?.length ?? 0})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {(featured ?? []).map((c) => (
            <div
              key={c.id}
              className="bg-chy-panel border border-chy-border rounded-lg p-3 cursor-pointer hover:border-chy-accent"
              onClick={() => update.mutate({ id: c.id, is_featured: false })}
              title="Click to unfeature"
            >
              <div className="aspect-square rounded bg-chy-bg mb-2 overflow-hidden">
                {c.cover_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover_image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="text-xs font-medium truncate">{c.title}</div>
              <div className="text-xs text-chy-muted truncate">{c.artist}</div>
              <div className="mt-2 text-chy-accent text-xs flex items-center gap-1">
                <Star size={12} fill="currentColor" /> Featured
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3">Candidates (click to feature)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {(candidates ?? []).map((c) => (
            <div
              key={c.id}
              className="bg-chy-panel border border-chy-border rounded-lg p-3 cursor-pointer hover:border-chy-accent opacity-70 hover:opacity-100"
              onClick={() => update.mutate({ id: c.id, is_featured: true })}
              title="Click to feature"
            >
              <div className="aspect-square rounded bg-chy-bg mb-2 overflow-hidden">
                {c.cover_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover_image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="text-xs font-medium truncate">{c.title}</div>
              <div className="text-xs text-chy-muted truncate">{c.artist}</div>
              <div className={clsx('mt-2 text-xs text-chy-muted')}>Not featured</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
