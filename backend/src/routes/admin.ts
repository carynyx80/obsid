import { Router, type RequestHandler } from 'express';
import { requireAdmin } from '../auth.js';
import { HttpError } from '../http.js';
import { hostJSON, saleJSON } from '../serialize.js';
import { newId, nowIso, uniqueSlug } from '../services.js';
import type { Store } from '../store/types.js';
import { CONTRACT_NAMES, type ContractRegistry, type SaleRecord, type SaleStatus } from '../types.js';
import { CHAIN_ID } from './public.js';
import { approveBody, configPutBody, optionalRejectBody, rejectBody, reviewStatusQuery, salePatchBody } from '../validation.js';

export function adminRouter(store: Store, auth: RequestHandler): Router {
  const r = Router();
  r.use(auth, requireAdmin);

  r.get('/applications', async (req, res) => {
    const { status } = reviewStatusQuery.parse(req.query);
    const apps = await store.listApplications({ status });
    const hosts = new Map((await store.listHosts()).map((h) => [h.id, h]));
    res.json(apps.map((a) => ({ ...a, host: hosts.has(a.hostId) ? hostJSON(hosts.get(a.hostId)!) : null })));
  });

  r.post('/applications/:id/approve', async (req, res) => {
    const body = approveBody.parse(req.body ?? {});
    const app = await store.getApplication(String(req.params.id));
    if (!app) throw new HttpError(404, 'application not found');
    if (app.status !== 'pending') throw new HttpError(409, `application is already ${app.status}`);
    const host = await store.getHostById(app.hostId);
    if (!host) throw new HttpError(409, 'host for this application no longer exists');

    const now = nowIso();
    const sale: SaleRecord = {
      id: newId(),
      hostId: app.hostId,
      applicationId: app.id,
      type: app.type,
      tokenName: app.tokenName,
      tokenSymbol: app.tokenSymbol,
      tokenAddress: app.tokenAddress,
      supply: app.supply,
      minPrice: app.minPrice,
      hardCapBnb: app.hardCapBnb,
      softCapBnb: app.softCapBnb,
      start: app.start,
      end: app.end,
      revealEnd: app.revealEnd,
      status: 'upcoming',
      totalCommittedBnb: 0,
      bidCount: 0,
      escrow: {
        atClosePct: app.escrowAtClosePct,
        milestones: app.milestones.map((m) => ({ label: m.label, pct: m.pct, released: false })),
      },
      summary: app.summary,
      ...(body.contractAddress ? { contractAddress: body.contractAddress } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await store.insertSale(sale);

    app.status = 'approved';
    app.saleId = sale.id;
    app.updatedAt = now;
    await store.updateApplication(app);

    host.verified = true;
    host.updatedAt = now;
    await store.updateHost(host);

    res.json({ application: app, sale: saleJSON(sale), host: hostJSON(host) });
  });

  r.post('/applications/:id/reject', async (req, res) => {
    const { reason } = rejectBody.parse(req.body ?? {});
    const app = await store.getApplication(String(req.params.id));
    if (!app) throw new HttpError(404, 'application not found');
    if (app.status !== 'pending') throw new HttpError(409, `application is already ${app.status}`);
    app.status = 'rejected';
    app.rejectReason = reason;
    app.updatedAt = nowIso();
    await store.updateApplication(app);
    res.json(app);
  });

  r.patch('/sales/:id', async (req, res) => {
    const body = salePatchBody.parse(req.body ?? {});
    const sale = await store.getSale(String(req.params.id));
    if (!sale) throw new HttpError(404, 'sale not found');
    if (body.contractAddress !== undefined) {
      if (body.contractAddress === null) delete sale.contractAddress;
      else sale.contractAddress = body.contractAddress;
    }
    if (body.status !== undefined) sale.status = body.status as SaleStatus;
    if (body.totalCommittedBnb !== undefined) sale.totalCommittedBnb = body.totalCommittedBnb;
    if (body.bidCount !== undefined) sale.bidCount = body.bidCount;
    if (body.clearingPrice !== undefined) {
      if (body.clearingPrice === null) delete sale.clearingPrice;
      else sale.clearingPrice = body.clearingPrice;
    }
    if (body.milestonesReleased !== undefined) {
      if (body.milestonesReleased.length !== sale.escrow.milestones.length) {
        throw new HttpError(400, `milestonesReleased must have ${sale.escrow.milestones.length} entries`);
      }
      sale.escrow.milestones = sale.escrow.milestones.map((m, i) => ({ ...m, released: body.milestonesReleased![i] }));
    }
    sale.updatedAt = nowIso();
    await store.updateSale(sale);
    res.json(saleJSON(sale));
  });

  /**
   * Save the contract address registry. Replaces the stored registry with the given keys unless
   * `merge: true`, in which case only provided keys change. null or '' removes a key.
   */
  r.put('/config', async (req, res) => {
    const body = configPutBody.parse(req.body ?? {});
    const next: ContractRegistry = body.merge ? await store.getContracts() : {};
    for (const name of CONTRACT_NAMES) {
      const v = body.contracts[name];
      if (v === undefined) continue;
      if (v === null || v === '') delete next[name];
      else next[name] = v;
    }
    await store.setContracts(next);
    res.json({ chainId: CHAIN_ID, contracts: next });
  });

  r.get('/profile-changes', async (req, res) => {
    const { status } = reviewStatusQuery.parse(req.query);
    const changes = await store.listProfileChanges({ status });
    const hosts = new Map((await store.listHosts()).map((h) => [h.id, h]));
    res.json(changes.map((c) => ({ ...c, host: hosts.has(c.hostId) ? hostJSON(hosts.get(c.hostId)!) : null })));
  });

  r.post('/profile-changes/:id/approve', async (req, res) => {
    const change = await store.getProfileChange(String(req.params.id));
    if (!change) throw new HttpError(404, 'profile change not found');
    if (change.status !== 'pending') throw new HttpError(409, `profile change is already ${change.status}`);
    const host = await store.getHostById(change.hostId);
    if (!host) throw new HttpError(409, 'host no longer exists');

    if (change.changes.name !== undefined) {
      host.name = change.changes.name;
      host.slug = await uniqueSlug(store, change.changes.name, host.id);
      change.changes.slug = host.slug;
    }
    if (change.changes.wallet !== undefined) {
      const other = await store.getHostByWallet(change.changes.wallet);
      if (other && other.id !== host.id) throw new HttpError(409, 'wallet already has a host profile');
      host.wallet = change.changes.wallet;
    }
    const now = nowIso();
    host.updatedAt = now;
    await store.updateHost(host);
    change.status = 'approved';
    change.updatedAt = now;
    await store.updateProfileChange(change);
    res.json({ change, host: hostJSON(host) });
  });

  r.post('/profile-changes/:id/reject', async (req, res) => {
    const { reason } = optionalRejectBody.parse(req.body ?? {});
    const change = await store.getProfileChange(String(req.params.id));
    if (!change) throw new HttpError(404, 'profile change not found');
    if (change.status !== 'pending') throw new HttpError(409, `profile change is already ${change.status}`);
    change.status = 'rejected';
    if (reason) change.reason = reason;
    change.updatedAt = nowIso();
    await store.updateProfileChange(change);
    res.json(change);
  });

  return r;
}
