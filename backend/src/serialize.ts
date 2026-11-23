import type { Heat, HostRecord, SaleRecord, SaleStatus } from './types.js';

export function computeStatus(s: Pick<SaleRecord, 'status' | 'start' | 'end' | 'revealEnd'>, now = Date.now()): SaleStatus {
  if (s.status === 'settled' || s.status === 'failed') return s.status;
  if (now < Date.parse(s.start)) return 'upcoming';
  if (now < Date.parse(s.end)) return 'bidding';
  // After revealEnd and until an admin marks it settled/failed, the sale stays in reveal (awaiting settlement).
  return 'reveal';
}

export function computeHeat(totalCommittedBnb: number, hardCapBnb: number): Heat {
  if (!(hardCapBnb > 0)) return 'cold';
  const r = totalCommittedBnb / hardCapBnb;
  if (r < 0.25) return 'cold';
  if (r < 0.6) return 'warm';
  if (r < 0.9) return 'hot';
  return 'on fire';
}

export function saleJSON(s: SaleRecord, now = Date.now()) {
  return {
    id: s.id,
    hostId: s.hostId,
    type: s.type,
    tokenName: s.tokenName,
    tokenSymbol: s.tokenSymbol,
    tokenAddress: s.tokenAddress,
    supply: s.supply,
    minPrice: s.minPrice,
    hardCapBnb: s.hardCapBnb,
    softCapBnb: s.softCapBnb,
    start: s.start,
    end: s.end,
    revealEnd: s.revealEnd,
    status: computeStatus(s, now),
    totalCommittedBnb: s.totalCommittedBnb,
    bidCount: s.bidCount,
    heat: computeHeat(s.totalCommittedBnb, s.hardCapBnb),
    ...(s.clearingPrice != null ? { clearingPrice: s.clearingPrice } : {}),
    escrow: s.escrow,
    summary: s.summary,
    ...(s.contractAddress ? { contractAddress: s.contractAddress } : {}),
  };
}
export type SaleJSON = ReturnType<typeof saleJSON>;

export function hostJSON(h: HostRecord) {
  return {
    id: h.id,
    name: h.name,
    slug: h.slug,
    logo: h.logo,
    banner: h.banner,
    bio: h.bio,
    wallet: h.wallet,
    verified: h.verified,
    links: h.links,
    team: h.team,
  };
}

export function slugify(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return s || 'host';
}
