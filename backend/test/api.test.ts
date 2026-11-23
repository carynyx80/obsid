import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { DEFAULT_ADMIN_WALLET, loadConfig } from '../src/config.js';
import { MemoryStore } from '../src/store/memory.js';
import { computeHeat, computeStatus } from '../src/serialize.js';

// Throwaway keys generated per test run. Never real wallets.
const newAccount = () => privateKeyToAccount(generatePrivateKey());

const DAY = 24 * 60 * 60 * 1000;
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString();

function validApplication(overrides: Record<string, unknown> = {}) {
  return {
    type: 'ICO',
    tokenName: 'Test Token',
    tokenSymbol: 'TST',
    tokenAddress: '0x0000000000000000000000000000000000000001',
    supply: 1_000_000,
    minPrice: 0.001,
    softCapBnb: 100,
    hardCapBnb: 500,
    start: future(1),
    end: future(5),
    revealEnd: future(6),
    escrowAtClosePct: 40,
    milestones: [
      { label: 'Beta', pct: 30 },
      { label: 'Mainnet', pct: 30 },
    ],
    summary: 'A test sale.',
    ...overrides,
  };
}

async function authHeaders(app: Express, account: PrivateKeyAccount) {
  const r = await request(app).get('/api/auth/nonce').query({ address: account.address });
  expect(r.status).toBe(200);
  const signature = await account.signMessage({ message: r.body.message });
  return { 'x-address': account.address, 'x-signature': signature, 'x-nonce': r.body.nonce };
}

let admin: PrivateKeyAccount;
let store: MemoryStore;
let app: Express;

beforeEach(() => {
  admin = newAccount();
  store = new MemoryStore();
  app = createApp(store, loadConfig({}, { adminWallet: admin.address.toLowerCase(), rateLimitMax: 10_000, nonceRateLimitMax: 10_000 }));
});

async function createHost(account: PrivateKeyAccount, body: Record<string, unknown> = { name: 'Acme Labs' }) {
  const r = await request(app).post('/api/hosts').set(await authHeaders(app, account)).send(body);
  return r;
}

async function apply(account: PrivateKeyAccount, body = validApplication()) {
  return request(app).post('/api/applications').set(await authHeaders(app, account)).send(body);
}

