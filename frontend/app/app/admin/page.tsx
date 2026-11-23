'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import ConnectWallet from '@/components/ui/ConnectWallet';
import HeatGauge from '@/components/ui/HeatGauge';
import { fetchSales } from '@/lib/api';
import { hostById } from '@/lib/mock';
import type { Sale } from '@/lib/types';
import { ADMIN_WALLET } from '@/lib/wagmi';
import {
  adminApplications, adminProfileChanges, approveApplication, decideProfileChange, rejectApplication, type Application, type ProfileChange,
} from '@/components/hostbuyer/client';
import { DemoNote, Gate, Input, Kicker, PageHead, StatusPill, Tag, cx, ease, fmt, fmtDate, short, useAuth } from '@/components/hostbuyer/kit';

const TABS = ['Applications', 'Profile changes', 'Live sales', 'Escrow'] as const;
type TabT = (typeof TABS)[number];

export default function AdminPage() {
  const { address, isConnected } = useAuth();
  const isAdmin = !!address && address.toLowerCase() === ADMIN_WALLET.toLowerCase();
  return (
    <AppShell wide>
      <div className="mx-auto max-w-[1600px] px-4 pb-24 sm:px-6">
        {!isConnected ? (
          <Gate title="Admin only" body="Connect the Obsid desk wallet to continue." cta={<ConnectWallet />} />
        ) : !isAdmin ? (
          <Gate title="Admin only" body="This wallet is not the Obsid desk. Nothing to see here." cta={<Button href="/app" variant="ink">Back to app</Button>} />
        ) : (
          <Desk />
        )}
      </div>
    </AppShell>
  );
}

