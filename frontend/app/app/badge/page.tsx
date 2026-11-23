'use client';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import AppShell from '@/components/ui/AppShell';
import { fetchSales } from '@/lib/api';
import { allBids } from '@/components/hostbuyer/bids';
import { DemoNote, Kicker, PageHead, cx, ease } from '@/components/hostbuyer/kit';

interface Badge { id: string; token: string; symbol: string; host: string; type: string; when: string; tier: 'Sealed' | 'Revealed' | 'Allocated'; serial: string }

const tierOf = (status?: string, revealed?: boolean): Badge['tier'] => (status === 'settled' ? 'Allocated' : revealed || status === 'reveal' ? 'Revealed' : 'Sealed');
const monthYear = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', year: 'numeric' });

export default function BadgePage() {
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    try { setFocus(new URLSearchParams(window.location.search).get('b')); } catch {}
    fetchSales().then((s) => {
      const seen = new Set<string>();
      const out: Badge[] = [];
      for (const r of allBids(s)) {
        if (!r.sale || seen.has(r.sale.id)) continue;
        seen.add(r.sale.id);
        out.push({
          id: r.sale.id, token: r.sale.tokenName, symbol: r.sale.tokenSymbol, host: r.hostName ?? 'Obsid host', type: r.sale.type,
          when: monthYear(r.sale.end), tier: tierOf(r.sale.status, r.revealed), serial: (parseInt(r.key.replace(/\W/g, '').slice(-6), 36) % 9999).toString().padStart(4, '0'),
        });
      }
      setBadges(out);
    });
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <PageHead
          kicker="Proof of participation"
          title={<>You were<br />in the room.</>}
          accent="badges carry the moment, never the amount."
          aside={<p className="max-w-xs font-body text-ink-soft">Share a card to show you backed a sale early. It reveals the sale and the phase you reached, nothing about your size.</p>}
        />
        <DemoNote />
        {badges === null ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-blob bg-chalk" />)}</div>
        ) : badges.length === 0 ? (
          <p className="font-serif text-2xl italic text-ink-mute">Place a sealed bid to earn your first badge.</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((b, i) => <BadgeCard key={b.id} b={b} i={i} highlight={focus === b.id} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function BadgeCard({ b, i, highlight }: { b: Badge; i: number; highlight: boolean }) {
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 200, damping: 20 });
  const shine = useTransform(mx, [-0.5, 0.5], ['0%', '100%']);
  const [msg, setMsg] = useState('');
  const dark = b.tier === 'Allocated';
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 1600); };

  const copy = async () => {
    const url = `${window.location.origin}/app/badge?b=${b.id}`;
    try {
      if (navigator.share && /Mobi/.test(navigator.userAgent)) { await navigator.share({ title: `${b.token} on Obsid`, url }); return; }
      await navigator.clipboard.writeText(url); flash('Link copied');
    } catch {}
  };
  const download = () => { drawBadge(b); flash('Saved'); };

  return (
    <motion.div initial={{ opacity: 0, y: 40, rotate: i % 2 ? 2 : -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: i * 0.1, duration: 0.8, ease }} style={{ perspective: 1000 }}>
      <motion.div
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}
        onPointerLeave={() => { mx.set(0); my.set(0); }}
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        className={cx('grain relative aspect-[4/5] overflow-hidden rounded-blob p-7', dark ? 'bg-ink text-paper' : 'bg-lemon text-ink', highlight && 'ring-4 ring-ink ring-offset-4')}
      >
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay" style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,.9) 50%, transparent 70%)', backgroundSize: '250% 100%', backgroundPositionX: shine }} />
        <div className={cx('absolute -right-16 -top-16 h-56 w-56 rounded-full border-[22px]', dark ? 'border-lemon' : 'border-ink')} />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between">
            <span className="font-label text-[10px] font-bold uppercase tracking-[0.24em]">Obsid · {b.type}</span>
            <span className="font-mono text-[11px] opacity-70">#{b.serial}</span>
          </div>
          <div className="mt-auto">
            <span className={cx('font-serif text-2xl italic', dark ? 'text-lemon' : 'text-ink-soft')}>{b.tier}</span>
            <h3 className="mt-1 break-words font-display text-[clamp(2.4rem,5vw,3.6rem)] font-bold leading-[0.9] tracking-tight">{b.token}</h3>
            <p className="mt-3 font-body text-sm opacity-80">hosted by {b.host}</p>
            <div className={cx('mt-6 flex items-end justify-between border-t pt-4', dark ? 'border-paper/20' : 'border-ink/20')}>
              <span className="font-mono text-xs">${b.symbol}</span>
              <span className="font-mono text-xs">{b.when}</span>
            </div>
          </div>
        </div>
      </motion.div>
      <div className="mt-4 flex items-center gap-2">
        <button onClick={copy} className="rounded-full bg-ink px-4 py-2 font-label text-[11px] font-bold uppercase tracking-[0.16em] text-lemon transition hover:bg-ink-soft">Share</button>
        <button onClick={download} className="rounded-full border border-ink/20 px-4 py-2 font-label text-[11px] font-bold uppercase tracking-[0.16em] transition hover:border-ink">Download</button>
        {msg && <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="font-serif italic text-ink-soft">{msg}</motion.span>}
      </div>
    </motion.div>
  );
}

function drawBadge(b: Badge) {
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g) return;
  const dark = b.tier === 'Allocated';
  const bg = dark ? '#0B0F05' : '#D4FF3A', fg = dark ? '#FFFFFF' : '#0B0F05', accent = dark ? '#D4FF3A' : '#0B0F05';
  const css = (v: string, fb: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;
  const fDisplay = css('--f-display', 'sans-serif'), fSerif = css('--f-serif', 'serif'), fMono = css('--f-mono', 'monospace'), fLabel = css('--f-label', 'sans-serif'), fBody = css('--f-body', 'sans-serif');
  g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, W, H, 80); g.fill();
  g.strokeStyle = accent; g.lineWidth = 70; g.beginPath(); g.arc(W - 60, 60, 230, 0, Math.PI * 2); g.stroke();
  g.fillStyle = fg;
  g.font = `700 30px ${fLabel}`; g.fillText(`OBSID · ${b.type}`, 80, 120);
  g.font = `400 32px ${fMono}`; g.textAlign = 'right'; g.fillText(`#${b.serial}`, W - 80, 120); g.textAlign = 'left';
  g.fillStyle = dark ? '#D4FF3A' : '#3A4030'; g.font = `italic 400 72px ${fSerif}`; g.fillText(b.tier, 80, H - 470);
  g.fillStyle = fg;
  let size = 190; g.font = `700 ${size}px ${fDisplay}`;
  while (g.measureText(b.token).width > W - 160 && size > 60) { size -= 8; g.font = `700 ${size}px ${fDisplay}`; }
  g.fillText(b.token, 80, H - 290);
  g.font = `400 40px ${fBody}`; g.globalAlpha = 0.8; g.fillText(`hosted by ${b.host}`, 80, H - 210); g.globalAlpha = 1;
  g.fillRect(80, H - 160, W - 160, 2);
  g.font = `400 34px ${fMono}`; g.fillText(`$${b.symbol}`, 80, H - 90); g.textAlign = 'right'; g.fillText(b.when, W - 80, H - 90);
  const a = document.createElement('a');
  a.download = `obsid_${b.symbol.toLowerCase()}_badge.png`;
  a.href = c.toDataURL('image/png');
  a.click();
}
