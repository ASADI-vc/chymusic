/**
 * Permission store — tracks per-host whether the user has granted scrape permission.
 * Permission persists across sessions (with a 30-day expiry) in chrome.storage.local.
 */
import { SCRAPE_PERMISSION_TTL_MS } from '@chymusic/shared';

const STORAGE_KEY = 'chymusic:scrape-permissions';

interface PermissionRecord {
  host: string;
  grantedAt: string;
  expiresAt: string;
}

async function readAll(): Promise<PermissionRecord[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as PermissionRecord[] | undefined) ?? [];
}

async function writeAll(records: PermissionRecord[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: records });
}

function normalizeHost(host: string): string {
  return host.replace(/^www\./, '').toLowerCase();
}

export async function hasPermission(host: string): Promise<boolean> {
  const records = await readAll();
  const h = normalizeHost(host);
  const now = new Date();
  const rec = records.find((r) => r.host === h);
  if (!rec) return false;
  return new Date(rec.expiresAt) > now;
}

export async function grantPermission(host: string): Promise<void> {
  const records = await readAll();
  const h = normalizeHost(host);
  const now = new Date();
  const expires = new Date(now.getTime() + SCRAPE_PERMISSION_TTL_MS);
  const filtered = records.filter((r) => r.host !== h);
  filtered.push({ host: h, grantedAt: now.toISOString(), expiresAt: expires.toISOString() });
  await writeAll(filtered);
}

export async function revokePermission(host: string): Promise<void> {
  const records = await readAll();
  const h = normalizeHost(host);
  await writeAll(records.filter((r) => r.host !== h));
}
