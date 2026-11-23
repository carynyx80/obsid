'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { isAddress } from 'viem';
import { useWriteContract } from 'wagmi';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import ConnectWallet from '@/components/ui/ConnectWallet';
import Redacted from '@/components/ui/Redacted';
import { fetchSales } from '@/lib/api';
import { useRole } from '@/lib/role';
import { VESTING_VAULT, vestingAbiPlaceholder } from '@/components/hostbuyer/abis';
import { allBids, vestedAt, vestingFor, type Vesting } from '@/components/hostbuyer/bids';
import { DemoNote, Field, Input, Kicker, PageHead, Rise, cx, ease, fmt, fmtDate, short, useAuth } from '@/components/hostbuyer/kit';

export default function ClaimPage() {
  const { role } = useRole();
  const { isConnected } = useAuth();
  const [list, setList] = useState<Vesting[] | null>(null);
  useEffect(() => { fetchSales().then((s) => setList(vestingFor(allBids(s)))); }, []);
  const priv = role !== 'host';

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <PageHead
          kicker="Vesting portal"
          title={<>Unlock,<br />slowly.</>}
          accent="cliff first, then a steady drip."
          aside={<p className="max-w-xs font-body text-ink-soft">Claim to your bidding wallet or send straight to a fresh address so your allocation never links back.</p>}
        />
        <DemoNote />
        {!isConnected && (
          <div className="mb-8 flex flex-wrap items-center gap-4 rounded-3xl border border-ink/10 bg-paper/60 p-5 backdrop-blur">
            <p className="font-body text-ink-soft">Connect the wallet you bid with to claim.</p>
            <ConnectWallet size="sm" />
          </div>
        )}
        {list === null ? (
          <div className="h-60 animate-pulse rounded-blob bg-chalk" />
        ) : list.length === 0 ? (
          <p className="font-serif text-2xl italic text-ink-mute">No settled allocations yet.</p>
        ) : (
          <div className="space-y-6">{list.map((v, i) => <VestCard key={v.row.key} v={v} i={i} priv={priv} />)}</div>
        )}
      </div>
    </AppShell>
  );
}

