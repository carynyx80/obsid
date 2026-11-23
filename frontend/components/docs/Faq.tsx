'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

const faqs: [string, string][] = [
  ['What is a sealed bid?', 'A bid nobody can read while bidding is open. You send a cryptographic hash of your price, quantity and a random secret, plus a BNB deposit. After bidding closes you reveal the real values and the contract checks they match the hash.'],
  ['Why would I deposit more than my bid?', 'Deposits are visible onchain. By depositing more than your bid, you hide the real size inside a larger number. Everything you did not spend is refunded after settlement.'],
  ['How is the clearing price decided?', 'The contract adds up demand from the highest price tick downward. The first tick where demand covers the full supply becomes the clearing price. Everyone who wins pays that same price, even if they bid higher.'],
  ['What happens if I bid at exactly the clearing price?', 'Bids at the clearing tick share whatever supply is left after higher bids are filled, in proportion to how much each asked for. You receive a pro rata fill and a refund for the rest.'],
  ['What if I lose my secret?', 'You will not be able to reveal, so your bid will not count. Your deposit remains refundable after the sale, but you lose your chance to win an allocation. Always download the backup file when you bid.'],
  ['What if I miss the reveal deadline?', 'Unrevealed bids are excluded from the auction. Your deposit becomes refundable, possibly minus a small non reveal penalty if the sale specified one on its page.'],
  ['Can the host or Obsid see my bid?', 'Not while bidding is open. Only the hash is stored. In version one, bids become public onchain when they are revealed, after which the auction is already decided. Version two will use FHE so bids are never revealed in plaintext.'],
  ['Does Obsid store any of my data?', 'No. Buyers have no account on our backend. Your dashboard is built in your browser from onchain data, and your secret lives only on your device and in your backup file.'],
  ['What stops a project from running away with the money?', 'Funds go to a milestone escrow. Only an upfront percentage reaches the host at close. The rest is released milestone by milestone after admin approval. IDO liquidity is locked automatically, and buyers can vote to refund what remains if a host disappears.'],
  ['Do I need KYC?', 'Only if the host enables BABT gating. In that case your bidding wallet must hold a Binance Account Bound Token, which proves you completed Binance verification. Obsid never sees your documents.'],
  ['Why claim to a fresh wallet?', 'Claiming to a new address you control separates the wallet that bid from the wallet that holds the tokens, making it much harder to link your activity together.'],
  ['Is the allocation market private?', 'The app does not publish an order book or link trades to profiles, but in version one the trade price is visible onchain to anyone who inspects the transaction.'],
  ['What does the participation badge reveal?', 'Only that your wallet took part in a specific sale. It contains no amounts, prices or allocation details, and it cannot be transferred.'],
  ['Which network does Obsid use?', 'BNB Smart Chain mainnet, chain ID 56. Bids, deposits and refunds are in BNB.'],
  ['What fees are there?', 'A platform fee on funds raised, set per sale and shown on the sale page before it launches. Buyers pay the clearing price plus normal network gas, and unused deposits are refunded in full.'],
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-frost overflow-hidden rounded-3xl border border-frost bg-paper">
      {faqs.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={q}>
            <button
              onClick={() => setOpen(on ? null : i)}
              aria-expanded={on}
              className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-chalk sm:px-7"
            >
              <span className="font-display text-base font-semibold tracking-tight sm:text-lg">{q}</span>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${on ? 'rotate-45 bg-lemon' : 'bg-chalk'}`}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M6 1v10M1 6h10" stroke="#0B0F05" strokeWidth="2" strokeLinecap="round" /></svg>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-6 text-[15px] leading-relaxed text-ink-soft sm:px-7 sm:text-base">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
