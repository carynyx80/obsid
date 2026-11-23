'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import Mock, { type MockKind } from './Mocks';

type Step = { title: string; body: string; tip?: string; mock: MockKind };

const hostSteps: Step[] = [
  {
    title: 'Sign in as a host',
    body: 'Open the app and choose Host on the sign in screen. Hosts are public by design: everything you set up here becomes part of a profile buyers can review before they bid.',
    mock: 'roleHost',
  },
  {
    title: 'Connect your project wallet',
    body: 'Connect the wallet that will act for your project on BNB Smart Chain mainnet. Use a wallet your team controls long term, ideally a multisig, because this address signs applications and receives escrow releases.',
    tip: 'Changing this wallet later sends your profile back for re approval.',
    mock: 'wallet',
  },
  {
    title: 'Build your public profile',
    body: 'Add your project name, logo, website, socials, team, token details and payout wallet. Be thorough and accurate. Buyers use this page to decide whether to trust you, and the admin uses it to review your application.',
    mock: 'profile',
  },
  {
    title: 'Apply for a sale',
    body: 'Choose ICO, IDO or Presale, then set supply, price ticks, soft cap, hard cap, per wallet limits, escrow upfront percentage, milestones, vesting and optional BABT gating. IPO appears as coming soon and cannot be selected yet.',
    tip: 'The platform fee for your sale is shown before you submit.',
    mock: 'apply',
  },
  {
    title: 'Wait for admin approval',
    body: 'The platform admin reviews your profile and application. You can follow the status in your dashboard. Once approved, the SaleFactory deploys your sale contracts with the exact terms you submitted, and they cannot be changed afterwards.',
    tip: 'Editing your name or payout wallet later puts the profile back into review.',
    mock: 'approval',
  },
  {
    title: 'Run your sale',
    body: 'When bidding opens, share your sale page. You see the same public aggregates as everyone else: number of bids, total committed, the demand gauge and the countdown. Individual bids stay sealed, even from you. After the reveal window, anyone can settle and the clearing price is published.',
    mock: 'runSale',
  },
  {
    title: 'Escrow and milestones',
    body: 'At settlement, the upfront percentage is released to your payout wallet. The rest stays in MilestoneEscrow. When you hit a milestone, submit evidence from your dashboard; once the admin approves, that tranche is released. For IDOs, liquidity is paired and locked automatically.',
    tip: 'If you go silent, buyers can vote to refund the remaining escrow.',
    mock: 'escrow',
  },
  {
    title: 'Fund vesting and go live',
    body: 'Deposit the sold tokens into the VestingVault before the claim date. Buyers then claim on the cliff plus linear schedule you published. Keep posting milestone updates on your profile so your community can follow along.',
    mock: 'vestingSetup',
  },
];

