import { Router } from 'express';
import { HttpError } from '../http.js';
import { hostJSON, saleJSON } from '../serialize.js';
import type { Store } from '../store/types.js';
import type { SaleRecord } from '../types.js';
import { salesQuery } from '../validation.js';

export const CHAIN_ID = 56;

/** Public, unauthenticated read endpoints. */
export function publicRouter(store: Store): Router {
  const r = Router();

  /** Contract address registry for the frontend. Empty object until the admin saves addresses. */
  r.get('/config', async (_req, res) => {
    res.set('cache-control', 'no-store').json({ chainId: CHAIN_ID, contracts: await store.getContracts() });
  });

  r.get('/hosts', async (_req, res) => {
    const [hosts, sales] = await Promise.all([store.listHosts(), store.listSales()]);
    const now = Date.now();
    const byHost = new Map<string, SaleRecord[]>();
    for (const s of sales) byHost.set(s.hostId, [...(byHost.get(s.hostId) ?? []), s]);
    res.json(hosts.map((h) => ({ ...hostJSON(h), sales: (byHost.get(h.id) ?? []).map((s) => saleJSON(s, now)) })));
  });

  r.get('/hosts/:slug', async (req, res) => {
    const host = await store.getHostBySlug(String(req.params.slug).toLowerCase());
    if (!host) throw new HttpError(404, 'host not found');
    const sales = await store.listSales({ hostId: host.id });
    const now = Date.now();
    res.json({ ...hostJSON(host), sales: sales.map((s) => saleJSON(s, now)) });
  });

  r.get('/sales', async (req, res) => {
    const q = salesQuery.parse(req.query);
    if (q.type === 'IPO') {
      res.json([]);
      return;
    }
    const sales = await store.listSales({ type: q.type, hostId: q.hostId });
    const now = Date.now();
    res.json(sales.map((s) => saleJSON(s, now)));
  });

  r.get('/sales/:id', async (req, res) => {
    const sale = await store.getSale(String(req.params.id));
    if (!sale) throw new HttpError(404, 'sale not found');
    res.json(saleJSON(sale));
  });

  return r;
}
