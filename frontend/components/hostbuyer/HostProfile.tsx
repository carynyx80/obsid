'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import HeatGauge from '@/components/ui/HeatGauge';
import { fetchSales } from '@/lib/api';
import type { Host, Sale } from '@/lib/types';
import { CopyButton, Kicker, Rise, Tag, cx, ease, fmt, fmtDate } from './kit';

const LINKS: { k: keyof Host['links']; label: string }[] = [
  { k: 'website', label: 'Website' }, { k: 'x', label: 'X' }, { k: 'telegram', label: 'Telegram' }, { k: 'discord', label: 'Discord' }, { k: 'docs', label: 'Docs' },
];
const bucket = (s: Sale) => (s.status === 'upcoming' ? 'Upcoming' : s.status === 'bidding' || s.status === 'reveal' ? 'Live' : 'Past');

export default function HostProfile({ host, actions }: { host: Host; actions?: React.ReactNode }) {
  const [sales, setSales] = useState<Sale[] | null>(null);
  useEffect(() => { fetchSales().then((all) => setSales(all.filter((s) => s.hostId === host.id))); }, [host.id]);
  const raised = (sales ?? []).reduce((a, s) => a + s.totalCommittedBnb, 0);
  const isImg = /^(https?:|data:|\/)/.test(host.logo);

  return (
    <div>
      {/* banner */}
      <Rise className="relative -mx-4 h-56 overflow-hidden sm:mx-0 sm:rounded-blob md:h-80">
        {host.banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={host.banner} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grain relative h-full w-full bg-lemon">
            <motion.span
              aria-hidden
              className="absolute -bottom-8 left-4 select-none whitespace-nowrap font-display text-[7rem] font-bold leading-none text-ink/[0.09] md:text-[12rem]"
              animate={{ x: [0, -120, 0] }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            >
              {host.name} {host.name}
            </motion.span>
            <div className="absolute right-6 top-6 h-24 w-24 rounded-full border-[14px] border-ink md:h-36 md:w-36" />
          </div>
        )}
      </Rise>

      <div className="relative grid gap-10 md:grid-cols-12">
        <div className="md:col-span-7">
          <Rise delay={0.1} className="-mt-14 flex items-end gap-4 md:-mt-20">
            <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-[2rem] border-4 border-paper bg-ink font-display text-5xl font-bold text-lemon shadow-xl md:h-36 md:w-36">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {isImg ? <img src={host.logo} alt="" className="h-full w-full object-cover" /> : host.logo.slice(0, 2)}
            </div>
            <div className="pb-2">{actions}</div>
          </Rise>
          <Rise delay={0.18} className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[clamp(2.4rem,6vw,4.8rem)] font-semibold leading-[0.95] tracking-tight">{host.name}</h1>
              {host.verified && (
                <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.5, type: 'spring' }}>
                  <Tag tone="ink">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                    Verified host
                  </Tag>
                </motion.span>
              )}
            </div>
            <p className="mt-5 max-w-2xl font-body text-lg leading-relaxed text-ink-soft">{host.bio}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {LINKS.filter((l) => host.links[l.k]).map((l) => (
                <a key={l.k} href={host.links[l.k]} target="_blank" rel="noreferrer" className="rounded-full border border-ink/15 px-4 py-2 font-label text-[11px] font-semibold uppercase tracking-[0.16em] transition hover:border-ink hover:bg-lemon">
                  {l.label} ↗
                </a>
              ))}
            </div>
          </Rise>
        </div>

        <Rise delay={0.25} className="space-y-4 md:col-span-5 md:pt-10">
          <div className="rounded-3xl bg-ink p-6 text-paper">
            <Kicker className="text-lemon">Public host wallet</Kicker>
            <p className="mt-3 break-all font-mono text-[13px] leading-relaxed">{host.wallet}</p>
            <div className="mt-4 flex items-center gap-3">
              <CopyButton value={host.wallet} />
              <a href={`https://bscscan.com/address/${host.wallet}`} target="_blank" rel="noreferrer" className="font-label text-[10px] uppercase tracking-[0.18em] text-paper/60 hover:text-lemon">BscScan ↗</a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-3xl bg-lemon p-5">
              <Kicker className="text-ink">Total raised</Kicker>
              <p className="mt-2 font-mono text-2xl">{fmt(raised, 1)}<span className="ml-1 text-sm">BNB</span></p>
            </div>
            <div className="rounded-3xl border border-ink/10 p-5">
              <Kicker>Sales</Kicker>
              <p className="mt-2 font-mono text-2xl">{sales?.length ?? '·'}</p>
            </div>
          </div>
          {host.team.length > 0 && (
            <div className="rounded-3xl border border-ink/10 p-6">
              <Kicker>Team</Kicker>
              <ul className="mt-3 space-y-3">
                {host.team.map((t) => (
                  <li key={t.name} className="flex items-baseline justify-between gap-4">
                    <span className="font-body font-medium">{t.name}</span>
                    <span className="font-serif italic text-ink-mute">{t.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Rise>
      </div>

      <section className="mt-20">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
          Sales <span className="font-serif font-normal italic text-ink-mute">on the record</span>
        </h2>
        {sales === null ? (
          <div className="mt-6 h-40 animate-pulse rounded-3xl bg-chalk" />
        ) : sales.length === 0 ? (
          <p className="mt-6 font-serif text-xl italic text-ink-mute">No sales yet.</p>
        ) : (
          (['Live', 'Upcoming', 'Past'] as const).map((b) => {
            const list = sales.filter((s) => bucket(s) === b);
            if (!list.length) return null;
            return (
              <div key={b} className="mt-10">
                <Kicker>{b}</Kicker>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {list.map((s, i) => <SaleCard key={s.id} s={s} i={i} />)}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function SaleCard({ s, i }: { s: Sale; i: number }) {
  const pct = Math.min(100, (s.totalCommittedBnb / s.hardCapBnb) * 100);
  const live = s.status === 'bidding' || s.status === 'reveal';
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, ease, duration: 0.6 }}>
      <Link href={`/app/sale/${s.id}`} className={cx('group block rounded-blob border p-6 transition hover:-translate-y-1', live ? 'border-ink bg-paper hover:shadow-[8px_8px_0_#D4FF3A]' : 'border-ink/10 bg-chalk')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Tag tone={live ? 'lemon' : 'mute'}>{s.type} · {s.status}</Tag>
            <h3 className="mt-3 font-display text-2xl font-semibold">{s.tokenName}<span className="ml-2 font-mono text-sm font-normal text-ink-mute">{s.tokenSymbol}</span></h3>
          </div>
          <HeatGauge heat={s.heat} compact />
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-frost">
          <motion.div className="h-full bg-ink" initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 1, ease }} />
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 font-mono text-[12px]">
          <span>{fmt(s.totalCommittedBnb, 1)} / {fmt(s.hardCapBnb, 0)} BNB</span>
          <span className="text-ink-mute">{s.status === 'upcoming' ? `opens ${fmtDate(s.start)}` : `${fmt(s.bidCount, 0)} sealed bids`}</span>
        </div>
      </Link>
    </motion.div>
  );
}