describe('health and config', () => {
  it('GET /health returns ok', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  it('defaults admin wallet and CORS origins', () => {
    const c = loadConfig({});
    expect(c.adminWallet).toBe(DEFAULT_ADMIN_WALLET);
    expect(c.corsOrigins).toEqual(['https://www.obsid.site', 'https://obsid.site', 'http://localhost:3000']);
    expect(loadConfig({ CORS_ORIGIN: 'https://a.com, https://b.com/' }).corsOrigins).toEqual(['https://a.com', 'https://b.com']);
  });

  it('CORS allows configured origins only', async () => {
    const ok = await request(app).get('/health').set('Origin', 'https://obsid.site');
    expect(ok.headers['access-control-allow-origin']).toBe('https://obsid.site');
    const bad = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('nonce and auth', () => {
  it('returns nonce and exact message', async () => {
    const acct = newAccount();
    const r = await request(app).get('/api/auth/nonce').query({ address: acct.address.toLowerCase() });
    expect(r.status).toBe(200);
    expect(r.body.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(r.body.message).toBe(`Sign in to Obsid\nAddress: ${acct.address}\nNonce: ${r.body.nonce}`);
  });

  it('rejects invalid address', async () => {
    const r = await request(app).get('/api/auth/nonce').query({ address: '0x123' });
    expect(r.status).toBe(400);
  });

  it('accepts a valid signature and rejects nonce reuse', async () => {
    const acct = newAccount();
    const headers = await authHeaders(app, acct);
    const first = await request(app).get('/api/applications/mine').set(headers);
    expect(first.status).toBe(200);
    const replay = await request(app).get('/api/applications/mine').set(headers);
    expect(replay.status).toBe(401);
    expect(replay.body.error).toMatch(/nonce/);
  });

  it('rejects missing headers, wrong signer and expired nonce', async () => {
    expect((await request(app).get('/api/applications/mine')).status).toBe(401);

    const a = newAccount();
    const b = newAccount();
    const r = await request(app).get('/api/auth/nonce').query({ address: a.address });
    const sigByB = await b.signMessage({ message: r.body.message });
    const wrong = await request(app)
      .get('/api/applications/mine')
      .set({ 'x-address': a.address, 'x-signature': sigByB, 'x-nonce': r.body.nonce });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toMatch(/signature/);

    // nonce issued for a, presented as b
    const r2 = await request(app).get('/api/auth/nonce').query({ address: a.address });
    const sig2 = await b.signMessage({ message: r2.body.message });
    const mismatch = await request(app)
      .get('/api/applications/mine')
      .set({ 'x-address': b.address, 'x-signature': sig2, 'x-nonce': r2.body.nonce });
    expect(mismatch.status).toBe(401);

    // expired nonce
    await store.createNonce({ nonce: 'deadbeef', address: a.address.toLowerCase(), expiresAt: new Date(Date.now() - 1000) });
    const sig3 = await a.signMessage({ message: `Sign in to Obsid\nAddress: ${a.address}\nNonce: deadbeef` });
    const expired = await request(app)
      .get('/api/applications/mine')
      .set({ 'x-address': a.address, 'x-signature': sig3, 'x-nonce': 'deadbeef' });
    expect(expired.status).toBe(401);
  });
});

describe('hosts', () => {
  it('creates a host with slug, signer wallet and verified=false', async () => {
    const acct = newAccount();
    const r = await createHost(acct, {
      name: 'Acme Labs!',
      logo: 'https://cdn.example.com/logo.png',
      bio: 'We build things.',
      links: { website: 'https://acme.example', x: 'https://x.com/acme' },
      team: [{ name: 'Ada', role: 'CEO' }],
    });
    expect(r.status).toBe(201);
    expect(r.body.host).toMatchObject({ name: 'Acme Labs!', slug: 'acme-labs', wallet: acct.address, verified: false });
    expect(Object.keys(r.body.host).sort()).toEqual(['banner', 'bio', 'id', 'links', 'logo', 'name', 'slug', 'team', 'verified', 'wallet']);

    const list = await request(app).get('/api/hosts');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].sales).toEqual([]);
    const one = await request(app).get('/api/hosts/acme-labs');
    expect(one.status).toBe(200);
    expect(one.body.wallet).toBe(acct.address);
    expect((await request(app).get('/api/hosts/nope')).status).toBe(404);
  });

  it('dedupes slugs and validates input', async () => {
    await createHost(newAccount(), { name: 'Same Name' });
    const r = await createHost(newAccount(), { name: 'Same Name' });
    expect(r.body.host.slug).toBe('same-name-2');
    expect((await createHost(newAccount(), {})).status).toBe(400);
    expect((await createHost(newAccount(), { name: 'Ok Name', logo: 'javascript:alert(1)' })).status).toBe(400);
  });

  it('unverified host can rename directly', async () => {
    const acct = newAccount();
    await createHost(acct, { name: 'Old Name' });
    const r = await createHost(acct, { name: 'New Name' });
    expect(r.status).toBe(200);
    expect(r.body.host).toMatchObject({ name: 'New Name', slug: 'new-name' });
    expect(r.body.pendingChange).toBeNull();
  });

  it('verified host name change creates a pending change; other fields apply', async () => {
    const acct = newAccount();
    const created = await createHost(acct, { name: 'Verified Co' });
    await store.updateHost({ ...(await store.getHostById(created.body.host.id))!, verified: true });

    const newWallet = newAccount().address;
    const r = await createHost(acct, { name: 'Renamed Co', bio: 'Updated bio', wallet: newWallet });
    expect(r.status).toBe(200);
    expect(r.body.host).toMatchObject({ name: 'Verified Co', slug: 'verified-co', bio: 'Updated bio', wallet: acct.address });
    expect(r.body.pendingChange).toMatchObject({ status: 'pending', changes: { name: 'Renamed Co', wallet: newWallet } });

    const adminList = await request(app).get('/api/admin/profile-changes').set(await authHeaders(app, admin));
    expect(adminList.status).toBe(200);
    expect(adminList.body).toHaveLength(1);

    const approve = await request(app)
      .post(`/api/admin/profile-changes/${r.body.pendingChange.id}/approve`)
      .set(await authHeaders(app, admin));
    expect(approve.status).toBe(200);
    expect(approve.body.host).toMatchObject({ name: 'Renamed Co', slug: 'renamed-co', wallet: newWallet, verified: true });

    const again = await request(app)
      .post(`/api/admin/profile-changes/${r.body.pendingChange.id}/reject`)
      .set(await authHeaders(app, admin));
    expect(again.status).toBe(409);
  });
});

describe('applications', () => {
  it('requires a host profile', async () => {
    const r = await apply(newAccount());
    expect(r.status).toBe(403);
  });

  it('creates a pending application and lists mine', async () => {
    const acct = newAccount();
    await createHost(acct);
    const r = await apply(acct);
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('pending');
    const mine = await request(app).get('/api/applications/mine').set(await authHeaders(app, acct));
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].id).toBe(r.body.id);
  });

  it('validates caps, IPO, milestone sum, ordering and start in future', async () => {
    const acct = newAccount();
    await createHost(acct);

    const badCaps = await apply(acct, validApplication({ softCapBnb: 500, hardCapBnb: 100 }));
    expect(badCaps.status).toBe(400);
    expect(badCaps.body.error).toMatch(/hardCapBnb/);

    const ipo = await apply(acct, validApplication({ type: 'IPO' }));
    expect(ipo.status).toBe(400);
    expect(ipo.body.error).toMatch(/coming soon/i);

    const unknownType = await apply(acct, validApplication({ type: 'NFT' }));
    expect(unknownType.status).toBe(400);

    const badSum = await apply(acct, validApplication({ escrowAtClosePct: 50 }));
    expect(badSum.status).toBe(400);
    expect(badSum.body.error).toMatch(/sum to 100/);

    const past = await apply(acct, validApplication({ start: new Date(Date.now() - DAY).toISOString() }));
    expect(past.status).toBe(400);
    expect(past.body.error).toMatch(/future/);

    const order = await apply(acct, validApplication({ end: future(0.5) }));
    expect(order.status).toBe(400);
    expect(order.body.error).toMatch(/end must be after start/);

    const reveal = await apply(acct, validApplication({ revealEnd: future(4) }));
    expect(reveal.status).toBe(400);

    expect((await apply(acct, validApplication({ supply: -1 }))).status).toBe(400);

    const mine = await request(app).get('/api/applications/mine').set(await authHeaders(app, acct));
    expect(mine.body).toHaveLength(0);
  });
});

describe('admin', () => {
  it('non admin gets 403 on admin routes, unauthenticated gets 401', async () => {
    const acct = newAccount();
    for (const [method, path] of [
      ['get', '/api/admin/applications'],
      ['post', '/api/admin/applications/x/approve'],
      ['post', '/api/admin/applications/x/reject'],
      ['patch', '/api/admin/sales/x'],
      ['get', '/api/admin/profile-changes'],
      ['post', '/api/admin/profile-changes/x/approve'],
    ] as const) {
      const r = await request(app)[method](path).set(await authHeaders(app, acct)).send({});
      expect(r.status, `${method} ${path}`).toBe(403);
    }
    expect((await request(app).get('/api/admin/applications')).status).toBe(401);
  });

  it('admin compare is case insensitive', async () => {
    const r = await request(app).get('/api/admin/applications').set(await authHeaders(app, admin));
    expect(r.status).toBe(200);
  });

  it('approve creates a sale and verifies the host; patch updates aggregates', async () => {
    const acct = newAccount();
    const host = (await createHost(acct)).body.host;
    const application = (await apply(acct)).body;

    const pending = await request(app).get('/api/admin/applications').query({ status: 'pending' }).set(await authHeaders(app, admin));
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0].host.id).toBe(host.id);

    const contract = '0x00000000000000000000000000000000000000Aa';
    const r = await request(app)
      .post(`/api/admin/applications/${application.id}/approve`)
      .set(await authHeaders(app, admin))
      .send({ contractAddress: contract });
    expect(r.status).toBe(200);
    expect(r.body.application.status).toBe('approved');
    expect(r.body.host.verified).toBe(true);
    const sale = r.body.sale;
    expect(sale).toMatchObject({
      hostId: host.id,
      type: 'ICO',
      status: 'upcoming',
      heat: 'cold',
      totalCommittedBnb: 0,
      bidCount: 0,
      contractAddress: '0x00000000000000000000000000000000000000AA',
      escrow: { atClosePct: 40, milestones: [{ label: 'Beta', pct: 30, released: false }, { label: 'Mainnet', pct: 30, released: false }] },
    });
    expect(sale.clearingPrice).toBeUndefined();

    expect((await request(app).get(`/api/hosts/${host.slug}`)).body).toMatchObject({ verified: true, sales: [{ id: sale.id }] });
    expect((await request(app).get(`/api/sales/${sale.id}`)).body.id).toBe(sale.id);

    const twice = await request(app).post(`/api/admin/applications/${application.id}/approve`).set(await authHeaders(app, admin));
    expect(twice.status).toBe(409);

    const patched = await request(app)
      .patch(`/api/admin/sales/${sale.id}`)
      .set(await authHeaders(app, admin))
      .send({ totalCommittedBnb: 460, bidCount: 12, status: 'settled', clearingPrice: 0.002, milestonesReleased: [true, false] });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ totalCommittedBnb: 460, bidCount: 12, status: 'settled', heat: 'on fire', clearingPrice: 0.002 });
    expect(patched.body.escrow.milestones[0].released).toBe(true);
  });

  it('reject requires a reason and sets status', async () => {
    const acct = newAccount();
    await createHost(acct);
    const application = (await apply(acct)).body;
    const noReason = await request(app).post(`/api/admin/applications/${application.id}/reject`).set(await authHeaders(app, admin)).send({});
    expect(noReason.status).toBe(400);
    const r = await request(app)
      .post(`/api/admin/applications/${application.id}/reject`)
      .set(await authHeaders(app, admin))
      .send({ reason: 'Caps too high' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'rejected', rejectReason: 'Caps too high' });
    expect((await store.listSales()).length).toBe(0);
  });
});

