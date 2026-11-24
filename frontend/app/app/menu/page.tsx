'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion';
import AppShell from '@/components/ui/AppShell';
import ConnectWallet from '@/components/ui/ConnectWallet';
import NetworkChip from '@/components/ui/NetworkChip';
import { useRole } from '@/lib/role';

type Item = { href: string; title: string; kicker: string; blurb: string; tone: 'lemon' | 'ink' | 'chalk' | 'frost'; tag?: string; glyph: string };

const ALL: (Item & { only?: 'host' | 'buyer' })[] = [
  { href: '/app/ico', title: 'ICOs', kicker: 'Initial coin offerings', blurb: 'Brand new tokens, sold by sealed auction.', tone: 'lemon', glyph: '◐' },
  { href: '/app/ido', title: 'IDOs', kicker: 'Initial DEX offerings', blurb: 'Raise and list with liquidity locked at launch.', tone: 'ink', glyph: '◑' },
  { href: '/app/presale', title: 'Presales', kicker: 'Early rounds', blurb: 'Get in first, with vesting built in.', tone: 'chalk', glyph: '◒' },
  { href: '/app/ipo', title: 'IPO', kicker: 'Tokenized equity', blurb: 'Real shares, gated by KYC and jurisdiction.', tone: 'frost', tag: 'Coming soon', glyph: '◓' },
  { href: '/app/apply', title: 'Apply', kicker: 'Launch with Obsid', blurb: 'Submit your project to host a sale.', tone: 'lemon', only: 'host', glyph: '✚' },
  { href: '/app/manage', title: 'Manage Sales', kicker: 'Host console', blurb: 'Fund your sale, withdraw BNB, reclaim unsold tokens.', tone: 'ink', only: 'host', glyph: '◆' },
  { href: '/app/profile', title: 'My Profile', kicker: 'Your public face', blurb: 'Team, links, banner and sale history.', tone: 'chalk', only: 'host', glyph: '☀' },
  { href: '/app/dashboard', title: 'My Private Dashboard', kicker: 'For your eyes only', blurb: 'Your sealed bids, reveals and allocations.', tone: 'ink', only: 'buyer', glyph: '◈' },
  { href: '/app/stake', title: 'Stake $OBSID', kicker: 'Guaranteed access', blurb: 'Stake to get into every sale.', tone: 'lemon', glyph: '◉' },
  { href: '/app/claim', title: 'Claim and Vesting', kicker: 'Collect tokens', blurb: 'Claim unlocked tokens on schedule.', tone: 'lemon', glyph: '◎' },
  { href: '/app/trade', title: 'Allocation Trading', kicker: 'Peer to peer', blurb: 'Move positions without broadcasting size.', tone: 'frost', glyph: '⇄' },
  { href: '/whitepaper', title: 'Whitepaper', kicker: 'The mechanism', blurb: 'Math, contracts and guarantees.', tone: 'chalk', glyph: '¶' },
  { href: '/how-to', title: 'How to use', kicker: 'Step by step', blurb: 'From wallet to claim in plain words.', tone: 'ink', glyph: '?' },
];

const toneCls: Record<Item['tone'], string> = {
  lemon: 'bg-lemon text-ink',
  ink: 'bg-ink text-paper',
  chalk: 'bg-chalk text-ink ring-1 ring-ink/5',
  frost: 'bg-white/60 text-ink ring-1 ring-white backdrop-blur-xl',
};

