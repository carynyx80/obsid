import type { Store } from './store/types.js';
import type { HostRecord, SaleRecord, SaleType } from './types.js';

const DAY = 24 * 60 * 60 * 1000;

/** Seeds demo hosts and sales when the store has no hosts yet (SEED_DEMO=true). Idempotent. */
export async function seedDemo(store: Store): Promise<boolean> {
  if ((await store.listHosts()).length > 0) return false;
  const now = Date.now();
  const iso = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString();
  const created = new Date(now).toISOString();

  const hosts: HostRecord[] = [
    {
      id: 'demo-host-verdant',
      name: 'Verdant Labs',
      slug: 'verdant-labs',
      logo: '',
      banner: '',
      bio: 'Tokenized carbon credits with verifiable retirement.',
      wallet: '0x000000000000000000000000000000000000dEaD',
      verified: true,
      links: { website: 'https://example.com' },
      team: [{ name: 'Ada', role: 'Founder' }],
      createdAt: created,
      updatedAt: created,
    },
    {
      id: 'demo-host-kiln',
      name: 'Kiln Finance',
      slug: 'kiln-finance',
      logo: '',
      banner: '',
      bio: 'Auto compounding vaults with liquidity locked at launch.',
      wallet: '0x0000000000000000000000000000000000000Bee',
      verified: true,
      links: {},
      team: [],
      createdAt: created,
      updatedAt: created,
    },
  ];
  for (const h of hosts) await store.insertHost(h);

  const mk = (
    id: string,
    hostId: string,
    type: SaleType,
    tokenName: string,
    tokenSymbol: string,
    startD: number,
    endD: number,
    revealD: number,
    hardCapBnb: number,
    totalCommittedBnb: number,
    bidCount: number,
    extra: Partial<SaleRecord> = {},
  ): SaleRecord => ({
    id,
    hostId,
    applicationId: `demo-app-${id}`,
    type,
    tokenName,
    tokenSymbol,
    tokenAddress: '',
    supply: 10_000_000,
    minPrice: 0.0002,
    hardCapBnb,
    softCapBnb: Math.round(hardCapBnb / 5),
    start: iso(startD),
    end: iso(endD),
    revealEnd: iso(revealD),
    status: 'upcoming',
    totalCommittedBnb,
    bidCount,
    escrow: {
      atClosePct: 30,
      milestones: [
        { label: 'Mainnet beta', pct: 35, released: false },
        { label: 'Audit and v1', pct: 35, released: false },
      ],
    },
    summary: `${tokenName} demo sale.`,
    createdAt: created,
    updatedAt: created,
    ...extra,
  });

  const sales = [
    mk('demo-verdant', 'demo-host-verdant', 'ICO', 'Verdant', 'VRD', -3, 8, 10, 2000, 1284.5, 912),
    mk('demo-kiln', 'demo-host-kiln', 'IDO', 'Kiln', 'KLN', -1, 6, 7, 1500, 610.2, 344),
    mk('demo-verdant-seed', 'demo-host-verdant', 'PRESALE', 'Verdant Seed', 'sVRD', 10, 17, 18, 300, 0, 0),
    mk('demo-kiln-gov', 'demo-host-kiln', 'ICO', 'Kiln Gov', 'gKLN', -50, -40, -38, 800, 800, 1203, {
      status: 'settled',
      clearingPrice: 0.0142,
    }),
  ];
  for (const s of sales) await store.insertSale(s);
  return true;
}
