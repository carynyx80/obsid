// Real contract ABIs for the buyer pages (claim, trade). Addresses come from useContracts() in lib/chain.ts
// (backend GET /api/config, falling back to NEXT_PUBLIC_* env vars).
export { ALLOCATION_MARKET_ABI, VESTING_VAULT_ABI, SEALED_BID_SALE_ABI, MILESTONE_ESCROW_ABI, useContracts } from '@/lib/chain';
