// Domain records. Note: there is deliberately no buyer, bid or buyer-wallet record anywhere.
export type SaleType = 'ICO' | 'IDO' | 'PRESALE';
export const SALE_TYPES: SaleType[] = ['ICO', 'IDO', 'PRESALE'];
export type SaleStatus = 'upcoming' | 'bidding' | 'reveal' | 'settled' | 'failed';
export const SALE_STATUSES: SaleStatus[] = ['upcoming', 'bidding', 'reveal', 'settled', 'failed'];
export type Heat = 'cold' | 'warm' | 'hot' | 'on fire';

export interface HostLinks {
  website?: string;
  x?: string;
  telegram?: string;
  discord?: string;
  docs?: string;
}

export interface TeamMember {
  name: string;
  role: string;
}

export interface HostRecord {
  id: string;
  name: string;
  slug: string;
  logo: string;
  banner: string;
  bio: string;
  /** EIP-55 checksummed address. */
  wallet: string;
  verified: boolean;
  links: HostLinks;
  team: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Milestone {
  label: string;
  pct: number;
}

export interface ApplicationRecord {
  id: string;
  hostId: string;
  type: SaleType;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  supply: number;
  minPrice: number;
  softCapBnb: number;
  hardCapBnb: number;
  start: string;
  end: string;
  revealEnd: string;
  escrowAtClosePct: number;
  milestones: Milestone[];
  summary: string;
  status: ReviewStatus;
  rejectReason?: string;
  saleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleRecord {
  id: string;
  hostId: string;
  applicationId: string;
  type: SaleType;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  supply: number;
  minPrice: number;
  hardCapBnb: number;
  softCapBnb: number;
  start: string;
  end: string;
  revealEnd: string;
  /** Stored status. Only 'settled' and 'failed' are terminal; others are recomputed from timestamps. */
  status: SaleStatus;
  totalCommittedBnb: number;
  bidCount: number;
  clearingPrice?: number;
  escrow: { atClosePct: number; milestones: { label: string; pct: number; released: boolean }[] };
  summary: string;
  contractAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileChangeRecord {
  id: string;
  hostId: string;
  changes: { name?: string; slug?: string; wallet?: string };
  previous: { name: string; slug: string; wallet: string };
  status: ReviewStatus;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NonceRecord {
  nonce: string;
  /** lowercase address */
  address: string;
  expiresAt: Date;
}

/** Names of deployed Obsid contracts tracked in the address registry. */
export const CONTRACT_NAMES = [
  'SaleFactory',
  'SealedBidSaleImpl',
  'MilestoneEscrowImpl',
  'VestingVault',
  'ParticipationBadge',
  'AllocationMarket',
  'LiquidityLocker',
  'ObsidStaking',
] as const;
export type ContractName = (typeof CONTRACT_NAMES)[number];
/** EIP-55 checksummed addresses keyed by contract name. Missing keys are unset. */
export type ContractRegistry = Partial<Record<ContractName, string>>;