describe('sales', () => {
  async function approvedSale(type: string) {
    const acct = newAccount();
    await createHost(acct, { name: `Host ${type}` });
    const application = (await apply(acct, validApplication({ type }))).body;
    const r = await request(app).post(`/api/admin/applications/${application.id}/approve`).set(await authHeaders(app, admin));
    return r.body.sale;
  }

  it('lists and filters by type', async () => {
    await approvedSale('ICO');
    await approvedSale('IDO');
    await approvedSale('presale');
    expect((await request(app).get('/api/sales')).body).toHaveLength(3);
    const ido = await request(app).get('/api/sales').query({ type: 'IDO' });
    expect(ido.body).toHaveLength(1);
    expect(ido.body[0].type).toBe('IDO');
    expect((await request(app).get('/api/sales').query({ type: 'PRESALE' })).body).toHaveLength(1);
    expect((await request(app).get('/api/sales').query({ type: 'IPO' })).body).toEqual([]);
    expect((await request(app).get('/api/sales').query({ type: 'BOGUS' })).status).toBe(400);
    expect((await request(app).get('/api/sales/missing')).status).toBe(404);
  });

  it('computes status and heat', () => {
    const t = { start: '2026-01-02T00:00:00Z', end: '2026-01-03T00:00:00Z', revealEnd: '2026-01-04T00:00:00Z' };
    expect(computeStatus({ ...t, status: 'upcoming' }, Date.parse('2026-01-01T00:00:00Z'))).toBe('upcoming');
    expect(computeStatus({ ...t, status: 'upcoming' }, Date.parse('2026-01-02T12:00:00Z'))).toBe('bidding');
    expect(computeStatus({ ...t, status: 'upcoming' }, Date.parse('2026-01-03T12:00:00Z'))).toBe('reveal');
    expect(computeStatus({ ...t, status: 'failed' }, Date.parse('2026-01-01T00:00:00Z'))).toBe('failed');
    expect(computeHeat(0, 100)).toBe('cold');
    expect(computeHeat(24.9, 100)).toBe('cold');
    expect(computeHeat(25, 100)).toBe('warm');
    expect(computeHeat(60, 100)).toBe('hot');
    expect(computeHeat(90, 100)).toBe('on fire');
  });
});

