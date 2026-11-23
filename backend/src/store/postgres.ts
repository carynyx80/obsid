import pg from 'pg';
import type { ApplicationRecord, HostRecord, NonceRecord, ProfileChangeRecord, SaleRecord } from '../types.js';
import { ConflictError, type Store } from './types.js';

/**
 * Idempotent, ordered migrations. Each runs once (tracked in schema_migrations) inside a
 * transaction guarded by an advisory lock, so concurrent replicas booting together are safe.
 * Only hosts, applications, sales metadata, profile change requests and auth nonces are stored.
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      create table if not exists hosts (
        id text primary key,
        wallet_lc text not null unique,
        slug text not null unique,
        verified boolean not null default false,
        data jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create table if not exists applications (
        id text primary key,
        host_id text not null references hosts(id),
        status text not null,
        data jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists applications_status_idx on applications(status);
      create index if not exists applications_host_idx on applications(host_id);
      create table if not exists sales (
        id text primary key,
        host_id text not null references hosts(id),
        application_id text,
        type text not null,
        data jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists sales_type_idx on sales(type);
      create index if not exists sales_host_idx on sales(host_id);
      create table if not exists profile_changes (
        id text primary key,
        host_id text not null references hosts(id),
        status text not null,
        data jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists profile_changes_status_idx on profile_changes(status);
      create table if not exists auth_nonces (
        nonce text primary key,
        address text not null,
        expires_at timestamptz not null
      );
      create index if not exists auth_nonces_expires_idx on auth_nonces(expires_at);
    `,
  },
];

type Rec = { id: string; createdAt: string; updatedAt: string };
type TableName = 'hosts' | 'applications' | 'sales' | 'profile_changes';

// Indexed columns mirrored out of the jsonb document. Table/column names are constants (no user input).
const COLUMNS: Record<TableName, (r: any) => Record<string, unknown>> = {
  hosts: (h: HostRecord) => ({ wallet_lc: h.wallet.toLowerCase(), slug: h.slug, verified: h.verified }),
  applications: (a: ApplicationRecord) => ({ host_id: a.hostId, status: a.status }),
  sales: (s: SaleRecord) => ({ host_id: s.hostId, application_id: s.applicationId, type: s.type }),
  profile_changes: (p: ProfileChangeRecord) => ({ host_id: p.hostId, status: p.status }),
};

function mapPgError(e: unknown): never {
  const err = e as { code?: string; constraint?: string };
  if (err?.code === '23505') {
    const c = err.constraint ?? '';
    throw new ConflictError(
      c.includes('slug') ? 'slug already taken' : c.includes('wallet') ? 'wallet already has a host profile' : 'conflict',
    );
  }
  throw e;
}

export class PostgresStore implements Store {
  readonly kind = 'postgres' as const;
  private pool: pg.Pool;

  constructor(connectionString: string, ssl = false) {
    this.pool = new pg.Pool({
      connectionString,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  }

  async init() {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(727274)');
      await client.query(
        'create table if not exists schema_migrations (version int primary key, applied_at timestamptz not null default now())',
      );
      const { rows } = await client.query<{ version: number }>('select version from schema_migrations');
      const applied = new Set(rows.map((r) => r.version));
      for (const m of MIGRATIONS) {
        if (applied.has(m.version)) continue;
        await client.query(m.sql);
        await client.query('insert into schema_migrations (version) values ($1) on conflict do nothing', [m.version]);
      }
      await client.query('commit');
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  // ---- generic document helpers ----
  private async insert(table: TableName, rec: Rec) {
    const extra = COLUMNS[table](rec);
    const names = ['id', ...Object.keys(extra), 'data', 'created_at', 'updated_at'];
    const values = [rec.id, ...Object.values(extra), JSON.stringify(rec), rec.createdAt, rec.updatedAt];
    const ph = values.map((_, i) => `$${i + 1}`).join(', ');
    await this.pool.query(`insert into ${table} (${names.join(', ')}) values (${ph})`, values).catch(mapPgError);
  }

  private async update(table: TableName, rec: Rec) {
    const extra = COLUMNS[table](rec);
    const keys = Object.keys(extra);
    const sets = [...keys.map((k, i) => `${k} = $${i + 2}`), `data = $${keys.length + 2}`, `updated_at = $${keys.length + 3}`];
    const values = [rec.id, ...Object.values(extra), JSON.stringify(rec), rec.updatedAt];
    await this.pool.query(`update ${table} set ${sets.join(', ')} where id = $1`, values).catch(mapPgError);
  }

  private async find<T>(table: TableName, where: Record<string, unknown> = {}): Promise<T[]> {
    const entries = Object.entries(where).filter(([, v]) => v !== undefined);
    const clause = entries.length ? 'where ' + entries.map(([k], i) => `${k} = $${i + 1}`).join(' and ') : '';
    const { rows } = await this.pool.query<{ data: T }>(
      `select data from ${table} ${clause} order by created_at asc, id asc`,
      entries.map(([, v]) => v),
    );
    return rows.map((r) => r.data);
  }

  private async one<T>(table: TableName, where: Record<string, unknown>): Promise<T | null> {
    const rows = await this.find<T>(table, where);
    return rows[0] ?? null;
  }

  // ---- nonces ----
  async createNonce(n: NonceRecord) {
    await this.pool.query('insert into auth_nonces (nonce, address, expires_at) values ($1, $2, $3)', [
      n.nonce,
      n.address.toLowerCase(),
      n.expiresAt,
    ]);
  }
  async consumeNonce(address: string, nonce: string) {
    const { rowCount } = await this.pool.query(
      'delete from auth_nonces where nonce = $1 and address = $2 and expires_at > now()',
      [nonce, address.toLowerCase()],
    );
    return (rowCount ?? 0) > 0;
  }
  async purgeExpiredNonces() {
    await this.pool.query('delete from auth_nonces where expires_at <= now()');
  }

  // ---- hosts ----
  listHosts() {
    return this.find<HostRecord>('hosts');
  }
  getHostById(id: string) {
    return this.one<HostRecord>('hosts', { id });
  }
  getHostBySlug(slug: string) {
    return this.one<HostRecord>('hosts', { slug });
  }
  getHostByWallet(wallet: string) {
    return this.one<HostRecord>('hosts', { wallet_lc: wallet.toLowerCase() });
  }
  insertHost(h: HostRecord) {
    return this.insert('hosts', h);
  }
  updateHost(h: HostRecord) {
    return this.update('hosts', h);
  }

  // ---- applications ----
  insertApplication(a: ApplicationRecord) {
    return this.insert('applications', a);
  }
  getApplication(id: string) {
    return this.one<ApplicationRecord>('applications', { id });
  }
  listApplications(f: { status?: string; hostId?: string } = {}) {
    return this.find<ApplicationRecord>('applications', { status: f.status, host_id: f.hostId });
  }
  updateApplication(a: ApplicationRecord) {
    return this.update('applications', a);
  }

  // ---- sales ----
  insertSale(s: SaleRecord) {
    return this.insert('sales', s);
  }
  getSale(id: string) {
    return this.one<SaleRecord>('sales', { id });
  }
  listSales(f: { type?: string; hostId?: string } = {}) {
    return this.find<SaleRecord>('sales', { type: f.type, host_id: f.hostId });
  }
  updateSale(s: SaleRecord) {
    return this.update('sales', s);
  }

  // ---- profile changes ----
  insertProfileChange(p: ProfileChangeRecord) {
    return this.insert('profile_changes', p);
  }
  getProfileChange(id: string) {
    return this.one<ProfileChangeRecord>('profile_changes', { id });
  }
  listProfileChanges(f: { status?: string; hostId?: string } = {}) {
    return this.find<ProfileChangeRecord>('profile_changes', { status: f.status, host_id: f.hostId });
  }
  updateProfileChange(p: ProfileChangeRecord) {
    return this.update('profile_changes', p);
  }
}
