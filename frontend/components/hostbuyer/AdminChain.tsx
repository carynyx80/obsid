'use client';
// Admin onchain actions: create sale from an application, per sale controls, escrow milestones, singleton controls.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEther, formatUnits, isAddress, parseEther, parseEventLogs, parseUnits, type Abi, type Address, type Hash, type TransactionReceipt } from 'viem';
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import Button from '@/components/ui/Button';
import type { Sale } from '@/lib/types';
import {
  ALLOCATION_MARKET_ABI, CHAIN_ID, OBSID_STAKING_ABI, CONTRACT_NAMES, LIQUIDITY_LOCKER_ABI, MILESTONE_ESCROW_ABI, PARTICIPATION_BADGE_ABI, SALE_FACTORY_ABI,
  SEALED_BID_SALE_ABI, VESTING_VAULT_ABI, addressUrl, defaultTickGrid, errMsg, erc20Abi, pricePerWholeToken, txUrl, useContracts,
} from '@/lib/chain';
import { saleAddress } from '@/components/core/contracts';
import { useSaleChain } from '@/components/core/useSaleChain';
import { adminPatchSale, type Application } from './client';
import { Field, Input, Kicker, Tag, cx, fmt, short, useAuth } from './kit';

/* ---------------------------------------------------------------- tx helper */

type WriteReq = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint };

export function useTx() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { chainId } = useAccount();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [hash, setHash] = useState<Hash | undefined>();
  const run = async (label: string, req: WriteReq): Promise<TransactionReceipt | null> => {
    setNote(''); setHash(undefined);
    if (chainId !== CHAIN_ID) { setNote('Switch your wallet to BNB Smart Chain (56) first.'); return null; }
    setBusy(label);
    try {
      const h = await writeContractAsync({ ...req, chainId: CHAIN_ID } as unknown as Parameters<typeof writeContractAsync>[0]);
      setHash(h);
      setNote(`${label}: waiting for confirmation`);
      const rc = await publicClient!.waitForTransactionReceipt({ hash: h });
      if (rc.status !== 'success') throw new Error('Transaction reverted');
      setNote(`${label}: confirmed`);
      return rc;
    } catch (e) { setNote(`${label}: ${errMsg(e)}`); return null; }
    finally { setBusy(null); }
  };
  return { run, busy, note, hash, setNote };
}

export function TxNote({ note, hash }: { note: string; hash?: Hash }) {
  if (!note && !hash) return null;
  return (
    <p className="mt-3 break-words font-mono text-xs text-ink-soft">
      {note}{hash && <> · <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="underline decoration-lemon decoration-2 underline-offset-4">{short(hash)}</a></>}
    </p>
  );
}

const toLocal = (iso: string) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const toUnix = (local: string) => Math.floor(new Date(local).getTime() / 1000);
const bnbP = (w: bigint) => { const n = Number(formatEther(w)); return n === 0 ? '0' : n < 0.0001 ? n.toPrecision(4) : n.toLocaleString('en-US', { maximumFractionDigits: 8 }); };
const createdKey = (appId: string) => `obsid.admin.created.${appId}`;

/* ---------------------------------------------------------------- create sale */

