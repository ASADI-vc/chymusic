'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';
import { Download, Upload } from 'lucide-react';

export default function SettingsPage() {
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const exportCatalog = useMutation({
    mutationFn: async () => (await api.post('/catalog/export')).data,
    onSuccess: (data) => setExportMsg(`Catalog exported → ${data.export_dir}`),
    onError: () => setExportMsg('Export failed'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-chy-muted mt-1">Manage catalog export and admin preferences.</p>
      </div>

      <section className="bg-chy-panel border border-chy-border rounded-lg p-6 space-y-3">
        <h2 className="text-sm font-semibold">Catalog export</h2>
        <p className="text-sm text-chy-muted">
          Generates paginated JSON files that the standalone PWA fetches. Run this after every
          scrape or curation change.
        </p>
        <button
          onClick={() => exportCatalog.mutate()}
          disabled={exportCatalog.isPending}
          className="bg-chy-accent text-black font-semibold px-4 py-2 rounded text-sm hover:bg-chy-accent-hover disabled:opacity-50 inline-flex items-center gap-2"
        >
          {exportCatalog.isPending ? <Upload size={14} /> : <Download size={14} />}
          Export catalog now
        </button>
        {exportMsg && <p className="text-xs text-chy-muted">{exportMsg}</p>}
      </section>
    </div>
  );
}