describe('rate limiting', () => {
  it('limits nonce requests and sends standard headers', async () => {
    const limited = createApp(new MemoryStore(), loadConfig({}, { nonceRateLimitMax: 3, rateLimitMax: 1000 }));
    const address = newAccount().address;
    for (let i = 0; i < 3; i++) {
      const r = await request(limited).get('/api/auth/nonce').query({ address });
      expect(r.status).toBe(200);
      expect(r.headers['ratelimit']).toBeDefined();
    }
    const blocked = await request(limited).get('/api/auth/nonce').query({ address });
    expect(blocked.status).toBe(429);
    // health is never rate limited
    expect((await request(limited).get('/health')).status).toBe(200);
  });

  it('applies a global API limit', async () => {
    const limited = createApp(new MemoryStore(), loadConfig({}, { rateLimitMax: 2 }));
    expect((await request(limited).get('/api/sales')).status).toBe(200);
    expect((await request(limited).get('/api/sales')).status).toBe(200);
    expect((await request(limited).get('/api/sales')).status).toBe(429);
  });

  it('default limits are sane', () => {
    const c = loadConfig({});
    expect(c.rateLimitMax).toBeGreaterThanOrEqual(100);
    expect(c.nonceRateLimitMax).toBeGreaterThanOrEqual(5);
    expect(c.nonceRateLimitMax).toBeLessThanOrEqual(120);
  });
});

describe('privacy', () => {
  it('memory store exposes no buyer or bid collections', () => {
    const keys = Object.keys(new MemoryStore()).join(',').toLowerCase();
    expect(keys).not.toMatch(/bid|buyer/);
  });

  it('rejects oversized JSON bodies', async () => {
    const acct = newAccount();
    const r = await request(app)
      .post('/api/hosts')
      .set(await authHeaders(app, acct))
      .send({ name: 'Big', bio: 'x'.repeat(200_000) });
    expect(r.status).toBe(413);
  });
});
