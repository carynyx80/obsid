'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import HeatGauge from '@/components/ui/HeatGauge';
import BidPanel from '@/components/core/BidPanel';
import Countdown from '@/components/core/Countdown';
import Reveal from '@/components/core/Reveal';
import { countdownLabel, countdownTarget, fmt, statusCls, statusLabel, typeLabel } from '@/components/core/format';
import { saleAddress } from '@/components/core/contracts';
import { fetchHosts, fetchSales } from '@/lib/api';
import type { Host, Sale } from '@/lib/types';

const d = (s: string) => new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';

export default function SalePage({ params }: { params: { id: string } }) {
  const [sale, setSale] = useState<Sale | null | undefined>(undefined);
  const [host, setHost] = useState<Host | undefined>();
  useEffect(() => {
    Promise.all([fetchSales(), fetchHosts()]).then(([ss, hs]) => {
      const s = ss.find((x) => x.id === params.id) ?? null;
      setSale(s);
      if (s) setHost(hs.find((h) => h.id === s.hostId));
    });
  }, [params.id]);

  if (sale === undefined) return <AppShell><div className="mx-auto max-w-7xl px-4 py-20 sm:px-8"><div className="h-96 animate-pulse rounded-[2rem] bg-chalk" /></div></AppShell>;
  if (sale === null) return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-8">
        <h1 className="font-display text-5xl font-extrabold">Sale not <span className="font-serif font-normal italic">found.</span></h1>
        <div className="mt-8"><Button href="/app/menu">Back to menu</Button></div>
      </div>
    </AppShell>
  );

  const target = countdownTarget(sale);
  const pct = Math.min(100, (sale.totalCommittedBnb / sale.hardCapBnb) * 100);
  const addr = saleAddress(sale);
  const listHref = sale.type === 'PRESALE' ? '/app/presale' : sale.type === 'IDO' ? '/app/ido' : sale.type === 'IPO' ? '/app/ipo' : '/app/ico';
  const terms: [string, string][] = [
    ['Supply for sale', `${fmt(sale.supply, 0)} ${sale.tokenSymbol}`],
    ['Floor price', `${sale.minPrice} BNB`],
    ['Soft cap', `${fmt(sale.softCapBnb, 0)} BNB`],
    ['Hard cap', `${fmt(sale.hardCapBnb, 0)} BNB`],
    ['Bidding opens', d(sale.start)],
    ['Bidding closes', d(sale.end)],
    ['Reveal ends', d(sale.revealEnd)],
    ['Token', `${sale.tokenAddress.slice(0, 8)}…${sale.tokenAddress.slice(-6)}`],
  ];

  return (
    <AppShell>
      <section className="relative mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12">
        <Link href={listHref} className="font-label text-xs font-bold uppercase tracking-wider text-ink-mute hover:text-ink">← All {typeLabel[sale.type]} sales</Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-12">
          {/* PUBLIC */}
          <div className="space-y-6 lg:col-span-7">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="relative overflow-hidden rounded-[2.5rem] bg-lemon p-7 sm:p-10">
              <div aria-hidden className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-paper/50" />
              <div className="relative flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink px-3 py-1 font-label text-[10px] font-extrabold uppercase tracking-wider text-lemon">{typeLabel[sale.type]}</span>
                <span className={`rounded-full px-3 py-1 font-label text-[10px] font-extrabold uppercase tracking-wider ${statusCls[sale.status]}`}>{statusLabel[sale.status]}</span>
                <span className="rounded-full bg-paper/70 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-wider">Public</span>
              </div>
              <h1 className="relative mt-6 font-display text-6xl font-extrabold leading-[0.88] tracking-tight sm:text-8xl">{sale.tokenSymbol}</h1>
              <p className="relative font-serif text-3xl italic">{sale.tokenName}</p>
              <p className="relative mt-4 max-w-lg font-body text-ink-soft">{sale.summary}</p>
              <div className="relative mt-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink/60">{countdownLabel(sale)}</p>
                  {target ? <Countdown to={target} big /> : <p className="font-mono text-3xl">{sale.clearingPrice ? `${sale.clearingPrice} BNB` : 'Final'}</p>}
                </div>
                <span className="font-mono text-[11px] text-ink/60">{addr ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : 'Contract deploys at launch'}</span>
              </div>
            </motion.div>

            {host && (
              <Reveal>
                <Link href={`/app/host/${host.slug}`} className="group flex items-center gap-5 rounded-[2rem] bg-paper p-6 ring-1 ring-ink/10 transition hover:ring-ink">
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-ink font-display text-2xl font-extrabold text-lemon">{host.logo}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">Hosted publicly by</p>
                    <p className="font-display text-2xl font-extrabold">{host.name}{host.verified && <span className="ml-2 align-middle font-label text-[10px] font-bold uppercase tracking-wider text-ink-mute">verified</span>}</p>
                    <p className="truncate font-body text-sm text-ink-soft">{host.bio}</p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lemon transition-transform group-hover:-rotate-45">→</span>
                </Link>
              </Reveal>
            )}

            <Reveal className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[2rem] bg-ink p-6 text-paper">
                <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-lemon">Total committed</p>
                <p className="mt-2 font-mono text-4xl">{fmt(sale.totalCommittedBnb, 2)}</p>
                <p className="font-mono text-xs text-paper/50">BNB of {fmt(sale.hardCapBnb, 0)} hard cap</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper/10">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full bg-lemon" />
                </div>
                <p className="mt-4 font-mono text-sm">{fmt(sale.bidCount, 0)} <span className="font-body text-paper/60">sealed bids</span></p>
              </div>
              <div className="rounded-[2rem] bg-chalk p-6">
                <HeatGauge heat={sale.heat} />
              </div>
            </Reveal>

            <Reveal className="rounded-[2rem] bg-paper p-6 ring-1 ring-ink/10 sm:p-8">
              <h2 className="font-display text-2xl font-extrabold">Terms</h2>
              <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {terms.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-3">
                    <dt className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">{k}</dt>
                    <dd className="text-right font-mono text-sm">{v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal className="rounded-[2rem] bg-paper p-6 ring-1 ring-ink/10 sm:p-8">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl font-extrabold">Escrow <span className="font-serif font-normal italic">milestones</span></h2>
                <span className="font-body text-xs text-ink-mute">Refunds if soft cap is missed</span>
              </div>
              <ol className="relative mt-6 space-y-5 border-l-2 border-ink/10 pl-6">
                {[{ label: 'Released at close', pct: sale.escrow.atClosePct, released: sale.status === 'settled' }, ...sale.escrow.milestones].map((m) => (
                  <li key={m.label} className="relative">
                    <span className={`absolute -left-[33px] top-1 h-4 w-4 rounded-full ring-4 ring-paper ${m.released ? 'bg-lemon ring-offset-0' : 'bg-ink/15'}`} />
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-body">{m.label}</span>
                      <span className="flex items-center gap-3">
                        <span className="font-mono text-sm">{m.pct}%</span>
                        <span className={`rounded-full px-2.5 py-0.5 font-label text-[9px] font-extrabold uppercase tracking-wider ${m.released ? 'bg-lemon ring-1 ring-ink/20' : 'bg-chalk text-ink-mute'}`}>{m.released ? 'Released' : 'Locked'}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>

          {/* BID */}
          <div className="lg:col-span-5">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="lg:sticky lg:top-24">
              <BidPanel sale={sale} />
            </motion.div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
