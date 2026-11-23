'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import Redacted from '@/components/ui/Redacted';
import { fetchSales } from '@/lib/api';
import { useRole } from '@/lib/role';
import { allBids, type BidRow } from '@/components/hostbuyer/bids';
import { DemoNote, Gate, Kicker, Rise, Tag, cx, ease, fmt, fmtDate, timeLeft } from '@/components/hostbuyer/kit';

const phase = (r: BidRow) => {
  const s = r.sale;
  if (!s) return { label: 'Unknown', tone: 'mute' as const };
  if (s.status === 'bidding') return { label: 'Sealed', tone: 'ink' as const };
  if (s.status === 'reveal') return { label: r.revealed ? 'Revealed' : 'Reveal now', tone: 'lemon' as const };
  if (s.status === 'settled') return { label: 'Allocated', tone: 'line' as const };
  if (s.status === 'failed') return { label: 'Refund', tone: 'mute' as const };
  return { label: 'Upcoming', tone: 'mute' as const };
};

export default function DashboardPage() {
  const { role } = useRole();
  const [rows, setRows] = useState<BidRow[] | null>(null);
  const [peek, setPeek] = useState(false);
  useEffect(() => { fetchSales().then((s) => setRows(allBids(s))); }, []);

  const totals = useMemo(() => {
    const r = rows ?? [];
    return {
      committed: r.reduce((a, b) => a + b.amountBnb, 0),
      sealed: r.filter((b) => b.sale?.status === 'bidding').length,
      allocated: r.reduce((a, b) => a + (b.allocationTokens ?? 0), 0),
    };
  }, [rows]);
  const reminders = (rows ?? []).filter((r) => r.sale && (r.sale.status === 'bidding' || (r.sale.status === 'reveal' && !r.revealed)));

  if (role === 'host') {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Gate title="This room is for buyers" body="The dashboard holds private bids. Switch to buyer mode to see yours." cta={<Button href="/app" variant="ink">Switch role</Button>} />
        </div>
      </AppShell>
    );
  }
  const R = ({ children }: { children: React.ReactNode }) => <Redacted active={!peek}>{children}</Redacted>;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6">
        <DemoNote />
        {/* hero: frosted ledger */}
        <section className="relative grid gap-6 md:grid-cols-12">
          <Rise className="md:col-span-7">
            <Kicker>Your private ledger</Kicker>
            <h1 className="mt-4 font-display text-[clamp(2.6rem,8vw,6.5rem)] font-semibold leading-[0.88] tracking-tight">
              Only you<br />can see<span className="font-serif font-normal italic"> this.</span>
            </h1>
            <p className="mt-5 max-w-md font-body text-ink-soft">Every number on this page lives behind a bar. Hover or tap to lift it for a moment. Nobody else ever sees your size.</p>
            <button onClick={() => setPeek((p) => !p)} className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/50 px-4 py-2 font-label text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur transition hover:bg-white">
              <span className={cx('relative h-5 w-9 rounded-full transition', peek ? 'bg-lemon' : 'bg-ink/20')}>
                <motion.span layout className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-ink', peek ? 'right-0.5' : 'left-0.5')} />
              </span>
              {peek ? 'Hide everything' : 'Peek at all'}
            </button>
          </Rise>
          <Rise delay={0.15} className="md:col-span-5">
            <div className="relative overflow-hidden rounded-blob border border-white/70 bg-white/40 p-6 shadow-[0_30px_80px_-30px_rgba(11,15,5,0.25)] backdrop-blur-2xl md:p-8">
              <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lemon/60 blur-2xl" />
              <div className="relative space-y-6">
                <div>
                  <Kicker>Committed across sales</Kicker>
                  <p className="mt-2 font-mono text-4xl md:text-5xl"><R>{fmt(totals.committed, 3)}</R><span className="ml-2 text-base text-ink-mute">BNB</span></p>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-ink/10 pt-5">
                  <div><Kicker>Sealed bids</Kicker><p className="mt-1 font-mono text-2xl"><R>{totals.sealed}</R></p></div>
                  <div><Kicker>Tokens allocated</Kicker><p className="mt-1 font-mono text-2xl"><R>{fmt(totals.allocated, 2)}</R></p></div>
                </div>
              </div>
            </div>
          </Rise>
        </section>

        {/* reminders */}
        {reminders.length > 0 && (
          <section className="mt-14">
            <Kicker>Deadlines</Kicker>
            <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
              {reminders.map((r, i) => {
                const reveal = r.sale!.status === 'reveal';
                const when = reveal ? r.sale!.revealEnd : r.sale!.end;
                return (
                  <motion.div key={r.key} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i, ease }}
                    className={cx('min-w-[260px] snap-start rounded-3xl p-5 sm:min-w-[320px]', reveal ? 'bg-ink text-paper' : 'border border-white/80 bg-white/50 backdrop-blur-xl')}>
                    <div className="flex items-center justify-between">
                      <span className={cx('font-label text-[10px] font-semibold uppercase tracking-[0.2em]', reveal ? 'text-lemon' : 'text-ink-mute')}>{reveal ? 'Reveal your bid' : 'Bidding closes'}</span>
                      {reveal && <span className="h-2 w-2 animate-ping rounded-full bg-lemon" />}
                    </div>
                    <p className="mt-3 font-display text-2xl font-semibold">{r.sale!.tokenName}</p>
                    <p className="mt-1 font-mono text-3xl">{timeLeft(when)}</p>
                    <p className={cx('mt-1 font-serif text-sm italic', reveal ? 'text-paper/60' : 'text-ink-mute')}>{reveal ? 'Unrevealed bids are forfeited to refund only.' : `until ${fmtDate(when)}`}</p>
                    {reveal && <Link href={`/app/sale/${r.saleId}`} className="mt-4 inline-block rounded-full bg-lemon px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.18em] text-ink">Reveal now</Link>}
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* bid list */}
        <section className="mt-14">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">Bids <span className="font-serif font-normal italic text-ink-mute">and allocations</span></h2>
            <Button href="/app/claim" variant="ink" size="sm">Claim</Button>
          </div>
          {rows === null ? (
            <div className="mt-6 h-60 animate-pulse rounded-blob bg-white/40" />
          ) : (
            <div className="mt-6 space-y-3">
              {rows.map((r, i) => {
                const ph = phase(r);
                return (
                  <motion.div key={r.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, ease }}
                    className="grid items-center gap-4 rounded-3xl border border-white/80 bg-white/45 p-5 backdrop-blur-xl md:grid-cols-12 md:p-6">
                    <div className="md:col-span-4">
                      <div className="flex items-center gap-2"><Tag tone={ph.tone}>{ph.label}</Tag>{r.demo && <span className="font-label text-[9px] uppercase tracking-[0.2em] text-ink-mute">demo</span>}</div>
                      <p className="mt-2 font-display text-2xl font-semibold">{r.sale?.tokenName ?? r.saleId}<span className="ml-2 font-mono text-sm font-normal text-ink-mute">{r.sale?.tokenSymbol}</span></p>
                      <p className="font-serif italic text-ink-mute">{r.hostName ?? 'Unknown host'}</p>
                    </div>
                    <dl className="grid grid-cols-3 gap-3 md:col-span-6">
                      <div><dt><Kicker>Deposit</Kicker></dt><dd className="mt-1 font-mono text-sm md:text-base"><R>{fmt(r.amountBnb, 4)} BNB</R></dd></div>
                      <div><dt><Kicker>Max price</Kicker></dt><dd className="mt-1 font-mono text-sm md:text-base"><R>{r.priceBnb}</R></dd></div>
                      <div><dt><Kicker>{r.allocationTokens !== undefined ? 'Allocated' : 'Tokens'}</Kicker></dt><dd className="mt-1 font-mono text-sm md:text-base"><R>{fmt(r.allocationTokens ?? r.tokens, 2)}</R></dd></div>
                    </dl>
                    <div className="md:col-span-2 md:text-right">
                      <Link href={`/app/sale/${r.saleId}`} className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] underline decoration-lemon decoration-2 underline-offset-4">Open sale</Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
