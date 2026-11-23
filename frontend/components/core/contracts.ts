// Contract wiring for SealedBidSale.
// When the contracts agent writes lib/contracts/SealedBidSale.json ({ abi, bytecode }), swap the
// placeholder below for:   import SealedBidSale from '@/lib/contracts/SealedBidSale.json';
//                          export const SEALED_BID_ABI = SealedBidSale.abi as Abi;
// (A static JSON import cannot be made conditional without breaking the build while the file is missing.)
import { encodePacked, keccak256, parseEther, parseUnits, toHex, type Abi, type Address, type Hex } from 'viem';
import type { Sale } from '@/lib/types';

export const SEALED_BID_ABI = [
  { type: 'function', name: 'commit', stateMutability: 'payable', inputs: [{ name: 'commitment', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'reveal', stateMutability: 'nonpayable', inputs: [{ name: 'price', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'salt', type: 'bytes32' }], outputs: [] },
] as const satisfies Abi;

export const TOKEN_DECIMALS = 18;

/** The sale's deployed contract, if the backend provides one. */
export function saleAddress(sale: Sale): Address | null {
  const s = sale as Sale & { contractAddress?: string; saleAddress?: string; address?: string };
  const a = s.contractAddress || s.saleAddress || s.address;
  return a && /^0x[0-9a-fA-F]{40}$/.test(a) ? (a as Address) : null;
}

export function randomSalt(): Hex {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return toHex(b);
}

/** price: BNB per whole token (18 dp, wei). amount: token base units (18 dp). */
export function toUnits(priceBnb: string, amountTokens: string) {
  return { price: parseEther(priceBnb || '0'), amount: parseUnits(amountTokens || '0', TOKEN_DECIMALS) };
}

/** commitment = keccak256(abi.encodePacked(price, amount, salt, bidder)) */
export function computeCommitment(price: bigint, amount: bigint, salt: Hex, bidder: Address): Hex {
  return keccak256(encodePacked(['uint256', 'uint256', 'bytes32', 'address'], [price, amount, salt, bidder]));
}

/** Cost in wei = price * amount / 10^decimals */
export const bidCost = (price: bigint, amount: bigint) => (price * amount) / 10n ** BigInt(TOKEN_DECIMALS);

export type BidSecret = { saleId: string; bidder: Address; price: string; amount: string; salt: Hex; commitment: Hex; deposit: string; createdAt: string };
export const secretKey = (saleId: string, addr: string) => `obsid.bid.${saleId}.${addr.toLowerCase()}`;

export function saveSecret(s: BidSecret) {
  try { localStorage.setItem(secretKey(s.saleId, s.bidder), JSON.stringify(s)); } catch {}
}
export function loadSecret(saleId: string, addr: string): BidSecret | null {
  try { const r = localStorage.getItem(secretKey(saleId, addr)); return r ? (JSON.parse(r) as BidSecret) : null; } catch { return null; }
}
export function downloadSecret(s: BidSecret) {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `obsid-bid-${s.saleId}-${s.bidder.slice(2, 8)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
