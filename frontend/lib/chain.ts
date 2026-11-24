// Onchain layer: real ABIs (from lib/contracts/*.json, exported by contracts/scripts/export-abis.sh),
// the contract address registry (GET /api/config with NEXT_PUBLIC_* fallbacks) and shared sale math.
'use client';
import { useQuery } from '@tanstack/react-query';
import { encodePacked, erc20Abi, keccak256, parseEther, parseUnits, toHex, type Abi, type Address, type Hex } from 'viem';
import { bsc } from 'wagmi/chains';
import SaleFactoryJson from '@/lib/contracts/SaleFactory.json';
import SealedBidSaleJson from '@/lib/contracts/SealedBidSale.json';
import MilestoneEscrowJson from '@/lib/contracts/MilestoneEscrow.json';
import VestingVaultJson from '@/lib/contracts/VestingVault.json';
import ParticipationBadgeJson from '@/lib/contracts/ParticipationBadge.json';
import AllocationMarketJson from '@/lib/contracts/AllocationMarket.json';
import LiquidityLockerJson from '@/lib/contracts/LiquidityLocker.json';
import ObsidStakingJson from '@/lib/contracts/ObsidStaking.json';
import { API } from '@/lib/api';

export const CHAIN_ID = bsc.id; // 56, BNB Smart Chain mainnet
export const BSCSCAN = 'https://bscscan.com';
export const txUrl = (h: string) => `${BSCSCAN}/tx/${h}`;
export const addressUrl = (a: string) => `${BSCSCAN}/address/${a}`;

export const SALE_FACTORY_ABI = SaleFactoryJson.abi as Abi;
export const SEALED_BID_SALE_ABI = SealedBidSaleJson.abi as Abi;
export const MILESTONE_ESCROW_ABI = MilestoneEscrowJson.abi as Abi;
export const VESTING_VAULT_ABI = VestingVaultJson.abi as Abi;
export const PARTICIPATION_BADGE_ABI = ParticipationBadgeJson.abi as Abi;
export const ALLOCATION_MARKET_ABI = AllocationMarketJson.abi as Abi;
export const LIQUIDITY_LOCKER_ABI = LiquidityLockerJson.abi as Abi;
export const OBSID_STAKING_ABI = ObsidStakingJson.abi as Abi;
export { erc20Abi };

export const ARTIFACTS = {
  VestingVault: VestingVaultJson,
  ParticipationBadge: ParticipationBadgeJson,
  AllocationMarket: AllocationMarketJson,
  LiquidityLocker: LiquidityLockerJson,
  SealedBidSale: SealedBidSaleJson,
  MilestoneEscrow: MilestoneEscrowJson,
  SaleFactory: SaleFactoryJson,
  ObsidStaking: ObsidStakingJson,
} as const;

/* ---------------------------------------------------------------- registry */

export const CONTRACT_NAMES = [
  'SaleFactory', 'SealedBidSaleImpl', 'MilestoneEscrowImpl', 'VestingVault', 'ParticipationBadge', 'AllocationMarket', 'LiquidityLocker', 'ObsidStaking',
] as const;
export type ContractName = (typeof CONTRACT_NAMES)[number];
export type ContractRegistry = Partial<Record<ContractName, Address>>;

export const isAddr = (v: unknown): v is Address => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const envAddr = (v: string | undefined) => (isAddr(v) ? v : undefined);

/** NEXT_PUBLIC_* fallbacks. Must be referenced literally so Next inlines them. */
export const ENV_CONTRACTS: ContractRegistry = {
  SaleFactory: envAddr(process.env.NEXT_PUBLIC_SALE_FACTORY),
  SealedBidSaleImpl: envAddr(process.env.NEXT_PUBLIC_SEALED_BID_SALE_IMPL),
  MilestoneEscrowImpl: envAddr(process.env.NEXT_PUBLIC_MILESTONE_ESCROW_IMPL),
  VestingVault: envAddr(process.env.NEXT_PUBLIC_VESTING_VAULT),
  ParticipationBadge: envAddr(process.env.NEXT_PUBLIC_PARTICIPATION_BADGE),
  AllocationMarket: envAddr(process.env.NEXT_PUBLIC_ALLOCATION_MARKET),
  LiquidityLocker: envAddr(process.env.NEXT_PUBLIC_LIQUIDITY_LOCKER),
  ObsidStaking: envAddr(process.env.NEXT_PUBLIC_OBSID_STAKING),
};