export default function Menu() {
  const { role } = useRole();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setReady(true);
      try { if (!localStorage.getItem('obsid.role')) router.replace('/app'); } catch {}
    }, 50);
    return () => clearTimeout(t);
  }, [router]);

  const items = useMemo(() => ALL.filter((i) => !i.only || i.only === role), [role]);
  const [idx, setIdx] = useState(0);
  const x = useMotionValue(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(360);
  const GAP = 20;

  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.offsetWidth ?? 360;
      setCardW(w < 640 ? Math.round(w * 0.84) : w < 1024 ? 420 : 460);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => { if (idx > items.length - 1) setIdx(Math.max(0, items.length - 1)); }, [items.length, idx]);
  useEffect(() => {
    const c = animate(x, -idx * (cardW + GAP), { type: 'spring', stiffness: 260, damping: 32 });
    return c.stop;
  }, [idx, cardW, x]);

  const go = (d: number) => setIdx((i) => Math.min(items.length - 1, Math.max(0, i + d)));
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const moved = -info.offset.x - info.velocity.x * 0.25;
    const step = Math.round(moved / (cardW + GAP));
    setIdx((i) => Math.min(items.length - 1, Math.max(0, i + step)));
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const dragged = useRef(false);

  return (
    <AppShell wide>
      <section className="mx-auto max-w-[1600px] px-4 pb-24 pt-8 sm:px-8 sm:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-ink-mute">{role === 'buyer' ? 'Private menu' : role === 'host' ? 'Public menu' : 'Menu'}</p>
            <h1 className="mt-2 font-display text-5xl font-extrabold leading-[0.92] tracking-tight sm:text-7xl">
              Where to <span className="font-serif font-normal italic">next?</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-ink-mute">{String(idx + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>
            <button aria-label="Previous" onClick={() => go(-1)} disabled={idx === 0} className="grid h-12 w-12 place-items-center rounded-full bg-paper text-xl ring-1 ring-ink/15 transition hover:bg-ink hover:text-lemon disabled:opacity-30">←</button>
            <button aria-label="Next" onClick={() => go(1)} disabled={idx === items.length - 1} className="grid h-12 w-12 place-items-center rounded-full bg-lemon text-xl ring-1 ring-ink/20 transition hover:bg-ink hover:text-lemon disabled:opacity-30">→</button>
          </div>
        </div>

        <div ref={wrapRef} className="relative mt-10 overflow-hidden sm:mt-14">
          <motion.div
            drag="x"
            style={{ x }}
            dragConstraints={{ left: -(items.length - 1) * (cardW + GAP) - 40, right: 40 }}
            dragElastic={0.12}
            onDragStart={() => { dragged.current = true; }}
            onDragEnd={(e, info) => { onDragEnd(e, info); setTimeout(() => { dragged.current = false; }, 60); }}
            className="flex cursor-grab touch-pan-y active:cursor-grabbing"
          >
            {items.map((it, i) => {
              const active = i === idx;
              return (
                <motion.div
                  key={it.href}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: ready ? (active ? 1 : 0.55) : 0, y: 0, scale: active ? 1 : 0.94 }}
                  transition={{ delay: ready ? Math.min(i, 4) * 0.06 : 0, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: cardW, marginRight: GAP, flexShrink: 0 }}
                >
                  <Link
                    href={it.href}
                    draggable={false}
                    onClick={(e) => { if (dragged.current) { e.preventDefault(); return; } if (!active) { e.preventDefault(); setIdx(i); } }}
                    className={`group relative flex h-[26rem] select-none flex-col justify-between overflow-hidden rounded-[2.5rem] p-7 sm:h-[30rem] sm:p-9 ${toneCls[it.tone]}`}
                  >
                    <span aria-hidden className={`pointer-events-none absolute -right-6 -top-10 font-display text-[12rem] font-extrabold leading-none opacity-[0.12] transition-transform duration-700 group-hover:rotate-12 sm:text-[15rem]`}>{it.glyph}</span>
                    <div className="relative flex items-center justify-between">
                      <span className="font-mono text-sm opacity-60">{String(i + 1).padStart(2, '0')}</span>
                      {it.tag && <span className="rounded-full bg-lemon px-3 py-1 font-label text-[10px] font-extrabold uppercase tracking-wider text-ink ring-1 ring-ink/20">{it.tag}</span>}
                      {it.href.startsWith('/whitepaper') || it.href.startsWith('/how-to') ? <span className="font-label text-[10px] font-bold uppercase tracking-wider opacity-60">Docs</span> : null}
                    </div>
                    <div className="relative">
                      <p className="font-label text-[11px] font-bold uppercase tracking-[0.25em] opacity-60">{it.kicker}</p>
                      <h2 className="mt-2 break-words font-display text-[1.9rem] font-extrabold leading-[0.95] tracking-tight sm:text-5xl">{it.title}</h2>
                      <p className="mt-3 max-w-xs font-serif text-xl italic leading-snug opacity-80">{it.blurb}</p>
                      <span className={`mt-6 inline-grid h-12 w-12 place-items-center rounded-full text-xl transition-transform duration-500 group-hover:-rotate-45 ${it.tone === 'ink' ? 'bg-lemon text-ink' : 'bg-ink text-lemon'}`}>→</span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {items.map((it, i) => (
            <button key={it.href} aria-label={`Go to ${it.title}`} onClick={() => setIdx(i)} className={`h-2.5 rounded-full transition-all duration-500 ${i === idx ? 'w-10 bg-ink' : 'w-2.5 bg-ink/20 hover:bg-ink/40'}`} />
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <ConnectWallet size="lg" />
          <NetworkChip />
        </div>
      </section>
    </AppShell>
  );
}
