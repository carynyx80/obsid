// Backend client. Falls back to mock data when NEXT_PUBLIC_API_URL is unset or unreachable.
import { hosts, sales } from './mock';
import type { Host, Sale } from './types';
export const API = process.env.NEXT_PUBLIC_API_URL || '';
async function get<T>(path: string, fallback: T): Promise<T> {
  if (!API) return fallback;
  try { const r = await fetch(`${API}${path}`, { cache: 'no-store' }); if (!r.ok) throw 0; return (await r.json()) as T; } catch { return fallback; }
}
export const fetchSales = () => get<Sale[]>('/api/sales', sales);
export const fetchHosts = () => get<Host[]>('/api/hosts', hosts);
export async function post<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text()); return r.json();
}