function VestCard({ v, i, priv }: { v: Vesting; i: number; priv: boolean }) {
  const { address } = useAuth();
  const [fresh, setFresh] = useState(false);
  const [to, setTo] = useState('');
  const [claimed, setClaimed] = useState(v.claimed);
  const [note, setNote] = useState('');
  const { writeContractAsync, isPending } = useWriteContract();

  const vested = vestedAt(v);
  const claimable = Math.max(0, vested - claimed);
  const start = new Date(v.startIso).getTime();
  const cliffPct = (v.cliffDays / (v.cliffDays + v.linearDays)) * 100;
  const elapsed = Math.max(0, Math.min(1, (Date.now() - start) / ((v.cliffDays + v.linearDays) * 864e5)));
  const dest = fresh ? to : address;
  const destOk = !!dest && isAddress(dest);

  async function claim() {
    setNote('');
    if (!destOk) return setNote('Enter a valid address');
    if (!VESTING_VAULT) {
      setClaimed((c) => c + claimable);
      setNote(`Demo claim sent to ${short(dest)}. Set NEXT_PUBLIC_VESTING_VAULT to claim onchain.`);
      return;
    }
    try {
      const hash = await writeContractAsync({ address: VESTING_VAULT, abi: vestingAbiPlaceholder, functionName: 'claim', args: [dest as `0x${string}`] });
      setClaimed((c) => c + claimable);
      setNote(`Submitted ${short(hash)}`);
    } catch (e) { setNote(e instanceof Error ? e.message.split('\n')[0].slice(0, 140) : 'Claim failed'); }
  }

  return (
    <Rise delay={i * 0.08} className="overflow-hidden rounded-blob border border-ink/10 bg-paper/70 backdrop-blur-xl">
      <div className="grid gap-8 p-6 md:grid-cols-12 md:p-10">
        <div className="md:col-span-5">
          <Kicker>{v.row.hostName}</Kicker>
          <h2 className="mt-2 font-display text-4xl font-semibold leading-none md:text-5xl">{v.row.sale?.tokenName}</h2>
          <p className="mt-1 font-mono text-sm text-ink-mute">{v.row.sale?.tokenSymbol}</p>
          <dl className="mt-8 grid grid-cols-2 gap-5">
            <div><dt><Kicker>Allocation</Kicker></dt><dd className="mt-1 font-mono text-xl"><Redacted active={priv}>{fmt(v.total, 2)}</Redacted></dd></div>
            <div><dt><Kicker>Claimed</Kicker></dt><dd className="mt-1 font-mono text-xl"><Redacted active={priv}>{fmt(claimed, 2)}</Redacted></dd></div>
            <div><dt><Kicker>At unlock</Kicker></dt><dd className="mt-1 font-mono text-xl">{v.tgePct}%</dd></div>
            <div><dt><Kicker>Schedule</Kicker></dt><dd className="mt-1 font-mono text-sm">{v.cliffDays}d cliff · {v.linearDays}d linear</dd></div>
          </dl>
        </div>

        <div className="md:col-span-7">
          {/* schedule bar */}
          <div className="relative">
            <div className="relative h-16 overflow-hidden rounded-full bg-frost">
              <div className="absolute inset-y-0 left-0 border-r-2 border-dashed border-ink/30 bg-ink/[0.06]" style={{ width: `${cliffPct}%` }} />
              <motion.div className="absolute inset-y-0 left-0 rounded-full bg-lemon" initial={{ width: 0 }} animate={{ width: `${(vested / v.total) * 100}%` }} transition={{ duration: 1.2, ease }} />
              <motion.div className="absolute inset-y-0 left-0 rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${(claimed / v.total) * 100}%` }} transition={{ duration: 1.2, ease, delay: 0.2 }} />
              <motion.div className="absolute inset-y-[-6px] w-1 rounded-full bg-ink" initial={{ left: 0 }} animate={{ left: `${elapsed * 100}%` }} transition={{ duration: 1.2, ease }} />
            </div>
            <div className="relative mt-2 flex justify-between font-mono text-[11px] text-ink-mute">
              <span>{fmtDate(v.startIso)}</span>
              <span className="absolute -translate-x-1/2 max-sm:hidden" style={{ left: `${cliffPct}%` }}>cliff</span>
              <span>{fmtDate(new Date(start + (v.cliffDays + v.linearDays) * 864e5).toISOString())}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 font-label text-[10px] uppercase tracking-[0.18em] text-ink-soft">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-ink" />claimed</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-lemon" />vested</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-frost ring-1 ring-ink/10" />locked</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-6 rounded-3xl bg-ink p-6 text-paper">
            <div>
              <Kicker className="text-lemon">Claimable now</Kicker>
              <p className="mt-1 font-mono text-4xl"><Redacted active={priv}>{fmt(claimable, 2)}</Redacted></p>
            </div>
            <Button variant="lemon" disabled={claimable <= 0 || isPending} onClick={claim}>{isPending ? 'Confirm in wallet' : 'Claim'}</Button>
          </div>

          <label className="mt-5 flex cursor-pointer items-center gap-3">
            <span className={cx('relative h-6 w-11 rounded-full transition', fresh ? 'bg-lemon ring-1 ring-ink' : 'bg-ink/15')}>
              <motion.span layout className={cx('absolute top-1 h-4 w-4 rounded-full bg-ink', fresh ? 'right-1' : 'left-1')} />
            </span>
            <input type="checkbox" className="sr-only" checked={fresh} onChange={(e) => setFresh(e.target.checked)} />
            <span className="font-label text-xs font-semibold uppercase tracking-[0.16em]">Claim to a fresh wallet</span>
          </label>
          <AnimatePresence>
            {fresh && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Field label="Destination" hint="never used before is best" className="mt-4">
                  <Input mono value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>
          {note && <p className="mt-4 font-serif italic text-ink-soft">{note}</p>}
        </div>
      </div>
    </Rise>
  );
}
