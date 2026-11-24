// Typed client for host, buyer and admin endpoints.
// When API is empty the client runs in demo mode backed by localStorage.
import { API } from '@/lib/api';
import { hosts as mockHosts, hostBySlug } from '@/lib/mock';
import type { Host, SaleType } from '@/lib/types';

export const DEMO = !API;

export type AppStatus = 'pending' | 'approved' | 'rejected';
export interface Milestone { label: string; pct: number }
export interface ApplicationInput {
  type: SaleType;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  supply: number;
  minPrice: number;
  softCapBnb: number;
  hardCapBnb: number;
  start: string;
  end: string;
  revealEnd: string;
  escrowAtClosePct: number;
  milestones: Milestone[];
  summary: string;
}
export interface Application extends ApplicationInput {
  id: string;
  hostAddress: string;
  hostName?: string;
  status: AppStatus;
  reason?: string;
  /** Backend sale id once approved. */
  saleId?: string;
  createdAt: string;
}
export interface HostInput {
  name: string;
  slug: string;
  logo: string;
  banner?: string;
  bio: string;
  wallet: string;
  links: Host['links'];
  team: Host['team'];
}
export interface ProfileChange {
  id: string;
  hostAddress: string;
  field: string;
  before: string;
  after: string;
  status: AppStatus;
  createdAt: string;
}
export interface AuthHeaders { 'x-address': string; 'x-signature': string; 'x-nonce': string }
export type Signer = (message: string) => Promise<string>;

