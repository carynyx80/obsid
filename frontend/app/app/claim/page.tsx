'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { formatUnits, isAddress, type Address } from 'viem';
import { useReadContracts, useWriteContract } from 'wagmi';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import ConnectWallet from '@/components/ui/ConnectWallet';
import Redacted from '@/components/ui/Redacted';
import { fetchSales } from '@/lib/api';
import { useRole } from '@/lib/role';
import { VESTING_VAULT_ABI, useContracts } from '@/components/hostbuyer/abis';
import { saleAddress } from '@/components/core/contracts';
import { useSaleDecimals } from '@/components/core/useSaleChain';
import { CHAIN_ID, errMsg, txUrl } from '@/lib/chain';
import type { Sale } from '@/lib/types';
import { allBids, vestedAt, vestingFor, type Vesting } from '@/components/hostbuyer/bids';
import { DemoNote, Field, Input, Kicker, PageHead, Rise, cx, ease, fmt, fmtDate, short, useAuth } from '@/components/hostbuyer/kit';

export default function ClaimPage() {
  const { role } = useRole();
  const { isConnected, address } = useAuth();
  const { contracts } = useContracts();
  const vault = contracts.VestingVault;
  const [list, setList] = useState<Vesting[] | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  useEffect(() => { fetchSales().then((s) => { setSales(s); setList(vestingFor(allBids(s))); }); }, []);
  const priv = role !== 'host';
  const onchainSales = sales.filter((s) => saleAddress(s));

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
        {vault && address && onchainSales.length > 0 && <OnchainClaims vault={vault} sales={onchainSales} holder={address} priv={priv} />}
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
  const vault = useContracts().contracts.VestingVault;
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
    const saleAddr = v.row.sale ? saleAddress(v.row.sale) : null;
    if (!vault || !saleAddr) {
      setClaimed((c) => c + claimable);
      setNote(`Demo claim sent to ${short(dest)}. Onchain claims appear above once the sale and vesting vault are live.`);
      return;
    }
    try {
      const hash = await writeContractAsync({ address: vault, abi: VESTING_VAULT_ABI, functionName: 'claim', args: [saleAddr, dest as Address], chainId: CHAIN_ID });
      setClaimed((c) => c + claimable);
      setNote(`Submitted ${short(hash)}`);
    } catch (e) { setNote(errMsg(e)); }
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

/* ---------- live VestingVault positions ---------- */
type Pos = { sale: Sale; addr: Address; total: bigint; claimed: bigint; claimable: bigint; tgeTime: number; tgeBps: number; cliff: number; duration: number; decimals: number };

function OnchainClaims({ vault, sales, holder, priv }: { vault: Address; sales: Sale[]; holder: Address; priv: boolean }) {
  const addrs = sales.map((s) => saleAddress(s)!) as Address[];
  const decimals = useSaleDecimals(addrs);
  const reads = useReadContracts({
    allowFailure: true,
    contracts: addrs.flatMap((a) => [
      { address: vault, abi: VESTING_VAULT_ABI, functionName: 'positions', args: [a, holder], chainId: CHAIN_ID },
      { address: vault, abi: VESTING_VAULT_ABI, functionName: 'claimable', args: [a, holder], chainId: CHAIN_ID },
      { address: vault, abi: VESTING_VAULT_ABI, functionName: 'schedules', args: [a], chainId: CHAIN_ID },
    ]),
    query: { refetchInterval: 30_000 },
  });
  const rows: Pos[] = [];
  addrs.forEach((a, i) => {
    const d = reads.data;
    const p = d?.[i * 3]?.status === 'success' ? (d[i * 3].result as readonly [bigint, bigint]) : undefined;
    const c = d?.[i * 3 + 1]?.status === 'success' ? (d[i * 3 + 1].result as bigint) : 0n;
    const sc = d?.[i * 3 + 2]?.status === 'success' ? (d[i * 3 + 2].result as readonly [Address, Address, bigint, number, bigint, bigint, boolean]) : undefined;
    if (!p || p[0] === 0n) return;
    rows.push({ sale: sales[i], addr: a, total: p[0], claimed: p[1], claimable: c, tgeTime: Number(sc?.[2] ?? 0n), tgeBps: Number(sc?.[3] ?? 0), cliff: Number(sc?.[4] ?? 0n), duration: Number(sc?.[5] ?? 0n), decimals: decimals[a.toLowerCase()] ?? 18 });
  });
  if (reads.isLoading) return <div className="mb-8 h-32 animate-pulse rounded-blob bg-chalk" />;
  if (!rows.length) return <p className="mb-8 font-serif text-lg italic text-ink-mute">No vesting positions onchain for this wallet yet. Settle your bid on the sale page first.</p>;
  return <div className="mb-10 space-y-6">{rows.map((r) => <OnchainCard key={r.addr} p={r} vault={vault} priv={priv} onDone={() => reads.refetch()} />)}</div>;
}

function OnchainCard({ p, vault, priv, onDone }: { p: Pos; vault: Address; priv: boolean; onDone: () => void }) {
  const { address } = useAuth();
  const [fresh, setFresh] = useState(false);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const { writeContractAsync, isPending } = useWriteContract();
  const n = (x: bigint) => fmt(Number(formatUnits(x, p.decimals)), 4);
  const dest = fresh ? to : address;
  const day = 86400;
  async function claim() {
    setNote('');
    if (!dest || !isAddress(dest)) return setNote('Enter a valid address');
    try {
      const hash = await writeContractAsync({ address: vault, abi: VESTING_VAULT_ABI, functionName: 'claim', args: [p.addr, dest as Address], chainId: CHAIN_ID });
      setNote(`Submitted ${short(hash)}`);
      setTimeout(onDone, 6000);
      window.open(txUrl(hash), '_blank', 'noopener');
    } catch (e) { setNote(errMsg(e)); }
  }
  return (
    <Rise className="overflow-hidden rounded-blob border border-ink bg-paper/80 p-6 backdrop-blur-xl md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Kicker>Live onchain position</Kicker>
          <h2 className="mt-2 font-display text-4xl font-semibold leading-none">{p.sale.tokenName}</h2>
          <p className="mt-1 font-mono text-sm text-ink-mute">{p.sale.tokenSymbol}</p>
        </div>
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <div><dt><Kicker>Allocation</Kicker></dt><dd className="mt-1 font-mono text-lg"><Redacted active={priv}>{n(p.total)}</Redacted></dd></div>
          <div><dt><Kicker>Claimed</Kicker></dt><dd className="mt-1 font-mono text-lg"><Redacted active={priv}>{n(p.claimed)}</Redacted></dd></div>
          <div><dt><Kicker>At unlock</Kicker></dt><dd className="mt-1 font-mono text-lg">{p.tgeBps / 100}%</dd></div>
          <div><dt><Kicker>Schedule</Kicker></dt><dd className="mt-1 font-mono text-sm">{Math.round(p.cliff / day)}d cliff · {Math.round(p.duration / day)}d linear</dd></div>
        </dl>
      </div>
      <p className="mt-4 font-mono text-xs text-ink-mute">Unlock starts {p.tgeTime ? fmtDate(new Date(p.tgeTime * 1000).toISOString()) : 'when set'}</p>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-6 rounded-3xl bg-ink p-6 text-paper">
        <div>
          <Kicker className="text-lemon">Claimable now</Kicker>
          <p className="mt-1 font-mono text-4xl"><Redacted active={priv}>{n(p.claimable)}</Redacted></p>
        </div>
        <Button variant="lemon" disabled={p.claimable === 0n || isPending} onClick={claim}>{isPending ? 'Confirm in wallet' : 'Claim'}</Button>
      </div>
      <label className="mt-5 flex cursor-pointer items-center gap-3">
        <span className={cx('relative h-6 w-11 rounded-full transition', fresh ? 'bg-lemon ring-1 ring-ink' : 'bg-ink/15')}>
          <motion.span layout className={cx('absolute top-1 h-4 w-4 rounded-full bg-ink', fresh ? 'right-1' : 'left-1')} />
        </span>
        <input type="checkbox" className="sr-only" checked={fresh} onChange={(e) => setFresh(e.target.checked)} />
        <span className="font-label text-xs font-semibold uppercase tracking-[0.16em]">Claim to a fresh wallet</span>
      </label>
      {fresh && (
        <Field label="Destination" hint="never used before is best" className="mt-4">
          <Input mono value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" />
        </Field>
      )}
      {note && <p className="mt-4 font-serif italic text-ink-soft">{note}</p>}
    </Rise>
  );
}
