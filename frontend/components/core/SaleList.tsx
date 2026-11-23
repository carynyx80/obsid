'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import { fetchHosts, fetchSales } from '@/lib/api';
import type { Host, Sale, SaleStatus, SaleType } from '@/lib/types';
import SaleCard from './SaleCard';
import { fmt } from './format';

const filters: { k: 'all' | SaleStatus; l: string }[] = [
  { k: 'all', l: 'All' }, { k: 'bidding', l: 'Bidding' }, { k: 'reveal', l: 'Reveal' }, { k: 'upcoming', l: 'Upcoming' }, { k: 'settled', l: 'Settled' },
];

export default function SaleList({ type, title, accent, intro }: { type: SaleType; title: string; accent: string; intro: string }) {
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [f, setF] = useState<'all' | SaleStatus>('all');
  useEffect(() => { fetchSales().then(setSales); fetchHosts().then(setHosts); }, []);

  const ofType = useMemo(() => (sales ?? []).filter((s) => s.type === type), [sales, type]);
  const shown = f === 'all' ? ofType : ofType.filter((s) => s.status === f);
  const total = ofType.reduce((a, s) => a + s.totalCommittedBnb, 0);
  const bids = ofType.reduce((a, s) => a + s.bidCount, 0);

  return (
    <AppShell>
      <section className="relative mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-8 sm:pt-16">
        <div aria-hidden className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-lemon/70 blur-2xl sm:h-[28rem] sm:w-[28rem]" />
        <div className="relative grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-label text-xs font-bold uppercase tracking-[0.3em] text-ink-mute">Sealed bid sales</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="mt-2 font-display text-6xl font-extrabold leading-[0.9] tracking-tight sm:text-8xl">
              {title}<span className="font-serif font-normal italic"> {accent}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 max-w-xl font-body text-lg text-ink-soft">{intro}</motion.p>
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-2 gap-3 md:col-span-4">
            <div className="rounded-3xl bg-ink p-5 text-paper">
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-lemon">Total committed</p>
              <p className="mt-2 font-mono text-2xl">{fmt(total, 1)}</p>
              <p className="font-mono text-[10px] text-paper/50">BNB, public</p>
            </div>
            <div className="rounded-3xl bg-paper p-5 ring-1 ring-ink/10">
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">Sealed bids</p>
              <p className="mt-2 font-mono text-2xl">{fmt(bids, 0)}</p>
              <p className="font-mono text-[10px] text-ink-mute">contents hidden</p>
            </div>
          </motion.div>
        </div>

        <div className="no-scrollbar relative mt-12 flex gap-2 overflow-x-auto pb-2">
          {filters.map((x) => (
            <button key={x.k} onClick={() => setF(x.k)} className={`shrink-0 rounded-full px-4 py-2 font-label text-xs font-bold uppercase tracking-wider transition ${f === x.k ? 'bg-ink text-lemon' : 'bg-paper text-ink ring-1 ring-ink/10 hover:ring-ink/40'}`}>{x.l}</button>
          ))}
        </div>

        {sales === null ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-[30rem] animate-pulse rounded-[2rem] bg-chalk" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="mt-8 flex flex-col items-start gap-4 rounded-[2rem] bg-chalk p-10">
            <p className="font-display text-3xl font-extrabold">Nothing here <span className="font-serif font-normal italic">yet.</span></p>
            <p className="font-body text-ink-soft">No {title.toLowerCase()} match this filter. Check back soon, or host one yourself.</p>
            <Button href="/app/menu" variant="ink" size="sm">Back to menu</Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((s, i) => <SaleCard key={s.id} sale={s} host={hosts.find((h) => h.id === s.hostId)} i={i} />)}
          </div>
        )}
      </section>
    </AppShell>
  );
}
