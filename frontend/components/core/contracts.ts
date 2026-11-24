// SealedBidSale wiring for the sale page. ABIs and math live in lib/chain.ts (real contract artifacts).
import type { Address, Hex } from 'viem';
import type { Sale } from '@/lib/types';
export {
  SEALED_BID_SALE_ABI, MILESTONE_ESCROW_ABI, computeCommitment, randomSalt, requiredDeposit, priceAtTick, pricePerWholeToken,
} from '@/lib/chain';

/** The sale's deployed SealedBidSale clone, if the backend provides one. */
export function saleAddress(sale: Sale): Address | null {
  const s = sale as Sale & { contractAddress?: string; saleAddress?: string; address?: string };
  const a = s.contractAddress || s.saleAddress || s.address;
  return a && /^0x[0-9a-fA-F]{40}$/.test(a) ? (a as Address) : null;
}

/**
 * Everything a bidder needs to reveal. `tick` and `amountUnits` are exactly what goes into
 * reveal(priceTick, amount, salt). `price` / `amount` are human readable (BNB per token, tokens).
 */
export type BidSecret = {
  v: 2;
  saleId: string;
  sale?: Address;
  bidder: Address;
  tick: number;
  amountUnits: string;
  decimals: number;
  price: string;
  amount: string;
  salt: Hex;
  commitment: Hex;
  deposit: string;
  createdAt: string;
  revealed?: boolean;
};
export const secretKey = (saleId: string, addr: string) => `obsid.bid.${saleId}.${addr.toLowerCase()}`;

export function saveSecret(s: BidSecret) {
  try { localStorage.setItem(secretKey(s.saleId, s.bidder), JSON.stringify(s)); } catch {}
}
export function loadSecret(saleId: string, addr: string): BidSecret | null {
  try { const r = localStorage.getItem(secretKey(saleId, addr)); return r ? (JSON.parse(r) as BidSecret) : null; } catch { return null; }
}
export const isV2Secret = (s: unknown): s is BidSecret =>
  !!s && typeof s === 'object' && (s as BidSecret).v === 2 && typeof (s as BidSecret).tick === 'number' && typeof (s as BidSecret).amountUnits === 'string';

export function downloadSecret(s: BidSecret) {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `obsid-bid-${s.saleId}-${s.bidder.slice(2, 8)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