function Desk() {
  const { auth } = useAuth();
  const [tab, setTab] = useState<TabT>('Applications');
  const [apps, setApps] = useState<Application[] | null>(null);
  const [changes, setChanges] = useState<ProfileChange[] | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try { const a = await auth(); const [x, y] = await Promise.all([adminApplications(a), adminProfileChanges(a)]); setApps(x); setChanges(y); }
    catch (e) { setErr(e instanceof Error ? e.message.slice(0, 200) : 'Could not load'); }
  }, [auth]);
  useEffect(() => { fetchSales().then(setSales); }, []);

  const pendingApps = apps?.filter((a) => a.status === 'pending').length ?? 0;
  const pendingChanges = changes?.filter((c) => c.status === 'pending').length ?? 0;
  const counts: Record<TabT, number | undefined> = {
    Applications: apps ? pendingApps : undefined, 'Profile changes': changes ? pendingChanges : undefined,
    'Live sales': sales.filter((s) => s.status === 'bidding' || s.status === 'reveal').length, Escrow: sales.filter((s) => s.status === 'settled').length,
  };

  return (
    <>
      <PageHead kicker="The desk" title={<>Admin<span className="text-lemon-deep">.</span></>} accent="approve with care, release with proof." aside={<Tag tone="ink">{short(ADMIN_WALLET)}</Tag>} />
      <DemoNote />
      <nav className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx('relative shrink-0 rounded-full px-5 py-2.5 font-label text-xs font-semibold uppercase tracking-[0.16em] transition', tab === t ? 'text-ink' : 'text-ink-mute hover:text-ink')}>
            {tab === t && <motion.span layoutId="adminTab" className="absolute inset-0 rounded-full bg-lemon" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
            <span className="relative">{t}{counts[t] !== undefined && <span className="ml-2 font-mono">{counts[t]}</span>}</span>
          </button>
        ))}
      </nav>
      {err && <p className="mb-6 rounded-2xl bg-ink p-4 font-body text-sm text-lemon">{err}</p>}

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35, ease }}>
          {(tab === 'Applications' || tab === 'Profile changes') && apps === null && (
            <div className="rounded-blob border border-ink/10 p-10 text-center">
              <p className="font-serif text-xl italic text-ink-soft">Sign once to open the review queue.</p>
              <div className="mt-6 flex justify-center"><Button variant="ink" onClick={load}>Sign in as admin</Button></div>
            </div>
          )}
          {tab === 'Applications' && apps && <Applications apps={apps} onChange={load} />}
          {tab === 'Profile changes' && changes && <Changes list={changes} onChange={load} />}
          {tab === 'Live sales' && <LiveSales sales={sales.filter((s) => s.status !== 'settled' && s.status !== 'failed')} />}
          {tab === 'Escrow' && <Escrow sales={sales.filter((s) => s.status === 'settled')} />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function Applications({ apps, onChange }: { apps: Application[]; onChange: () => void }) {
  const { auth } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); setOpenId(null); setReason(''); onChange(); } catch {} setBusy(false); };
  if (!apps.length) return <p className="font-serif text-2xl italic text-ink-mute">Queue is clear.</p>;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {apps.map((a) => (
        <motion.article layout key={a.id} className={cx('rounded-blob border p-6 md:p-8', a.status === 'pending' ? 'border-ink bg-paper' : 'border-ink/10 bg-chalk')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Tag tone="mute">{a.type}</Tag>
              <h3 className="mt-3 font-display text-3xl font-semibold leading-none">{a.tokenName} <span className="font-mono text-base font-normal text-ink-mute">{a.tokenSymbol}</span></h3>
              <p className="mt-1 font-serif italic text-ink-soft">{a.hostName ?? 'Unnamed host'} · <span className="font-mono not-italic text-xs">{short(a.hostAddress)}</span></p>
            </div>
            <StatusPill status={a.status} />
          </div>
          <p className="mt-4 font-body text-ink-soft">{a.summary}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Supply', fmt(a.supply, 0)], ['Min price', `${a.minPrice}`], ['Caps BNB', `${a.softCapBnb}/${a.hardCapBnb}`], ['At close', `${a.escrowAtClosePct}%`],
              ['Opens', fmtDate(a.start)], ['Closes', fmtDate(a.end)], ['Reveal', fmtDate(a.revealEnd)], ['Token', short(a.tokenAddress)],
            ].map(([k, v]) => <div key={k}><dt><Kicker>{k}</Kicker></dt><dd className="mt-1 font-mono text-[13px]">{v}</dd></div>)}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {a.milestones.map((m, i) => <span key={i} className="rounded-full bg-frost px-3 py-1 font-body text-xs">{m.label} <span className="font-mono">{m.pct}%</span></span>)}
          </div>
          {a.reason && <p className="mt-4 font-serif italic text-ink-soft">Reason: {a.reason}</p>}
          {a.status === 'pending' && (
            <div className="mt-6">
              <AnimatePresence>
                {openId === a.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason the host will see" className="mb-3" />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex flex-wrap gap-2">
                <Button variant="lemon" size="sm" disabled={busy} onClick={() => act(async () => approveApplication(a.id, await auth()))}>Approve</Button>
                {openId === a.id ? (
                  <Button variant="ink" size="sm" disabled={busy || reason.trim().length < 4} onClick={() => act(async () => rejectApplication(a.id, reason.trim(), await auth()))}>Confirm reject</Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setOpenId(a.id)}>Reject</Button>
                )}
              </div>
            </div>
          )}
        </motion.article>
      ))}
    </div>
  );
}