export function CreateOnchainSale({ app, saleId, onDone }: { app: Application; saleId?: string; onDone: (addr: Address) => void }) {
  const { contracts } = useContracts();
  const factory = contracts.SaleFactory;
  const { auth } = useAuth();
  const { run, busy, note, hash, setNote } = useTx();

  const [host, setHost] = useState(app.hostAddress);
  const [token, setToken] = useState(app.tokenAddress);
  const [numTicks, setNumTicks] = useState('50');
  const [start, setStart] = useState(toLocal(app.start));
  const [end, setEnd] = useState(toLocal(app.end));
  const [revealEnd, setRevealEnd] = useState(toLocal(app.revealEnd));
  const [tge, setTge] = useState(toLocal(app.revealEnd));
  const [tgePct, setTgePct] = useState('20');
  const [cliffDays, setCliffDays] = useState('30');
  const [durationDays, setDurationDays] = useState('180');
  const [babt, setBabt] = useState(false);
  const [created, setCreated] = useState<Address | null>(null);

  useEffect(() => { try { const v = localStorage.getItem(createdKey(app.id)); if (v && isAddress(v)) setCreated(v as Address); } catch {} }, [app.id]);

  const fr = useReadContracts({
    allowFailure: true,
    contracts: factory ? (['maxHardCap', 'platformFeeBps', 'babt', 'paused'] as const).map((fn) => ({ address: factory, abi: SALE_FACTORY_ABI, functionName: fn, chainId: CHAIN_ID })) : [],
    query: { enabled: !!factory },
  });
  const maxHardCap = fr.data?.[0]?.status === 'success' ? (fr.data[0].result as bigint) : undefined;
  const feeBps = fr.data?.[1]?.status === 'success' ? Number(fr.data[1].result) : undefined;
  const factoryBabt = fr.data?.[2]?.status === 'success' ? (fr.data[2].result as Address) : undefined;
  const factoryPaused = fr.data?.[3]?.status === 'success' ? (fr.data[3].result as boolean) : false;
  const dec = useReadContract({ address: isAddress(token) ? (token as Address) : undefined, abi: erc20Abi, functionName: 'decimals', chainId: CHAIN_ID, query: { enabled: isAddress(token) } });
  const decimals = dec.data !== undefined ? Number(dec.data) : undefined;

  const built = useMemo(() => {
    const problems: string[] = [];
    if (!isAddress(host)) problems.push('Host wallet is not a valid address.');
    if (!isAddress(token)) problems.push('Sale token address is required (the host must deploy the token first).');
    if (decimals === undefined) problems.push('Could not read token decimals from the sale token.');
    const d = decimals ?? 18;
    const grid = defaultTickGrid({ minPriceBnb: app.minPrice, hardCapBnb: app.hardCapBnb, supply: app.supply, decimals: d, numTicks: Number(numTicks) || 1 });
    let supply = 0n;
    try { supply = parseUnits(String(app.supply), d); } catch { problems.push('Supply cannot be converted to token units.'); }
    const maxPrice = grid.minPrice + BigInt(Math.max(0, grid.numTicks - 1)) * grid.tickSize;
    const maxRaise = (supply * maxPrice) / 10n ** 18n;
    const softCap = parseEther(String(app.softCapBnb));
    const s = toUnix(start), e = toUnix(end), r = toUnix(revealEnd), t = toUnix(tge);
    const now = Math.floor(Date.now() / 1000);
    if (!(s > now + 60)) problems.push('Start time must be in the future (contract requires startTime >= now).');
    if (!(e > s)) problems.push('End must be after start.');
    if (!(r > e)) problems.push('Reveal end must be after end.');
    if (!(t >= r)) problems.push('Unlock (TGE) time must be at or after reveal end.');
    const milestoneBps = app.milestones.map((m) => Math.round(m.pct * 100));
    const atCloseBps = 10000 - milestoneBps.reduce((a, b) => a + b, 0);
    if (milestoneBps.some((b) => b <= 0)) problems.push('Every milestone needs a share above zero.');
    if (atCloseBps < 0 || atCloseBps > 10000) problems.push('Escrow shares exceed 100%.');
    if (app.milestones.length > 20) problems.push('At most 20 milestones.');
    const tgeBps = Math.round(Number(tgePct) * 100);
    if (!(tgeBps >= 0 && tgeBps <= 10000)) problems.push('Unlock share must be between 0 and 100%.');
    if (maxHardCap !== undefined && maxRaise > maxHardCap) problems.push(`Max raise ${bnbP(maxRaise)} BNB exceeds the factory cap of ${bnbP(maxHardCap)} BNB. Lower the ticks or raise the cap with setMaxHardCap.`);
    if (softCap > maxRaise) problems.push('Soft cap is above the max raise.');
    if (babt && (!factoryBabt || /^0x0{40}$/i.test(factoryBabt))) problems.push('BABT gating needs a BABT address set on the factory.');
    const params = {
      host: host as Address,
      saleToken: token as Address,
      supply,
      minPrice: grid.minPrice,
      tickSize: grid.tickSize,
      numTicks: grid.numTicks,
      softCap,
      startTime: BigInt(s || 0),
      endTime: BigInt(e || 0),
      revealEndTime: BigInt(r || 0),
      babtRequired: babt,
      vesting: { tgeTime: BigInt(t || 0), tgeBps, cliff: BigInt(Math.round(Number(cliffDays) * 86400) || 0), duration: BigInt(Math.round(Number(durationDays) * 86400) || 0) },
      atCloseBps,
      milestoneLabels: app.milestones.map((m) => m.label),
      milestoneBps,
    };
    return { params, problems, grid, maxRaise, decimals: d };
  }, [host, token, decimals, numTicks, start, end, revealEnd, tge, tgePct, cliffDays, durationDays, babt, app, maxHardCap, factoryBabt]);

  const attach = async (addr: Address) => {
    if (!saleId) { setNote(`Sale ${addr} created. No backend sale id to attach it to; approve the application first.`); return; }
    try { await adminPatchSale(saleId, { contractAddress: addr }, await auth()); setNote(`Sale ${short(addr)} created and saved to the backend.`); onDone(addr); }
    catch (e) { setNote(`Sale ${addr} created, but saving to the backend failed: ${errMsg(e)}. Use retry.`); }
  };

  const create = async () => {
    if (!factory) return;
    const rc = await run('Create sale', { address: factory, abi: SALE_FACTORY_ABI, functionName: 'createSale', args: [built.params] });
    if (!rc) return;
    const ev = parseEventLogs({ abi: SALE_FACTORY_ABI, eventName: 'SaleCreated', logs: rc.logs }) as unknown as { args: { sale: Address; escrow: Address } }[];
    const addr = ev[0]?.args.sale;
    if (!addr) { setNote('Sale created but the SaleCreated event was not found in the receipt. Check BscScan.'); return; }
    try { localStorage.setItem(createdKey(app.id), addr); } catch {}
    setCreated(addr);
    await attach(addr);
  };

  if (!factory) return <p className="font-body text-sm text-ink-soft">No SaleFactory address configured. <Link href="/deploy" className="underline decoration-lemon decoration-2 underline-offset-4">Deploy the contracts</Link> first.</p>;

  if (created) {
    return (
      <div className="rounded-3xl bg-lemon p-5">
        <Kicker className="text-ink">Onchain sale created</Kicker>
        <a href={addressUrl(created)} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-sm underline">{created}</a>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="ink" onClick={() => attach(created)}>Retry saving to backend</Button>
          <Button size="sm" variant="ghost" onClick={() => { try { localStorage.removeItem(createdKey(app.id)); } catch {} setCreated(null); }}>Forget</Button>
        </div>
        <TxNote note={note} hash={hash} />
      </div>
    );
  }

  const g = built.grid;
  return (
    <div className="rounded-3xl border border-ink/15 bg-chalk p-5">
      <Kicker className="text-ink">Create onchain sale</Kicker>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Host wallet"><Input mono value={host} onChange={(e) => setHost(e.target.value.trim())} /></Field>
        <Field label="Sale token" hint={decimals !== undefined ? `${decimals} decimals` : 'reading'}><Input mono value={token} onChange={(e) => setToken(e.target.value.trim())} placeholder="0x…" /></Field>
        <Field label="Bidding opens"><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Bidding closes"><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        <Field label="Reveal ends"><Input type="datetime-local" value={revealEnd} onChange={(e) => setRevealEnd(e.target.value)} /></Field>
        <Field label="Price ticks" hint="1 to 200"><Input mono inputMode="numeric" value={numTicks} onChange={(e) => setNumTicks(e.target.value)} /></Field>
        <Field label="Unlock time (TGE)"><Input type="datetime-local" value={tge} onChange={(e) => setTge(e.target.value)} /></Field>
        <Field label="Unlocked at TGE" hint="%"><Input mono inputMode="decimal" value={tgePct} onChange={(e) => setTgePct(e.target.value)} /></Field>
        <Field label="Cliff" hint="days"><Input mono inputMode="decimal" value={cliffDays} onChange={(e) => setCliffDays(e.target.value)} /></Field>
        <Field label="Linear vesting" hint="days"><Input mono inputMode="decimal" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} /></Field>
      </div>
      <label className="mt-4 flex items-center gap-2 font-body text-sm"><input type="checkbox" checked={babt} onChange={(e) => setBabt(e.target.checked)} /> Require BABT holders only</label>
      <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-3">
        <div><dt><Kicker>Floor</Kicker></dt><dd>{bnbP(pricePerWholeToken(g.minPrice, built.decimals))} BNB</dd></div>
        <div><dt><Kicker>Step</Kicker></dt><dd>{bnbP(pricePerWholeToken(g.tickSize, built.decimals))} BNB</dd></div>
        <div><dt><Kicker>Top tick</Kicker></dt><dd>{bnbP(pricePerWholeToken(g.minPrice + BigInt(Math.max(0, g.numTicks - 1)) * g.tickSize, built.decimals))} BNB</dd></div>
        <div><dt><Kicker>Max raise</Kicker></dt><dd>{bnbP(built.maxRaise)} BNB</dd></div>
        <div><dt><Kicker>Factory cap</Kicker></dt><dd>{maxHardCap !== undefined ? `${bnbP(maxHardCap)} BNB` : '…'}</dd></div>
        <div><dt><Kicker>Fee</Kicker></dt><dd>{feeBps !== undefined ? `${feeBps / 100}%` : '…'}</dd></div>
        <div><dt><Kicker>At close</Kicker></dt><dd>{built.params.atCloseBps / 100}%</dd></div>
        <div className="col-span-2"><dt><Kicker>Milestones</Kicker></dt><dd>{app.milestones.map((m, i) => `${m.label} ${built.params.milestoneBps[i] / 100}%`).join(' · ') || 'none'}</dd></div>
      </dl>
      {factoryPaused && <p className="mt-3 font-body text-sm text-red-700">The factory is paused. Unpause it in the Contracts tab first.</p>}
      {built.problems.length > 0 && <ul className="mt-3 list-disc pl-5 font-body text-sm text-red-700">{built.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      <p className="mt-3 font-body text-xs text-ink-mute">After creation the host must approve the sale contract for the full supply and call fund() before bidding opens.</p>
      <div className="mt-4"><Button size="sm" variant="ink" disabled={!!busy || built.problems.length > 0 || factoryPaused} onClick={create}>{busy ? 'Confirm in wallet' : 'Create onchain sale'}</Button></div>
      <TxNote note={note} hash={hash} />
    </div>
  );
}

/* ---------------------------------------------------------------- per sale */

export function SaleChainControls({ sale }: { sale: Sale }) {
  const addr = saleAddress(sale);
  const chain = useSaleChain(addr);
  const { run, busy, note, hash } = useTx();
  if (!addr) return <p className="mt-2 font-label text-[9px] uppercase tracking-[0.2em] text-ink-mute">no onchain contract yet</p>;
  if (!chain?.loaded) return <p className="mt-2 font-mono text-xs text-ink-mute">Reading {short(addr)}…</p>;
  const call = async (label: string, fn: string) => { const rc = await run(label, { address: addr, abi: SEALED_BID_SALE_ABI, functionName: fn }); if (rc) chain.refetch(); };
  return (
    <div className="mt-4">
      <p className="font-mono text-xs text-ink-mute">
        <a href={addressUrl(addr)} target="_blank" rel="noreferrer" className="underline">{short(addr)}</a> · {chain.state} · {chain.phase}{chain.paused ? ' · paused' : ''}{chain.funded ? ' · funded' : ' · not funded'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {chain.paused
          ? <Button size="sm" variant="lemon" disabled={!!busy} onClick={() => call('Unpause sale', 'unpause')}>Unpause</Button>
          : <Button size="sm" variant="ink" disabled={!!busy} onClick={() => call('Pause sale', 'pause')}>Pause sale</Button>}
        {chain.state === 'Pending' && chain.phase === 'finalize' && <Button size="sm" variant="lemon" disabled={!!busy || chain.paused} onClick={() => call('Finalize', 'finalize')}>Finalize</Button>}
        {chain.state === 'Pending' && (
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => { if (window.confirm('Cancel this sale? Every bidder gets a full refund. This cannot be undone.')) call('Cancel sale', 'cancel'); }}>Cancel sale</Button>
        )}
      </div>
      <TxNote note={note} hash={hash} />
    </div>
  );
}

export function EscrowChainControls({ sale }: { sale: Sale }) {
  const addr = saleAddress(sale);
  const chain = useSaleChain(addr);
  const escrow = chain?.escrow;
  const { run, busy, note, hash } = useTx();
  const { auth } = useAuth();
  const head = useReadContracts({
    allowFailure: true,
    contracts: escrow ? (['milestoneCount', 'funded', 'refundMode', 'paused', 'lockedAmount', 'hostClaimable', 'totalFunded', 'votesFor', 'totalWeight'] as const).map((fn) => ({ address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: fn, chainId: CHAIN_ID })) : [],
    query: { enabled: !!escrow },
  });
  const h = <T,>(i: number, fb: T) => (head.data?.[i]?.status === 'success' ? (head.data[i].result as T) : fb);
  const count = Number(h<bigint>(0, 0n));
  const ms = useReadContracts({
    allowFailure: true,
    contracts: escrow ? Array.from({ length: count }, (_, i) => ({ address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: 'milestone', args: [BigInt(i)], chainId: CHAIN_ID })) : [],
    query: { enabled: !!escrow && count > 0 },
  });
  if (!addr) return null;
  if (!escrow) return <p className="mt-3 font-mono text-xs text-ink-mute">Reading escrow…</p>;
  const funded = h(1, false), refundMode = h(2, false), paused = h(3, false);
  const refresh = () => { head.refetch(); ms.refetch(); };
  const call = async (label: string, fn: string, args: readonly unknown[] = []) => { const rc = await run(label, { address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: fn, args }); if (rc) refresh(); return rc; };
  const milestones = Array.from({ length: count }, (_, i) => {
    const r = ms.data?.[i]?.status === 'success' ? (ms.data[i].result as readonly [string, number, bigint, boolean]) : undefined;
    return { label: r?.[0] ?? `Milestone ${i + 1}`, bps: Number(r?.[1] ?? 0), amount: r?.[2] ?? 0n, released: r?.[3] ?? false };
  });
  const release = async (i: number) => {
    const rc = await call(`Release ${milestones[i].label}`, 'releaseMilestone', [BigInt(i)]);
    if (rc && sale.escrow.milestones.length === milestones.length) {
      try { await adminPatchSale(sale.id, { milestonesReleased: milestones.map((m, j) => m.released || j === i) }, await auth()); } catch {}
    }
  };
  return (
    <div className="mt-6 rounded-3xl border border-ink/15 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-ink-mute">
          Escrow <a href={addressUrl(escrow)} target="_blank" rel="noreferrer" className="underline">{short(escrow)}</a> · {funded ? `funded ${bnbP(h(6, 0n))} BNB` : 'not funded'} · locked {bnbP(h(4, 0n))} BNB · host claimable {bnbP(h(5, 0n))} BNB
          {refundMode ? ' · refund mode' : ''}{paused ? ' · paused' : ''} · refund votes {fmt(Number(h(7, 0n)) / Math.max(1, Number(h(8, 1n))) * 100, 1)}%
        </p>
        <div className="flex flex-wrap gap-2">
          {paused
            ? <Button size="sm" variant="lemon" disabled={!!busy} onClick={() => call('Unpause escrow', 'unpause')}>Unpause escrow</Button>
            : <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => call('Pause escrow', 'pause')}>Pause escrow</Button>}
          {funded && !refundMode && (
            <Button size="sm" variant="ink" disabled={!!busy} onClick={() => { if (window.confirm('Switch this escrow into refund mode? All locked BNB becomes claimable by buyers. This cannot be undone.')) call('Trigger refund mode', 'triggerRefundMode'); }}>Trigger refund mode</Button>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {milestones.map((m, i) => (
          <div key={i} className={cx('flex items-center justify-between gap-4 rounded-3xl p-5', m.released ? 'bg-chalk' : 'bg-ink text-paper')}>
            <div>
              <p className="font-body font-medium">{m.label}</p>
              <p className={cx('font-mono text-sm', m.released ? 'text-ink-mute' : 'text-lemon')}>{m.bps / 100}% · {bnbP(m.amount)} BNB</p>
            </div>
            {m.released ? <Tag tone="line">Released</Tag> : <Button size="sm" variant="lemon" disabled={!!busy || !funded || refundMode || paused} onClick={() => release(i)}>Release</Button>}
          </div>
        ))}
      </div>
      <TxNote note={note} hash={hash} />
    </div>
  );
}

/* ---------------------------------------------------------------- singletons */

const SINGLETONS = [
  { name: 'SaleFactory', abi: SALE_FACTORY_ABI },
  { name: 'VestingVault', abi: VESTING_VAULT_ABI },
  { name: 'ParticipationBadge', abi: PARTICIPATION_BADGE_ABI },
  { name: 'AllocationMarket', abi: ALLOCATION_MARKET_ABI },
  { name: 'LiquidityLocker', abi: LIQUIDITY_LOCKER_ABI },
  { name: 'ObsidStaking', abi: OBSID_STAKING_ABI },
] as const;

export function ContractsPanel() {
  const { contracts, refetch } = useContracts();
  const { run, busy, note, hash } = useTx();
  const paused = useReadContracts({
    allowFailure: true,
    contracts: SINGLETONS.filter((s) => contracts[s.name]).map((s) => ({ address: contracts[s.name]!, abi: s.abi, functionName: 'paused', chainId: CHAIN_ID })),
  });
  const fees = useReadContracts({
    allowFailure: true,
    contracts: [
      ...(contracts.SaleFactory ? (['platformFeeBps', 'feeRecipient', 'maxHardCap', 'owner'] as const).map((fn) => ({ address: contracts.SaleFactory!, abi: SALE_FACTORY_ABI, functionName: fn, chainId: CHAIN_ID })) : []),
      ...(contracts.AllocationMarket ? (['feeBps', 'feeRecipient'] as const).map((fn) => ({ address: contracts.AllocationMarket!, abi: ALLOCATION_MARKET_ABI, functionName: fn, chainId: CHAIN_ID })) : []),
    ],
  });
  const f = (i: number) => (fees.data?.[i]?.status === 'success' ? fees.data[i].result : undefined);
  const off = contracts.SaleFactory ? 4 : 0;
  const [pf, setPf] = useState({ bps: '', to: '' });
  const [mf, setMf] = useState({ bps: '', to: '' });
  const [cap, setCap] = useState('');
  const present = SINGLETONS.filter((s) => contracts[s.name]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-blob border border-ink p-6">
        <div>
          <Kicker>Deployment</Kicker>
          <p className="mt-1 font-body text-ink-soft">Deploy and wire the full contract stack from the admin wallet, then save addresses to the backend.</p>
        </div>
        <Button href="/deploy" variant="lemon">Open deploy page</Button>
      </div>

      <div className="rounded-blob border border-ink/10 p-6">
        <Kicker>Address registry</Kicker>
        <ul className="mt-4 divide-y divide-ink/10">
          {CONTRACT_NAMES.map((n) => (
            <li key={n} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span className="font-body">{n}</span>
              {contracts[n] ? <a href={addressUrl(contracts[n]!)} target="_blank" rel="noreferrer" className="break-all font-mono text-xs underline">{contracts[n]}</a> : <span className="font-mono text-xs text-ink-mute">not set</span>}
            </li>
          ))}
        </ul>
        <div className="mt-3"><Button size="sm" variant="ghost" onClick={() => refetch()}>Reload</Button></div>
      </div>

      {present.length > 0 && (
        <div className="rounded-blob border border-ink/10 p-6">
          <Kicker>Pause switches</Kicker>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {present.map((s, i) => {
              const p = paused.data?.[i]?.status === 'success' ? (paused.data[i].result as boolean) : undefined;
              return (
                <div key={s.name} className={cx('flex items-center justify-between gap-3 rounded-3xl p-4', p ? 'bg-ink text-paper' : 'bg-chalk')}>
                  <div><p className="font-body font-medium">{s.name}</p><p className="font-mono text-xs opacity-70">{p === undefined ? '…' : p ? 'paused' : 'live'}</p></div>
                  <Button size="sm" variant={p ? 'lemon' : 'ink'} disabled={!!busy || p === undefined} onClick={async () => { const rc = await run(`${p ? 'Unpause' : 'Pause'} ${s.name}`, { address: contracts[s.name]!, abi: s.abi, functionName: p ? 'unpause' : 'pause' }); if (rc) paused.refetch(); }}>{p ? 'Unpause' : 'Pause'}</Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {contracts.SaleFactory && (
        <div className="rounded-blob border border-ink/10 p-6">
          <Kicker>Platform fee (SaleFactory)</Kicker>
          <p className="mt-1 font-mono text-xs text-ink-mute">Now {f(0) !== undefined ? `${Number(f(0)) / 100}%` : '…'} to {f(1) ? short(String(f(1))) : '…'} · applies to sales created afterwards · max 10% · owner {f(3) ? short(String(f(3))) : '…'}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
            <Field label="Fee" hint="bps, 100 = 1%"><Input mono value={pf.bps} onChange={(e) => setPf({ ...pf, bps: e.target.value })} placeholder={f(0) !== undefined ? String(f(0)) : '200'} /></Field>
            <Field label="Recipient"><Input mono value={pf.to} onChange={(e) => setPf({ ...pf, to: e.target.value.trim() })} placeholder={f(1) ? String(f(1)) : '0x…'} /></Field>
            <Button size="sm" variant="ink" disabled={!!busy} onClick={async () => {
              const bps = Number(pf.bps || f(0)); const to = pf.to || String(f(1) ?? '');
              if (!(bps >= 0 && bps <= 1000) || !isAddress(to)) return;
              const rc = await run('Set platform fee', { address: contracts.SaleFactory!, abi: SALE_FACTORY_ABI, functionName: 'setPlatformFee', args: [bps, to] }); if (rc) fees.refetch();
            }}>Set platform fee</Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
            <Field label="Max hard cap" hint={`now ${f(2) !== undefined ? bnbP(f(2) as bigint) : '…'} BNB`}><Input mono value={cap} onChange={(e) => setCap(e.target.value)} placeholder="500" /></Field>
            <span />
            <Button size="sm" variant="ghost" disabled={!!busy || !(Number(cap) > 0)} onClick={async () => { const rc = await run('Set max hard cap', { address: contracts.SaleFactory!, abi: SALE_FACTORY_ABI, functionName: 'setMaxHardCap', args: [parseEther(cap)] }); if (rc) fees.refetch(); }}>Set max hard cap</Button>
          </div>
        </div>
      )}

      {contracts.AllocationMarket && (
        <div className="rounded-blob border border-ink/10 p-6">
          <Kicker>Market fee (AllocationMarket)</Kicker>
          <p className="mt-1 font-mono text-xs text-ink-mute">Now {f(off) !== undefined ? `${Number(f(off)) / 100}%` : '…'} to {f(off + 1) ? short(String(f(off + 1))) : '…'} · max 10%</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
            <Field label="Fee" hint="bps"><Input mono value={mf.bps} onChange={(e) => setMf({ ...mf, bps: e.target.value })} placeholder={f(off) !== undefined ? String(f(off)) : '100'} /></Field>
            <Field label="Recipient"><Input mono value={mf.to} onChange={(e) => setMf({ ...mf, to: e.target.value.trim() })} placeholder={f(off + 1) ? String(f(off + 1)) : '0x…'} /></Field>
            <Button size="sm" variant="ink" disabled={!!busy} onClick={async () => {
              const bps = Number(mf.bps || f(off)); const to = mf.to || String(f(off + 1) ?? '');
              if (!(bps >= 0 && bps <= 1000) || !isAddress(to)) return;
              const rc = await run('Set market fee', { address: contracts.AllocationMarket!, abi: ALLOCATION_MARKET_ABI, functionName: 'setFee', args: [bps, to] }); if (rc) fees.refetch();
            }}>Set market fee</Button>
          </div>
        </div>
      )}
      {contracts.ObsidStaking && <StakingControls staking={contracts.ObsidStaking} busy={busy} run={run} />}
      <TxNote note={note} hash={hash} />
    </div>
  );
}

/* ---------------------------------------------------------------- $OBSID staking gate */

function StakingControls({ staking, busy, run }: { staking: Address; busy: string | null; run: ReturnType<typeof useTx>['run'] }) {
  const st = useReadContracts({
    allowFailure: true,
    contracts: (['totalStaked', 'thresholds', 'gateTier', 'cooldown', 'babt', 'requireBabt', 'token', 'paused'] as const).map((fn) => ({ address: staking, abi: OBSID_STAKING_ABI, functionName: fn, chainId: CHAIN_ID })),
  });
  const g = (i: number) => (st.data?.[i]?.status === 'success' ? st.data[i].result : undefined);
  const token = g(6) as Address | undefined;
  const dec = useReadContract({ address: token, abi: erc20Abi, functionName: 'decimals', chainId: CHAIN_ID, query: { enabled: !!token } });
  const decimals = dec.data !== undefined ? Number(dec.data) : undefined;
  const fmtTok = (v: unknown) => (typeof v === 'bigint' && decimals !== undefined ? Number(formatUnits(v, decimals)).toLocaleString('en-US') : '…');
  const thresholds = (g(1) as readonly bigint[] | undefined) ?? [];
  const cooldownS = g(3) !== undefined ? Number(g(3)) : undefined;
  const paused = g(7) as boolean | undefined;

  const [tiers, setTiers] = useState('');
  const [gate, setGate] = useState('');
  const [cd, setCd] = useState('');
  const [babtAddr, setBabtAddr] = useState('');
  const [req, setReq] = useState(false);
  const after = (rc: TransactionReceipt | null) => { if (rc) st.refetch(); };

  const tierList = tiers.split(',').map((t) => t.trim()).filter(Boolean);
  const tiersOk = decimals !== undefined && tierList.length > 0 && tierList.length <= 10 && tierList.every((t) => /^\d+(\.\d+)?$/.test(t) && Number(t) > 0) && tierList.every((t, i) => i === 0 || Number(t) > Number(tierList[i - 1]));
  const gateN = Number(gate);
  const cdDays = Number(cd);

  return (
    <div className="rounded-blob border border-ink/10 p-6">
      <Kicker>$OBSID staking gate (ObsidStaking)</Kicker>
      <p className="mt-1 font-body text-sm text-ink-soft">Wallets staking at least the gate tier can bid in gated sales created after SaleFactory.setBabt pointed here. Optionally also require BABT KYC.</p>
      <ul className="mt-4 grid gap-2 font-mono text-xs md:grid-cols-2">
        <li>Total staked: {fmtTok(g(0))}</li>
        <li>Gate tier: {g(2) !== undefined ? String(g(2)) : '…'}</li>
        <li>Thresholds: {thresholds.length ? thresholds.map((t, i) => `T${i + 1} ${fmtTok(t)}`).join(' · ') : '…'}</li>
        <li>Unstake cooldown: {cooldownS !== undefined ? `${(cooldownS / 86400).toLocaleString('en-US', { maximumFractionDigits: 2 })} days` : '…'}</li>
        <li>BABT: {g(4) ? short(String(g(4))) : '…'} · {g(5) === undefined ? '…' : g(5) ? 'required' : 'not required'}</li>
        <li>Status: {paused === undefined ? '…' : paused ? 'paused' : 'live'}</li>
      </ul>
      <div className="mt-5 grid gap-3 md:grid-cols-3 md:items-end">
        <Field label="Tier thresholds" hint="whole tokens, ascending, comma separated"><Input mono value={tiers} onChange={(e) => setTiers(e.target.value)} placeholder="10000, 50000, 250000, 1000000" /></Field>
        <span />
        <Button size="sm" variant="ink" disabled={!!busy || !tiersOk} onClick={async () => after(await run('Set tiers', { address: staking, abi: OBSID_STAKING_ABI, functionName: 'setTiers', args: [tierList.map((t) => parseUnits(t, decimals!))] }))}>Set tiers</Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
        <Field label="Gate tier" hint={`1 to ${thresholds.length || '?'}`}><Input mono value={gate} onChange={(e) => setGate(e.target.value)} placeholder={g(2) !== undefined ? String(g(2)) : '1'} /></Field>
        <span />
        <Button size="sm" variant="ink" disabled={!!busy || !(Number.isInteger(gateN) && gateN >= 1 && gateN <= thresholds.length)} onClick={async () => after(await run('Set gate tier', { address: staking, abi: OBSID_STAKING_ABI, functionName: 'setGateTier', args: [gateN] }))}>Set gate tier</Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
        <Field label="Unstake cooldown" hint="days, max 30"><Input mono value={cd} onChange={(e) => setCd(e.target.value)} placeholder="7" /></Field>
        <span />
        <Button size="sm" variant="ink" disabled={!!busy || cd === '' || !(cdDays >= 0 && cdDays <= 30)} onClick={async () => after(await run('Set cooldown', { address: staking, abi: OBSID_STAKING_ABI, functionName: 'setCooldown', args: [BigInt(Math.round(cdDays * 86400))] }))}>Set cooldown</Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
        <Field label="BABT address" hint="Binance KYC token"><Input mono value={babtAddr} onChange={(e) => setBabtAddr(e.target.value.trim())} placeholder={g(4) ? String(g(4)) : '0x…'} /></Field>
        <label className="flex items-center gap-2 font-body text-sm"><input type="checkbox" checked={req} onChange={(e) => setReq(e.target.checked)} /> Also require BABT</label>
        <Button size="sm" variant="ink" disabled={!!busy || !isAddress(babtAddr || String(g(4) ?? '')) || (req && /^0x0{40}$/i.test(babtAddr || String(g(4) ?? '')))} onClick={async () => after(await run('Set BABT', { address: staking, abi: OBSID_STAKING_ABI, functionName: 'setBabt', args: [babtAddr || String(g(4)), req] }))}>Set BABT</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant={paused ? 'lemon' : 'ghost'} disabled={!!busy || paused === undefined} onClick={async () => after(await run(paused ? 'Unpause staking' : 'Pause staking', { address: staking, abi: OBSID_STAKING_ABI, functionName: paused ? 'unpause' : 'pause' }))}>{paused ? 'Unpause staking' : 'Pause staking'}</Button>
        <Button size="sm" variant="ghost" onClick={() => st.refetch()}>Reload</Button>
      </div>
      <p className="mt-3 font-body text-xs text-ink-mute">Pausing blocks new stakes and cancels; requests to unstake and withdrawals keep working.</p>
    </div>
  );
}
