// Contract ABIs and addresses. Swap in generated ABIs from lib/contracts when deployed.
import type { Abi, Address } from 'viem';

const env = (k: string | undefined) => (k && /^0x[0-9a-fA-F]{40}$/.test(k) ? (k as Address) : undefined);
export const VESTING_VAULT = env(process.env.NEXT_PUBLIC_VESTING_VAULT);
export const ALLOCATION_MARKET = env(process.env.NEXT_PUBLIC_ALLOCATION_MARKET);

export const vestingAbiPlaceholder = [
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }], outputs: [] },
] as const satisfies Abi;

export const marketAbi = [
  { type: 'function', name: 'list', stateMutability: 'nonpayable', inputs: [{ name: 'sale', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'price', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'buy', stateMutability: 'payable', inputs: [{ name: 'listingId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'cancel', stateMutability: 'nonpayable', inputs: [{ name: 'listingId', type: 'uint256' }], outputs: [] },
] as const satisfies Abi;
