export const DEFAULT_ADMIN_WALLET = '0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76';
export const DEFAULT_CORS_ORIGINS = ['https://www.obsid.site', 'https://obsid.site', 'http://localhost:3000'];

export interface Config {
  port: number;
  databaseUrl?: string;
  pgSsl: boolean;
  adminWallet: string;
  corsOrigins: string[];
  seedDemo: boolean;
  /** Max requests per IP per 15 minutes across the whole API. */
  rateLimitMax: number;
  /** Max nonce requests per IP per minute. */
  nonceRateLimitMax: number;
  nonceTtlMs: number;
  bodyLimit: string;
  trustProxy: number;
}

function int(v: string | undefined, fallback: number): number {
  const n = v === undefined || v === '' ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, overrides: Partial<Config> = {}): Config {
  const corsOrigins = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return {
    port: int(env.PORT, 8080),
    databaseUrl: env.DATABASE_URL || undefined,
    pgSsl: env.PGSSL === 'true',
    adminWallet: (env.ADMIN_WALLET || DEFAULT_ADMIN_WALLET).trim(),
    corsOrigins: corsOrigins.length ? corsOrigins : DEFAULT_CORS_ORIGINS,
    seedDemo: env.SEED_DEMO === 'true',
    rateLimitMax: int(env.RATE_LIMIT_MAX, 600),
    nonceRateLimitMax: int(env.NONCE_RATE_LIMIT_MAX, 30),
    nonceTtlMs: 10 * 60 * 1000,
    bodyLimit: env.BODY_LIMIT || '100kb',
    trustProxy: int(env.TRUST_PROXY, 1),
    ...overrides,
  };
}