function Changes({ list, onChange }: { list: ProfileChange[]; onChange: () => void }) {
  const { auth } = useAuth();
  if (!list.length) return <p className="font-serif text-2xl italic text-ink-mute">No profile edits waiting.</p>;
  const act = async (id: string, d: 'approve' | 'reject') => { try { await decideProfileChange(id, d, await auth()); onChange(); } catch {} };
  return (
    <ul className="divide-y divide-ink/10 border-y border-ink/10">
      {list.map((c) => (
        <li key={c.id} className="grid items-center gap-4 py-5 md:grid-cols-12">
          <div className="md:col-span-3">
            <Kicker>{c.field}</Kicker>
            <p className="font-mono text-xs text-ink-mute">{short(c.hostAddress)} · {fmtDate(c.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-6">
            <span className={cx('break-all text-ink-mute line-through', c.field === 'wallet' ? 'font-mono text-xs' : 'font-body')}>{c.before}</span>
            <span className="font-display">→</span>
            <span className={cx('break-all rounded-lg bg-lemon px-2 py-0.5', c.field === 'wallet' ? 'font-mono text-xs' : 'font-body font-medium')}>{c.after}</span>
          </div>
          <div className="flex gap-2 md:col-span-3 md:justify-end">
            {c.status === 'pending' ? (
              <>
                <Button size="sm" variant="lemon" onClick={() => act(c.id, 'approve')}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => act(c.id, 'reject')}>Reject</Button>
              </>
            ) : <StatusPill status={c.status} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

function LiveSales({ sales }: { sales: Sale[] }) {
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sales.map((s) => (
        <div key={s.id} className={cx('rounded-blob border p-6 transition', paused[s.id] ? 'border-dashed border-ink/30 bg-frost' : 'border-ink/10 bg-paper')}>
          <div className="flex items-start justify-between">
            <div>
              <Tag tone={paused[s.id] ? 'ink' : 'lemon'}>{paused[s.id] ? 'paused' : s.status}</Tag>
              <h3 className="mt-3 font-display text-2xl font-semibold">{s.tokenName}</h3>
              <p className="font-serif italic text-ink-mute">{hostById(s.hostId)?.name}</p>
            </div>
            <HeatGauge heat={s.heat} compact />
          </div>
          <p className="mt-4 font-mono text-sm">{fmt(s.totalCommittedBnb, 1)} / {fmt(s.hardCapBnb, 0)} BNB · {fmt(s.bidCount, 0)} bids</p>
          <div className="mt-5"><Button size="sm" variant={paused[s.id] ? 'lemon' : 'ink'} onClick={() => setPaused((p) => ({ ...p, [s.id]: !p[s.id] }))}>{paused[s.id] ? 'Resume' : 'Pause sale'}</Button></div>
          <p className="mt-2 font-label text-[9px] uppercase tracking-[0.2em] text-ink-mute">placeholder · wire to SealedSale.pause</p>
        </div>
      ))}
    </div>
  );
}

function Escrow({ sales }: { sales: Sale[] }) {
  const [released, setReleased] = useState<Record<string, boolean>>({});
  if (!sales.length) return <p className="font-serif text-2xl italic text-ink-mute">No settled sales hold escrow yet.</p>;
  return (
    <div className="space-y-4">
      {sales.map((s) => {
        const raised = s.totalCommittedBnb;
        return (
          <div key={s.id} className="rounded-blob border border-ink/10 p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="font-display text-3xl font-semibold">{s.tokenName}</h3>
              <p className="font-mono text-sm">{fmt(raised, 1)} BNB raised · {s.escrow.atClosePct}% released at close</p>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {s.escrow.milestones.map((m, i) => {
                const key = `${s.id}.${i}`;
                const done = m.released || released[key];
                return (
                  <div key={key} className={cx('flex items-center justify-between gap-4 rounded-3xl p-5', done ? 'bg-chalk' : 'bg-ink text-paper')}>
                    <div>
                      <p className="font-body font-medium">{m.label}</p>
                      <p className={cx('font-mono text-sm', done ? 'text-ink-mute' : 'text-lemon')}>{m.pct}% · {fmt((raised * m.pct) / 100, 2)} BNB</p>
                    </div>
                    {done ? <Tag tone="line">Released</Tag> : <Button size="sm" variant="lemon" onClick={() => setReleased((r) => ({ ...r, [key]: true }))}>Release</Button>}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 font-label text-[9px] uppercase tracking-[0.2em] text-ink-mute">placeholder · wire to Escrow.releaseMilestone</p>
          </div>
        );
      })}
    </div>
  );
}
