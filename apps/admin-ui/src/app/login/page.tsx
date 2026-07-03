'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      setAuth(res.data.access_token, res.data.username, res.data.is_superadmin);
      router.push('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-chy-bg">
      <form
        onSubmit={handleSubmit}
        className="bg-chy-panel border border-chy-border rounded-lg p-8 w-80 space-y-4"
      >
        <div className="text-center">
          <div className="inline-flex w-12 h-12 rounded-lg bg-chy-accent text-black font-extrabold items-center justify-center mb-3">
            CHY
          </div>
          <h1 className="text-xl font-bold">CHYMUSIC Admin</h1>
          <p className="text-xs text-chy-muted mt-1">Sign in to manage the catalog</p>
        </div>
        <div>
          <label className="block text-xs text-chy-muted mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-chy-bg border border-chy-border rounded px-3 py-2 text-sm focus:outline-none focus:border-chy-accent"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-chy-muted mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-chy-bg border border-chy-border rounded px-3 py-2 text-sm focus:outline-none focus:border-chy-accent"
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-chy-danger text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-chy-accent text-black font-semibold py-2 rounded text-sm hover:bg-chy-accent-hover disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
