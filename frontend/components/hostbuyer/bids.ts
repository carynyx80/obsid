// Buyer side data: sealed bids saved locally (keys starting with "obsid.bid.") plus demo rows.
import { sales as mockSales, hostById } from '@/lib/mock';
import type { Sale } from '@/lib/types';

export interface BidRow {
  key: string;
  saleId: string;
  sale?: Sale;
  hostName?: string;
  amountBnb: number;
  priceBnb: number;
  tokens: number;
  revealed: boolean;
  allocationTokens?: number;
  refundBnb?: number;
  createdAt: string;
  demo?: boolean;
}

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0);

export function readLocalBids(all: Sale[] = mockSales): BidRow[] {
  const out: BidRow[] = [];
  if (typeof window === 'undefined') return out;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('obsid.bid.')) continue;
      let raw: Record<string, unknown> = {};
      try { raw = JSON.parse(localStorage.getItem(key) || '{}'); } catch { continue; }
      const saleId = String(raw.saleId ?? raw.sale ?? key.split('.')[2] ?? '');
      const sale = all.find((s) => s.id === saleId || s.tokenAddress.toLowerCase() === saleId.toLowerCase());
      const amountBnb = num(raw.amountBnb ?? raw.amount ?? raw.deposit ?? raw.value);
      const priceBnb = num(raw.priceBnb ?? raw.price ?? raw.maxPrice);
      out.push({
        key, saleId, sale, hostName: sale ? hostById(sale.hostId)?.name : undefined, amountBnb, priceBnb,
        tokens: num(raw.tokens) || (priceBnb ? amountBnb / priceBnb : 0),
        revealed: Boolean(raw.revealed), allocationTokens: raw.allocationTokens !== undefined ? num(raw.allocationTokens) : undefined,
        createdAt: String(raw.createdAt ?? raw.time ?? new Date().toISOString()),
      });
    }
  } catch {}
  return out;
}

export function demoBids(all: Sale[] = mockSales): BidRow[] {
  const pick = (id: string) => all.find((s) => s.id === id);
  const rows: Omit<BidRow, 'sale' | 'hostName'>[] = [
    { key: 'demo.s1', saleId: 's1', amountBnb: 4.2, priceBnb: 0.00031, tokens: 13548, revealed: false, createdAt: '2026-11-21T09:12:00Z', demo: true },
    { key: 'demo.s5', saleId: 's5', amountBnb: 1.5, priceBnb: 0.00016, tokens: 9375, revealed: false, createdAt: '2026-11-22T18:40:00Z', demo: true },
    { key: 'demo.s4', saleId: 's4', amountBnb: 12, priceBnb: 0.016, tokens: 750, revealed: true, allocationTokens: 845.07, refundBnb: 0, createdAt: '2026-10-03T14:00:00Z', demo: true },
  ];
  return rows.map((r) => { const sale = pick(r.saleId); return { ...r, sale, hostName: sale ? hostById(sale.hostId)?.name : undefined }; });
}

export function allBids(all?: Sale[]) {
  const local = readLocalBids(all);
  return [...local, ...demoBids(all)];
}

/* vesting model for the claim portal */
export interface Vesting { row: BidRow; total: number; tgePct: number; cliffDays: number; linearDays: number; startIso: string; claimed: number }
export function vestingFor(rows: BidRow[]): Vesting[] {
  return rows
    .filter((r) => r.sale && (r.sale.status === 'settled' || r.allocationTokens))
    .map((r, i) => ({ row: r, total: r.allocationTokens ?? r.tokens, tgePct: 20, cliffDays: 30, linearDays: 180, startIso: r.sale!.revealEnd, claimed: i === 0 ? (r.allocationTokens ?? r.tokens) * 0.2 : 0 }));
}
export function vestedAt(v: Vesting, now = Date.now()) {
  const start = new Date(v.startIso).getTime();
  const tge = v.total * (v.tgePct / 100);
  const cliffEnd = start + v.cliffDays * 864e5;
  if (now < start) return 0;
  if (now < cliffEnd) return tge;
  const lin = Math.min(1, (now - cliffEnd) / (v.linearDays * 864e5));
  return tge + (v.total - tge) * lin;
}
