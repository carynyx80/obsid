export type SaleType = 'ICO' | 'IDO' | 'PRESALE' | 'IPO';
export type SaleStatus = 'upcoming' | 'bidding' | 'reveal' | 'settled' | 'failed';
export type Heat = 'cold' | 'warm' | 'hot' | 'on fire';
export interface Host { id: string; name: string; slug: string; logo: string; banner?: string; bio: string; wallet: string; verified: boolean; links: { website?: string; x?: string; telegram?: string; discord?: string; docs?: string }; team: { name: string; role: string }[] }
export interface Sale { id: string; hostId: string; type: SaleType; tokenName: string; tokenSymbol: string; tokenAddress: string; supply: number; minPrice: number; hardCapBnb: number; softCapBnb: number; start: string; end: string; revealEnd: string; status: SaleStatus; totalCommittedBnb: number; bidCount: number; heat: Heat; clearingPrice?: number; escrow: { atClosePct: number; milestones: { label: string; pct: number; released: boolean }[] }; summary: string; contractAddress?: string }
