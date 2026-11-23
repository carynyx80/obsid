'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Host, Sale } from '@/lib/types';
import HeatGauge from '@/components/ui/HeatGauge';
import Countdown from './Countdown';
import { countdownLabel, countdownTarget, fmt, statusCls, statusLabel, typeLabel } from './format';

export default function SaleCard({ sale, host, i = 0 }: { sale: Sale; host?: Host; i?: number }) {
  const target = countdownTarget(sale);
  const pct = Math.min(100, (sale.totalCommittedBnb / sale.hardCapBnb) * 100);
  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: (i % 3) * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="group relative flex flex-col overflow-hidden rounded-[2rem] bg-paper ring-1 ring-ink/5 shadow-[0_20px_60px_-35px_rgba(11,15,5,0.35)]"
    >
      <div className="relative flex items-start justify-between gap-3 bg-chalk p-6 pb-10">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink font-display text-xl font-extrabold text-lemon">{host?.logo ?? '?'}</span>
          <div>
            {host ? (
              <Link href={`/app/host/${host.slug}`} className="relative z-10 font-label text-sm font-bold uppercase tracking-wide hover:underline hover:decoration-lemon hover:decoration-4">
                {host.name}{host.verified && <span className="ml-1 text-ink-mute">✓</span>}
              </Link>
            ) : <span className="font-label text-sm font-bold uppercase">Unknown host</span>}
            <p className="font-body text-xs text-ink-mute">Public host</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 font-label text-[10px] font-extrabold uppercase tracking-wider ${statusCls[sale.status]}`}>{statusLabel[sale.status]}</span>
      </div>
      <Link href={`/app/sale/${sale.id}`} className="flex flex-1 flex-col p-6 pt-0">
        <div className="-mt-6 flex items-end justify-between gap-3">
          <h3 className="font-display text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">{sale.tokenSymbol}</h3>
          <span className="rounded-full bg-lemon px-3 py-1 font-label text-[10px] font-extrabold uppercase tracking-wider ring-1 ring-ink/20">{typeLabel[sale.type]}</span>
        </div>
        <p className="mt-1 font-serif text-lg italic text-ink-soft">{sale.tokenName}</p>
        <p className="mt-2 line-clamp-2 font-body text-sm text-ink-mute">{sale.summary}</p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">Committed</p>
            <p className="mt-1 font-mono text-lg">{fmt(sale.totalCommittedBnb, 1)} <span className="text-xs text-ink-mute">BNB</span></p>
          </div>
          <div>
            <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">Sealed bids</p>
            <p className="mt-1 font-mono text-lg">{fmt(sale.bidCount, 0)}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
          <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full bg-ink" />
        </div>
        <p className="mt-1 font-mono text-[10px] text-ink-mute">of {fmt(sale.hardCapBnb, 0)} BNB hard cap</p>

        <div className="mt-6"><HeatGauge heat={sale.heat} compact /></div>

        <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-4">
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">{countdownLabel(sale)}</span>
          {target ? <Countdown to={target} /> : <span className="font-mono text-sm text-ink-mute">{sale.clearingPrice ? `${sale.clearingPrice} BNB clearing` : 'Final'}</span>}
        </div>
      </Link>
    </motion.article>
  );
}
