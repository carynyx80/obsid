import type { ApplicationRecord, ContractRegistry, HostRecord, NonceRecord, ProfileChangeRecord, SaleRecord } from '../types.js';
import { ConflictError, type Store } from './types.js';

const clone = <T>(v: T): T => structuredClone(v);
const byCreated = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);

/** In-memory store for local dev and tests. Same semantics as the Postgres store. */
export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private nonces = new Map<string, NonceRecord>();
  private hosts = new Map<string, HostRecord>();
  private applications = new Map<string, ApplicationRecord>();
  private sales = new Map<string, SaleRecord>();
  private changes = new Map<string, ProfileChangeRecord>();
  private contracts: ContractRegistry = {};

  async init() {}
  async close() {}

  async createNonce(n: NonceRecord) {
    this.nonces.set(n.nonce, { ...n, address: n.address.toLowerCase() });
  }
  async consumeNonce(address: string, nonce: string) {
    const n = this.nonces.get(nonce);
    if (!n || n.address !== address.toLowerCase()) return false;
    this.nonces.delete(nonce);
    return n.expiresAt.getTime() > Date.now();
  }
  async purgeExpiredNonces() {
    const now = Date.now();
    for (const [k, n] of this.nonces) if (n.expiresAt.getTime() <= now) this.nonces.delete(k);
  }

  async listHosts() {
    return [...this.hosts.values()].sort(byCreated).map(clone);
  }
  async getHostById(id: string) {
    const h = this.hosts.get(id);
    return h ? clone(h) : null;
  }
  async getHostBySlug(slug: string) {
    for (const h of this.hosts.values()) if (h.slug === slug) return clone(h);
    return null;
  }
  async getHostByWallet(wallet: string) {
    const w = wallet.toLowerCase();
    for (const h of this.hosts.values()) if (h.wallet.toLowerCase() === w) return clone(h);
    return null;
  }
  private assertHostUnique(h: HostRecord) {
    for (const o of this.hosts.values()) {
      if (o.id === h.id) continue;
      if (o.slug === h.slug) throw new ConflictError('slug already taken');
      if (o.wallet.toLowerCase() === h.wallet.toLowerCase()) throw new ConflictError('wallet already has a host profile');
    }
  }
  async insertHost(h: HostRecord) {
    if (this.hosts.has(h.id)) throw new ConflictError('host exists');
    this.assertHostUnique(h);
    this.hosts.set(h.id, clone(h));
  }
  async updateHost(h: HostRecord) {
    this.assertHostUnique(h);
    this.hosts.set(h.id, clone(h));
  }

  async insertApplication(a: ApplicationRecord) {
    this.applications.set(a.id, clone(a));
  }
  async getApplication(id: string) {
    const a = this.applications.get(id);
    return a ? clone(a) : null;
  }
  async listApplications(f: { status?: string; hostId?: string } = {}) {
    return [...this.applications.values()]
      .filter((a) => (!f.status || a.status === f.status) && (!f.hostId || a.hostId === f.hostId))
      .sort(byCreated)
      .map(clone);
  }
  async updateApplication(a: ApplicationRecord) {
    this.applications.set(a.id, clone(a));
  }

  async insertSale(s: SaleRecord) {
    this.sales.set(s.id, clone(s));
  }
  async getSale(id: string) {
    const s = this.sales.get(id);
    return s ? clone(s) : null;
  }
  async listSales(f: { type?: string; hostId?: string } = {}) {
    return [...this.sales.values()]
      .filter((s) => (!f.type || s.type === f.type) && (!f.hostId || s.hostId === f.hostId))
      .sort(byCreated)
      .map(clone);
  }
  async updateSale(s: SaleRecord) {
    this.sales.set(s.id, clone(s));
  }

  async insertProfileChange(p: ProfileChangeRecord) {
    this.changes.set(p.id, clone(p));
  }
  async getProfileChange(id: string) {
    const p = this.changes.get(id);
    return p ? clone(p) : null;
  }
  async listProfileChanges(f: { status?: string; hostId?: string } = {}) {
    return [...this.changes.values()]
      .filter((p) => (!f.status || p.status === f.status) && (!f.hostId || p.hostId === f.hostId))
      .sort(byCreated)
      .map(clone);
  }
  async updateProfileChange(p: ProfileChangeRecord) {
    this.changes.set(p.id, clone(p));
  }

  async getContracts() {
    return clone(this.contracts);
  }
  async setContracts(c: ContractRegistry) {
    this.contracts = clone(c);
  }
}
