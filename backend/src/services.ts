import { randomUUID } from 'node:crypto';
import type { Store } from './store/types.js';
import { slugify } from './serialize.js';

export const nowIso = () => new Date().toISOString();
export const newId = () => randomUUID();

/** Returns a slug derived from name that no other host (except selfId) is using. */
export async function uniqueSlug(store: Store, name: string, selfId?: string): Promise<string> {
  const base = slugify(name);
  for (let i = 1; i < 1000; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const existing = await store.getHostBySlug(candidate);
    if (!existing || existing.id === selfId) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export function cleanLinks<T extends Record<string, string | undefined>>(links: T): Partial<T> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(links)) if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  return out as Partial<T>;
}
