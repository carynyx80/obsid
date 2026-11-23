import type {
  ApplicationRecord,
  HostRecord,
  NonceRecord,
  ProfileChangeRecord,
  ReviewStatus,
  SaleRecord,
  SaleType,
} from '../types.js';

/** Storage interface implemented by both the in-memory and Postgres stores. */
export interface Store {
  readonly kind: 'memory' | 'postgres';
  init(): Promise<void>;
  close(): Promise<void>;

  createNonce(n: NonceRecord): Promise<void>;
  /** Atomically deletes the nonce if it belongs to address and is unexpired. Returns true if it was consumed. */
  consumeNonce(address: string, nonce: string): Promise<boolean>;
  purgeExpiredNonces(): Promise<void>;

  listHosts(): Promise<HostRecord[]>;
  getHostById(id: string): Promise<HostRecord | null>;
  getHostBySlug(slug: string): Promise<HostRecord | null>;
  getHostByWallet(wallet: string): Promise<HostRecord | null>;
  insertHost(h: HostRecord): Promise<void>;
  updateHost(h: HostRecord): Promise<void>;

  insertApplication(a: ApplicationRecord): Promise<void>;
  getApplication(id: string): Promise<ApplicationRecord | null>;
  listApplications(f?: { status?: ReviewStatus; hostId?: string }): Promise<ApplicationRecord[]>;
  updateApplication(a: ApplicationRecord): Promise<void>;

  insertSale(s: SaleRecord): Promise<void>;
  getSale(id: string): Promise<SaleRecord | null>;
  listSales(f?: { type?: SaleType; hostId?: string }): Promise<SaleRecord[]>;
  updateSale(s: SaleRecord): Promise<void>;

  insertProfileChange(p: ProfileChangeRecord): Promise<void>;
  getProfileChange(id: string): Promise<ProfileChangeRecord | null>;
  listProfileChanges(f?: { status?: ReviewStatus; hostId?: string }): Promise<ProfileChangeRecord[]>;
  updateProfileChange(p: ProfileChangeRecord): Promise<void>;
}

export class ConflictError extends Error {
  constructor(message = 'conflict') {
    super(message);
  }
}
