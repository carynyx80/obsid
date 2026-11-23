import { Router, type RequestHandler } from 'express';
import { sameAddress } from '../auth.js';
import { HttpError } from '../http.js';
import { hostJSON, saleJSON } from '../serialize.js';
import { cleanLinks, newId, nowIso, uniqueSlug } from '../services.js';
import type { Store } from '../store/types.js';
import type { ApplicationRecord, HostRecord, ProfileChangeRecord } from '../types.js';
import { applicationInputSchema, hostInputSchema } from '../validation.js';

/** Authenticated host endpoints (the signer acts on their own host profile). */
export function hostRouter(store: Store, auth: RequestHandler): Router {
  const r = Router();

  r.get('/hosts/me', auth, async (req, res) => {
    const host = await store.getHostByWallet(req.auth!.address);
    if (!host) throw new HttpError(404, 'no host profile for this wallet');
    const [sales, pending] = await Promise.all([
      store.listSales({ hostId: host.id }),
      store.listProfileChanges({ hostId: host.id, status: 'pending' }),
    ]);
    res.json({ host: { ...hostJSON(host), sales: sales.map((s) => saleJSON(s)) }, pendingChange: pending[0] ?? null });
  });

  r.post('/hosts', auth, async (req, res) => {
    const input = hostInputSchema.parse(req.body ?? {});
    const signer = req.auth!.address;
    const existing = await store.getHostByWallet(signer);
    const now = nowIso();

    if (!existing) {
      if (!input.name) throw new HttpError(400, 'name is required');
      if (input.wallet && !sameAddress(input.wallet, signer)) {
        throw new HttpError(400, 'wallet must be the signing wallet when creating a host profile');
      }
      const host: HostRecord = {
        id: newId(),
        name: input.name,
        slug: await uniqueSlug(store, input.name),
        logo: input.logo ?? '',
        banner: input.banner ?? '',
        bio: input.bio ?? '',
        wallet: signer,
        verified: false,
        links: cleanLinks(input.links ?? {}),
        team: input.team ?? [],
        createdAt: now,
        updatedAt: now,
      };
      await store.insertHost(host);
      res.status(201).json({ host: hostJSON(host), pendingChange: null });
      return;
    }

    const host = existing;
    // Fields that always apply directly.
    if (input.logo !== undefined) host.logo = input.logo;
    if (input.banner !== undefined) host.banner = input.banner;
    if (input.bio !== undefined) host.bio = input.bio;
    if (input.links !== undefined) host.links = cleanLinks(input.links);
    if (input.team !== undefined) host.team = input.team;

    // Identity fields: applied directly for unverified hosts, queued for admin review once verified.
    const requested: ProfileChangeRecord['changes'] = {};
    if (input.name !== undefined && input.name !== host.name) {
      if (host.verified) requested.name = input.name;
      else {
        host.name = input.name;
        host.slug = await uniqueSlug(store, input.name, host.id);
      }
    }
    if (input.wallet !== undefined && !sameAddress(input.wallet, host.wallet)) {
      const other = await store.getHostByWallet(input.wallet);
      if (other && other.id !== host.id) throw new HttpError(409, 'wallet already has a host profile');
      if (host.verified) requested.wallet = input.wallet;
      else host.wallet = input.wallet;
    }

    host.updatedAt = now;
    await store.updateHost(host);

    let pendingChange: ProfileChangeRecord | null = null;
    if (Object.keys(requested).length) {
      const [open] = await store.listProfileChanges({ hostId: host.id, status: 'pending' });
      if (open) {
        open.changes = { ...open.changes, ...requested };
        open.updatedAt = now;
        await store.updateProfileChange(open);
        pendingChange = open;
      } else {
        pendingChange = {
          id: newId(),
          hostId: host.id,
          changes: requested,
          previous: { name: host.name, slug: host.slug, wallet: host.wallet },
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        };
        await store.insertProfileChange(pendingChange);
      }
    }
    res.json({ host: hostJSON(host), pendingChange });
  });

  r.post('/applications', auth, async (req, res) => {
    const host = await store.getHostByWallet(req.auth!.address);
    if (!host) throw new HttpError(403, 'create a host profile before applying');
    const input = applicationInputSchema(Date.now()).parse(req.body ?? {});
    const now = nowIso();
    const app: ApplicationRecord = {
      id: newId(),
      hostId: host.id,
      type: input.type,
      tokenName: input.tokenName,
      tokenSymbol: input.tokenSymbol,
      tokenAddress: input.tokenAddress ?? '',
      supply: input.supply,
      minPrice: input.minPrice,
      softCapBnb: input.softCapBnb,
      hardCapBnb: input.hardCapBnb,
      start: input.start.toISOString(),
      end: input.end.toISOString(),
      revealEnd: input.revealEnd.toISOString(),
      escrowAtClosePct: input.escrowAtClosePct,
      milestones: input.milestones,
      summary: input.summary,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    await store.insertApplication(app);
    res.status(201).json(app);
  });

  r.get('/applications/mine', auth, async (req, res) => {
    const host = await store.getHostByWallet(req.auth!.address);
    res.json(host ? await store.listApplications({ hostId: host.id }) : []);
  });

  return r;
}