export async function fetchContracts(): Promise<ContractRegistry> {
  let remote: ContractRegistry = {};
  if (API) {
    try {
      const r = await fetch(`${API}/api/config`, { cache: 'no-store' });
      if (r.ok) {
        const j = (await r.json()) as { chainId?: number; contracts?: Record<string, unknown> };
        if (!j.chainId || j.chainId === CHAIN_ID) {
          for (const n of CONTRACT_NAMES) if (isAddr(j.contracts?.[n])) remote[n] = j.contracts![n] as Address;
        }
      }
    } catch {
      remote = {};
    }
  }
  const out: ContractRegistry = {};
  for (const n of CONTRACT_NAMES) {
    const v = remote[n] ?? ENV_CONTRACTS[n];
    if (v) out[n] = v;
  }
  return out;
}

export const CONTRACTS_QUERY_KEY = ['obsid', 'contracts'] as const;

/** Contract addresses from the backend registry, falling back to NEXT_PUBLIC_* env vars per key. */
export function useContracts() {
  const q = useQuery({ queryKey: CONTRACTS_QUERY_KEY, queryFn: fetchContracts, staleTime: 60_000 });
  return { contracts: q.data ?? ENV_CONTRACTS, isLoading: q.isLoading, refetch: q.refetch };
}

/* ---------------------------------------------------------------- sale math */

const ONE = 10n ** 18n;
export const ceilDiv = (a: bigint, b: bigint) => (a === 0n ? 0n : (a - 1n) / b + 1n);

/** price(tick) = minPrice + tick * tickSize, in wei of BNB per 1e18 token base units (SealedBidSale.priceAt). */
export const priceAtTick = (minPrice: bigint, tickSize: bigint, tick: number | bigint) => minPrice + BigInt(tick) * tickSize;

/** BNB wei per one whole token (10^decimals base units) for a contract price (wei per 1e18 base units). */
export const pricePerWholeToken = (price: bigint, decimals: number) => (price * 10n ** BigInt(decimals)) / ONE;

/** Contract price (wei per 1e18 base units) from a human BNB per whole token price. */
export const contractPriceFromBnb = (bnbPerToken: string | number, decimals: number) => {
  const perToken = parseEther(String(bnbPerToken)); // wei per 10^decimals units
  return (perToken * ONE) / 10n ** BigInt(decimals);
};

/** Deposit the reveal requires: ceil(price(tick) * amount / 1e18) (SealedBidSale.reveal). */
export const requiredDeposit = (price: bigint, amount: bigint) => ceilDiv(price * amount, ONE);

/** commitment = keccak256(abi.encodePacked(uint256 priceTick, uint256 amount, bytes32 salt, address bidder)) */
export function computeCommitment(priceTick: bigint, amount: bigint, salt: Hex, bidder: Address): Hex {
  return keccak256(encodePacked(['uint256', 'uint256', 'bytes32', 'address'], [priceTick, amount, salt, bidder]));
}

export function randomSalt(): Hex {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return toHex(b);
}

export const toTokenUnits = (amount: string, decimals: number) => parseUnits(amount || '0', decimals);

/**
 * Default tick grid used when the admin creates a sale from an application: ticks start at the
 * application floor price and climb evenly to hardCap / supply, so maxRaise == hard cap (rounded down).
 */
export function defaultTickGrid(p: { minPriceBnb: number; hardCapBnb: number; supply: number; decimals: number; numTicks?: number }) {
  const minPrice = contractPriceFromBnb(p.minPriceBnb, p.decimals);
  const supplyUnits = parseUnits(String(p.supply), p.decimals);
  const hardCap = parseEther(String(p.hardCapBnb));
  // max price (wei per 1e18 units) such that supply * maxPrice / 1e18 <= hardCap
  const maxPrice = supplyUnits > 0n ? (hardCap * ONE) / supplyUnits : minPrice;
  let numTicks = Math.max(1, Math.min(200, Math.floor(p.numTicks ?? 50)));
  if (maxPrice <= minPrice) numTicks = 1;
  const tickSize = numTicks > 1 ? (maxPrice - minPrice) / BigInt(numTicks - 1) : 0n;
  if (numTicks > 1 && tickSize === 0n) return { minPrice, tickSize: 0n, numTicks: 1 };
  return { minPrice, tickSize, numTicks };
}

/** Sale state enum of SealedBidSale. */
export const SALE_STATE = ['Pending', 'Succeeded', 'Failed'] as const;
export type SaleState = (typeof SALE_STATE)[number];
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/** First line of a viem / wallet error. */
export function errMsg(e: unknown): string {
  const x = e as { shortMessage?: string; message?: string };
  return (x?.shortMessage || x?.message || 'Transaction failed').split('\n')[0].slice(0, 220);
}