/* ---------- auth ---------- */
// The backend consumes every nonce on use (single use, replay safe), so real auth headers are good for
// exactly one request: each call signs a fresh nonce. Only demo headers are cached.
const authCache = new Map<string, AuthHeaders>();
export async function getAuth(address: string, sign: Signer): Promise<AuthHeaders> {
  const key = address.toLowerCase();
  if (DEMO) {
    const hit = authCache.get(key);
    if (hit) return hit;
    const h = { 'x-address': address, 'x-signature': 'demo', 'x-nonce': 'demo' };
    authCache.set(key, h);
    return h;
  }
  const r = await fetch(`${API}/api/auth/nonce?address=${address}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Could not get a sign in nonce');
  const { nonce, message } = (await r.json()) as { nonce: string; message: string };
  const signature = await sign(message);
  return { 'x-address': address, 'x-signature': signature, 'x-nonce': nonce };
}
export const clearAuth = () => authCache.clear();

async function req<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT', path: string, auth?: AuthHeaders, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth) Object.assign(headers, auth);
  const r = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  if (!r.ok) {
    if (r.status === 401) clearAuth();
    throw new Error((await r.text()) || `Request failed (${r.status})`);
  }
  return (await r.json()) as T;
}

/* ---------- demo store ---------- */
const LS = { apps: 'obsid.demo.applications', hosts: 'obsid.demo.hosts', changes: 'obsid.demo.changes' };
function load<T>(k: string, fb: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; }
}
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const uid = () => Math.random().toString(36).slice(2, 10);

function seedApps(): Application[] {
  return [
    {
      id: 'demo1', hostAddress: '0x8B2e5F7aC1d940E3b6A2f9c0D5e71B4a3C9f02bd', hostName: 'Kiln Protocol', status: 'pending', createdAt: new Date(Date.now() - 864e5).toISOString(),
      type: 'IDO', tokenName: 'Kiln Points', tokenSymbol: 'KPT', tokenAddress: '0x0000000000000000000000000000000000000009', supply: 3_000_000, minPrice: 0.0005,
      softCapBnb: 100, hardCapBnb: 600, start: '2026-12-10T12:00:00Z', end: '2026-12-17T12:00:00Z', revealEnd: '2026-12-18T12:00:00Z',
      escrowAtClosePct: 40, milestones: [{ label: 'Points migration', pct: 30 }, { label: 'Season two', pct: 30 }], summary: 'Points that convert into vault boosts.',
    },
  ];
}
const demoApps = () => load<Application[]>(LS.apps, seedApps());
const demoHosts = () => load<Record<string, Host>>(LS.hosts, {});
const demoChanges = () => load<ProfileChange[]>(LS.changes, [
  { id: 'c1', hostAddress: '0x1C7d3E9fA2b84D6e0F5a1B8c9D2e4F7a6B3c50ef', field: 'name', before: 'Moth Arcade', after: 'Moth Arcade Studios', status: 'pending', createdAt: new Date().toISOString() },
]);

/* ---------- hosts ---------- */
export async function getHost(slug: string): Promise<Host | undefined> {
  const local = Object.values(demoHosts()).find((h) => h.slug === slug);
  if (DEMO) return local ?? hostBySlug(slug);
  try { return await req<Host>('GET', `/api/hosts/${encodeURIComponent(slug)}`); } catch { return local ?? hostBySlug(slug); }
}
export async function getMyHost(address: string): Promise<Host | undefined> {
  const key = address.toLowerCase();
  const local = demoHosts()[key];
  if (local) return local;
  if (!DEMO) {
    try {
      const all = await req<Host[]>('GET', '/api/hosts');
      const mine = all.find((h) => h.wallet.toLowerCase() === key);
      if (mine) return mine;
    } catch {}
  }
  return mockHosts.find((h) => h.wallet.toLowerCase() === key);
}
export async function saveHost(input: HostInput, auth: AuthHeaders, prev?: Host): Promise<Host> {
  const key = auth['x-address'].toLowerCase();
  const identityChanged = !!prev && (prev.name !== input.name || prev.wallet.toLowerCase() !== input.wallet.toLowerCase());
  const next: Host = { id: prev?.id ?? `local_${key.slice(2, 8)}`, verified: identityChanged ? false : prev?.verified ?? false, ...input };
  if (!DEMO) return req<Host>('POST', '/api/hosts', auth, input);
  const all = demoHosts(); all[key] = next; save(LS.hosts, all);
  if (identityChanged && prev) {
    const ch = demoChanges();
    if (prev.name !== input.name) ch.unshift({ id: uid(), hostAddress: auth['x-address'], field: 'name', before: prev.name, after: input.name, status: 'pending', createdAt: new Date().toISOString() });
    if (prev.wallet.toLowerCase() !== input.wallet.toLowerCase()) ch.unshift({ id: uid(), hostAddress: auth['x-address'], field: 'wallet', before: prev.wallet, after: input.wallet, status: 'pending', createdAt: new Date().toISOString() });
    save(LS.changes, ch);
  }
  return next;
}

/* ---------- applications ---------- */
export async function submitApplication(input: ApplicationInput, auth: AuthHeaders, hostName?: string): Promise<Application> {
  if (!DEMO) return req<Application>('POST', '/api/applications', auth, input);
  const app: Application = { ...input, id: uid(), hostAddress: auth['x-address'], hostName, status: 'pending', createdAt: new Date().toISOString() };
  save(LS.apps, [app, ...demoApps()]);
  return app;
}
export async function myApplications(auth: AuthHeaders): Promise<Application[]> {
  if (!DEMO) return req<Application[]>('GET', '/api/applications/mine', auth);
  const me = auth['x-address'].toLowerCase();
  return demoApps().filter((a) => a.hostAddress.toLowerCase() === me);
}

/* ---------- admin ---------- */
type BackendApplication = Omit<Application, 'hostAddress' | 'hostName' | 'reason'> & { rejectReason?: string; host?: { wallet: string; name: string } | null };
export async function adminApplications(auth: AuthHeaders): Promise<Application[]> {
  if (!DEMO) {
    const rows = await req<BackendApplication[]>('GET', '/api/admin/applications', auth);
    return rows.map(({ host, rejectReason, ...a }) => ({ ...a, hostAddress: host?.wallet ?? '', hostName: host?.name, reason: rejectReason }));
  }
  return demoApps();
}
/** Approves in the backend; returns the backend sale id (used to attach the onchain contract address). */
export async function approveApplication(id: string, auth: AuthHeaders): Promise<string | undefined> {
  if (!DEMO) { const r = await req<{ sale?: { id: string } }>('POST', `/api/admin/applications/${id}/approve`, auth, {}); return r.sale?.id; }
  save(LS.apps, demoApps().map((a) => (a.id === id ? { ...a, status: 'approved' as const, saleId: `demo_${id}` } : a)));
  return `demo_${id}`;
}
/** PATCH /api/admin/sales/:id (contractAddress, status, aggregates, milestonesReleased). */
export async function adminPatchSale(id: string, patch: Record<string, unknown>, auth: AuthHeaders): Promise<void> {
  if (DEMO) return;
  await req('PATCH', `/api/admin/sales/${encodeURIComponent(id)}`, auth, patch);
}
/** PUT /api/admin/config: save the contract address registry. */
export async function adminSaveConfig(contracts: Record<string, string>, auth: AuthHeaders, merge = false): Promise<void> {
  if (DEMO) throw new Error('No backend configured (NEXT_PUBLIC_API_URL is unset), so addresses cannot be saved.');
  await req('PUT', '/api/admin/config', auth, { contracts, ...(merge ? { merge: true } : {}) });
}
export async function rejectApplication(id: string, reason: string, auth: AuthHeaders): Promise<void> {
  if (!DEMO) { await req('POST', `/api/admin/applications/${id}/reject`, auth, { reason }); return; }
  save(LS.apps, demoApps().map((a) => (a.id === id ? { ...a, status: 'rejected' as const, reason } : a)));
}
type BackendChange = { id: string; status: AppStatus; createdAt: string; changes: { name?: string; wallet?: string }; previous: { name: string; wallet: string }; host?: { wallet: string } | null };
export async function adminProfileChanges(auth: AuthHeaders): Promise<ProfileChange[]> {
  if (!DEMO) {
    const rows = await req<BackendChange[]>('GET', '/api/admin/profile-changes', auth);
    // One backend change can touch name and wallet; the approve/reject action applies to the whole change.
    return rows.flatMap((c) => (['name', 'wallet'] as const)
      .filter((f) => c.changes?.[f] !== undefined)
      .map((f) => ({ id: c.id, hostAddress: c.host?.wallet ?? c.previous?.wallet ?? '', field: f, before: c.previous?.[f] ?? '', after: c.changes[f] ?? '', status: c.status, createdAt: c.createdAt })));
  }
  return demoChanges();
}
export async function decideProfileChange(id: string, decision: 'approve' | 'reject', auth: AuthHeaders): Promise<void> {
  if (!DEMO) { await req('POST', `/api/admin/profile-changes/${id}/${decision}`, auth, {}); return; }
  save(LS.changes, demoChanges().map((c) => (c.id === id ? { ...c, status: decision === 'approve' ? ('approved' as const) : ('rejected' as const) } : c)));
}