const buyerSteps: Step[] = [
  {
    title: 'Sign in as a buyer',
    body: 'Choose Buyer on the sign in screen. Buyers have no public profile, only a private dashboard built in your browser from onchain data. Obsid does not ask for an email and stores nothing about you.',
    mock: 'roleBuyer',
  },
  {
    title: 'Connect on BNB Smart Chain mainnet',
    body: 'Connect a wallet and make sure it is on BNB Smart Chain, chain ID 56. The app will prompt you to switch if needed. For extra privacy, consider bidding from a wallet that is not linked to your identity.',
    tip: 'You need BNB for your deposit plus a little for gas.',
    mock: 'walletChain',
  },
  {
    title: 'Browse ICOs, IDOs and Presales',
    body: 'Filter live and upcoming sales by type. Every host has a public profile with its terms, escrow milestones and vesting schedule. The demand gauge shows whether a sale is cold, warm, hot or on fire, computed from public totals only.',
    mock: 'browse',
  },
  {
    title: 'Place a private bid and save your secret',
    body: 'Pick a maximum price on one of the ticks and a quantity. Optionally deposit more BNB than your bid to mask its size. The app creates a random secret and sends only a hash with your deposit. Download the secret backup and keep it safe: without it you cannot reveal.',
    tip: 'Your secret is stored on this device and in the backup file only. Obsid never sees it.',
    mock: 'bid',
  },
  {
    title: 'Reveal before the deadline',
    body: 'When bidding closes, the reveal window opens. Return to the sale and press Reveal. The app loads your secret and the contract checks it against your commitment. Bids that are not revealed in time are excluded from the auction.',
    tip: 'Set a reminder for the reveal window as soon as you bid.',
    mock: 'reveal',
  },
  {
    title: 'Claim your tokens',
    body: 'After settlement, your dashboard shows your allocation at the clearing price and any refund of unused deposit. Withdraw your refund right away, then claim tokens as they vest on the cliff plus linear schedule.',
    mock: 'claim',
  },
  {
    title: 'Claim to a fresh wallet',
    body: 'On any claim, you can enter a different address you control. Tokens go there instead of to the bidding wallet, breaking the visible link between where you bid and where you hold.',
    tip: 'Double check the address. Tokens sent to a wrong address cannot be recovered.',
    mock: 'fresh',
  },
  {
    title: 'Trade allocations before launch',
    body: 'Need to exit early, or missed the auction? The allocation market lets you list or buy unclaimed allocations for BNB. The contract swaps both sides atomically. In v1 the trade price is visible onchain.',
    mock: 'trade',
  },
  {
    title: 'Share your badge',
    body: 'Every valid participant receives a non transferable proof of participation badge. It proves you were in the sale without revealing amounts, prices or whether you won. Share it with communities or future reward programs.',
    mock: 'badge',
  },
];

export default function HowToTabs() {
  const [tab, setTab] = useState<'host' | 'buyer'>('buyer');
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#hosts') setTab('host');
  }, []);
  const steps = tab === 'host' ? hostSteps : buyerSteps;

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-4 bg-paper/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Guide track" className="relative mx-auto grid w-full max-w-md grid-cols-2 rounded-full border border-frost bg-chalk p-1">
          {(['buyer', 'host'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="relative z-10 rounded-full py-2.5 font-label text-sm font-bold"
            >
              {tab === t && (
                <motion.span layoutId="tabpill" className="absolute inset-0 -z-10 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
              )}
              <span className={tab === t ? 'text-lemon' : 'text-ink-soft'}>{t === 'host' ? 'For hosts' : 'For buyers'}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center font-serif text-xl italic text-ink-mute sm:text-2xl">
        {tab === 'host'
          ? 'You launch in public. Here is how to get approved and run a sale buyers can trust.'
          : 'You bid in private. Here is how to place a sealed bid and keep your strategy to yourself.'}
      </p>

      <AnimatePresence mode="wait">
        <motion.ol
          key={tab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="mt-10 grid gap-5 md:grid-cols-2"
        >
          {steps.map((s, i) => (
            <li key={s.title} className="group flex flex-col rounded-3xl border border-frost bg-paper p-5 transition hover:border-ink/30 hover:shadow-[0_12px_40px_-20px_rgba(11,15,5,0.35)] sm:p-6">
              <div className="flex items-start gap-4">
                <span className="font-display text-5xl font-extrabold leading-none tracking-tighter text-lemon [-webkit-text-stroke:1.2px_#0B0F05]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 pt-1">
                  <h3 className="font-display text-lg font-semibold leading-snug tracking-tight">{s.title}</h3>
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
              {s.tip && (
                <p className="mt-3 rounded-xl bg-lemon-soft px-3 py-2 text-[13px] text-ink">
                  <span className="font-label font-bold">Tip: </span>
                  {s.tip}
                </p>
              )}
              <div className="mt-5 flex-1" />
              <Mock kind={s.mock} />
            </li>
          ))}
        </motion.ol>
      </AnimatePresence>
    </div>
  );
}
