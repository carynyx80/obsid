'use client';
// Live onchain reads for one SealedBidSale clone (aggregates, tick grid, phase, the connected bidder's bid).
import { useEffect, useState } from 'react';
import type { Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { CHAIN_ID, MILESTONE_ESCROW_ABI, SALE_STATE, SEALED_BID_SALE_ABI, erc20Abi, type SaleState } from '@/lib/chain';

export type ChainPhase = 'soon' | 'commit' | 'reveal' | 'finalize' | 'done';

export interface SaleChain {
  loaded: boolean;
  numTicks: number;
  minPrice: bigint;
  tickSize: bigint;
  supply: bigint;
  softCap: bigint;
  startTime: number;
  endTime: number;
  revealEndTime: number;
  state: SaleState;
  funded: boolean;
  paused: boolean;
  numBidders: number;
  numRevealed: number;
  totalDeposits: bigint;
  clearingTick: number;
  clearingPrice: bigint;
  totalSold: bigint;
  raised: bigint;
  saleToken?: Address;
  escrow?: Address;
  host?: Address;
  decimals: number;
  phase: ChainPhase;
  bid?: { commitment: `0x${string}`; deposit: bigint; amount: bigint; tick: number; revealed: boolean; settled: boolean };
  allocation?: { allocation: bigint; payment: bigint; refund: bigint };
  escrowState?: { funded: boolean; refundMode: boolean; refundable: bigint; voted: bigint; lockedAmount: bigint };
  refetch: () => void;
}

const F = [
  'numTicks', 'minPrice', 'tickSize', 'supply', 'softCap', 'startTime', 'endTime', 'revealEndTime', 'state', 'funded', 'paused',
  'numBidders', 'numRevealed', 'totalDeposits', 'clearingTick', 'clearingPrice', 'totalSold', 'raised', 'saleToken', 'escrow', 'host',
] as const;

function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function useSaleChain(sale: Address | null, bidder?: Address): SaleChain | null {
  const now = useNow();
  const base = useReadContracts({
    allowFailure: true,
    contracts: sale ? F.map((functionName) => ({ address: sale, abi: SEALED_BID_SALE_ABI, functionName, chainId: CHAIN_ID })) : [],
    query: { enabled: !!sale, refetchInterval: 20_000 },
  });
  const r = base.data;
  const v = <T,>(i: number, fb: T): T => (r?.[i]?.status === 'success' ? (r[i].result as T) : fb);
  const saleToken = v<Address | undefined>(18, undefined);
  const escrow = v<Address | undefined>(19, undefined);

  const extra = useReadContracts({
    allowFailure: true,
    contracts: sale
      ? [
          ...(saleToken ? [{ address: saleToken, abi: erc20Abi, functionName: 'decimals' as const, chainId: CHAIN_ID }] : []),
          ...(bidder
            ? [
                { address: sale, abi: SEALED_BID_SALE_ABI, functionName: 'bids', args: [bidder], chainId: CHAIN_ID },
                { address: sale, abi: SEALED_BID_SALE_ABI, functionName: 'allocationOf', args: [bidder], chainId: CHAIN_ID },
              ]
            : []),
          ...(escrow
            ? [
                { address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: 'funded', chainId: CHAIN_ID },
                { address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: 'refundMode', chainId: CHAIN_ID },
                { address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: 'lockedAmount', chainId: CHAIN_ID },
                ...(bidder
                  ? [
                      { address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: 'refundableOf', args: [bidder], chainId: CHAIN_ID },
                      { address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: 'votedWeight', args: [bidder], chainId: CHAIN_ID },
                    ]
                  : []),
              ]
            : []),
        ]
      : [],
    query: { enabled: !!sale && !!r, refetchInterval: 20_000 },
  });

  if (!sale) return null;
  const e = extra.data ?? [];
  let k = 0;
  const take = <T,>(fb: T): T => { const x = e[k++]; return x?.status === 'success' ? (x.result as T) : fb; };
  const decimals = saleToken ? Number(take<number>(18)) : 18;
  let bid: SaleChain['bid'];
  let allocation: SaleChain['allocation'];
  if (bidder) {
    const b = take<readonly [`0x${string}`, bigint, bigint, number, boolean, boolean] | undefined>(undefined);
    if (b) bid = { commitment: b[0], deposit: b[1], amount: b[2], tick: Number(b[3]), revealed: b[4], settled: b[5] };
    const a = take<readonly [bigint, bigint, bigint] | undefined>(undefined);
    if (a) allocation = { allocation: a[0], payment: a[1], refund: a[2] };
  }
  let escrowState: SaleChain['escrowState'];
  if (escrow) {
    const funded = take(false), refundMode = take(false), lockedAmount = take(0n);
    const refundable = bidder ? take(0n) : 0n, voted = bidder ? take(0n) : 0n;
    escrowState = { funded, refundMode, lockedAmount, refundable, voted };
  }

  const state = SALE_STATE[Number(v<number>(8, 0))] ?? 'Pending';
  const startTime = Number(v<bigint>(5, 0n)), endTime = Number(v<bigint>(6, 0n)), revealEndTime = Number(v<bigint>(7, 0n));
  const phase: ChainPhase =
    state !== 'Pending' ? 'done' : now < startTime ? 'soon' : now < endTime ? 'commit' : now < revealEndTime ? 'reveal' : 'finalize';

  return {
    loaded: !!r && r[0]?.status === 'success',
    numTicks: Number(v<number>(0, 0)),
    minPrice: v(1, 0n),
    tickSize: v(2, 0n),
    supply: v(3, 0n),
    softCap: v(4, 0n),
    startTime, endTime, revealEndTime, state,
    funded: v(9, false),
    paused: v(10, false),
    numBidders: Number(v<bigint>(11, 0n)),
    numRevealed: Number(v<bigint>(12, 0n)),
    totalDeposits: v(13, 0n),
    clearingTick: Number(v<number>(14, 0)),
    clearingPrice: v(15, 0n),
    totalSold: v(16, 0n),
    raised: v(17, 0n),
    saleToken, escrow,
    host: v<Address | undefined>(20, undefined),
    decimals, phase, bid, allocation, escrowState,
    refetch: () => { base.refetch(); extra.refetch(); },
  };
}

/** Sale token decimals for several SealedBidSale clones (sale.saleToken() then token.decimals()). Defaults to 18. */
export function useSaleDecimals(sales: Address[]): Record<string, number> {
  const tokens = useReadContracts({
    allowFailure: true,
    contracts: sales.map((s) => ({ address: s, abi: SEALED_BID_SALE_ABI, functionName: 'saleToken', chainId: CHAIN_ID })),
    query: { enabled: sales.length > 0 },
  });
  const tokenAddrs = sales.map((_, i) => (tokens.data?.[i]?.status === 'success' ? (tokens.data[i].result as Address) : undefined));
  const decs = useReadContracts({
    allowFailure: true,
    contracts: tokenAddrs.filter((t): t is Address => !!t).map((t) => ({ address: t, abi: erc20Abi, functionName: 'decimals' as const, chainId: CHAIN_ID })),
    query: { enabled: tokenAddrs.some(Boolean) },
  });
  const out: Record<string, number> = {};
  let j = 0;
  sales.forEach((s, i) => {
    if (!tokenAddrs[i]) { out[s.toLowerCase()] = 18; return; }
    const d = decs.data?.[j++];
    out[s.toLowerCase()] = d?.status === 'success' ? Number(d.result) : 18;
  });
  return out;
}
