'use client';
// Browser deploy of the full Obsid stack on BNB Smart Chain mainnet, signed by the admin wallet.
// Order and constructor args follow contracts/DEPLOY.md: 7 deployments, 3 wiring calls, then the backend registry.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { encodeDeployData, formatEther, getAddress, isAddress, parseEther, type Abi, type Address, type Hash, type Hex } from 'viem';
import { useAccount, useBalance, usePublicClient, useWalletClient } from 'wagmi';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import ConnectWallet from '@/components/ui/ConnectWallet';
import { Field, Gate, Input, Kicker, PageHead, Rise, Tag, cx, short, useAuth } from '@/components/hostbuyer/kit';
import { adminSaveConfig, DEMO } from '@/components/hostbuyer/client';
import { ARTIFACTS, CHAIN_ID, CONTRACTS_QUERY_KEY, addressUrl, errMsg, txUrl, type ContractName } from '@/lib/chain';
import { ADMIN_WALLET } from '@/lib/wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { bsc } from 'wagmi/chains';

const DEFAULT_BABT = '0x2B09d47D550061f995A3b5C6F0Fd58005215D7c8';
const LS_KEY = 'obsid.deploy.v1';
const WIRING_GAS = 60_000n;

type Artifact = keyof typeof ARTIFACTS;
type DeployKey = 'vault' | 'badge' | 'market' | 'locker' | 'saleImpl' | 'escrowImpl' | 'factory';
type WireKey = 'vaultFactory' | 'vaultMarket' | 'badgeFactory';
type StepKey = DeployKey | WireKey;
type Status = 'idle' | 'pending' | 'done' | 'error';
interface StepState { status: Status; hash?: Hash; address?: Address; error?: string }
interface Params { babt: string; feeRecipient: string; platformFeeBps: string; marketFeeBps: string; maxHardCapBnb: string }
interface Saved { params: Params; steps: Partial<Record<StepKey, StepState>>; configSaved?: boolean }

const DEFAULT_PARAMS: Params = { babt: DEFAULT_BABT, feeRecipient: ADMIN_WALLET, platformFeeBps: '200', marketFeeBps: '100', maxHardCapBnb: '500' };

const DEPLOYS: { key: DeployKey; artifact: Artifact; label: string; registry: ContractName; note: string }[] = [
  { key: 'vault', artifact: 'VestingVault', label: 'VestingVault', registry: 'VestingVault', note: 'Holds every allocation and runs vesting.' },
  { key: 'badge', artifact: 'ParticipationBadge', label: 'ParticipationBadge', registry: 'ParticipationBadge', note: 'Soulbound proof of participation.' },
  { key: 'market', artifact: 'AllocationMarket', label: 'AllocationMarket', registry: 'AllocationMarket', note: 'Peer to peer market for vesting positions.' },
  { key: 'locker', artifact: 'LiquidityLocker', label: 'LiquidityLocker', registry: 'LiquidityLocker', note: 'LP token locks for IDO liquidity.' },
  { key: 'saleImpl', artifact: 'SealedBidSale', label: 'SealedBidSale implementation', registry: 'SealedBidSaleImpl', note: 'Template every sale clone copies.' },
  { key: 'escrowImpl', artifact: 'MilestoneEscrow', label: 'MilestoneEscrow implementation', registry: 'MilestoneEscrowImpl', note: 'Template every escrow clone copies.' },
  { key: 'factory', artifact: 'SaleFactory', label: 'SaleFactory', registry: 'SaleFactory', note: 'Creates sales and owns the registry.' },
];
const WIRES: { key: WireKey; label: string; target: DeployKey; artifact: Artifact; fn: 'setFactory' | 'setMarket'; read: 'factory' | 'market'; arg: DeployKey; note: string }[] = [
  { key: 'vaultFactory', label: 'VestingVault.setFactory', target: 'vault', artifact: 'VestingVault', fn: 'setFactory', read: 'factory', arg: 'factory', note: 'Can only be set once.' },
  { key: 'vaultMarket', label: 'VestingVault.setMarket', target: 'vault', artifact: 'VestingVault', fn: 'setMarket', read: 'market', arg: 'market', note: 'Lets the market move positions.' },
  { key: 'badgeFactory', label: 'ParticipationBadge.setFactory', target: 'badge', artifact: 'ParticipationBadge', fn: 'setFactory', read: 'factory', arg: 'factory', note: 'Can only be set once.' },
];

function loadSaved(): Saved {
  try { const r = localStorage.getItem(LS_KEY); if (r) { const s = JSON.parse(r) as Saved; return { params: { ...DEFAULT_PARAMS, ...s.params }, steps: s.steps ?? {}, configSaved: s.configSaved }; } } catch {}
  return { params: DEFAULT_PARAMS, steps: {} };
}

export default function DeployPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { address, isConnected, chainId } = useAccount();
  const isAdmin = !!address && address.toLowerCase() === ADMIN_WALLET.toLowerCase();
  const onChain = chainId === CHAIN_ID;
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <PageHead kicker="Admin · mainnet deploy" title={<>Deploy<span className="text-lemon-deep">.</span></>} accent="seven contracts, three wiring calls, one registry." aside={<Tag tone="ink">{short(ADMIN_WALLET)}</Tag>} />
        <Warning />
        {!mounted ? <div className="h-60 animate-pulse rounded-blob bg-chalk" /> : !isConnected ? (
          <Gate title="Admin only" body="Connect the Obsid admin wallet in MetaMask to deploy." cta={<ConnectWallet />} />
        ) : !isAdmin ? (
          <Gate title="Admin only" body={`This wallet is not the Obsid admin. Switch MetaMask to ${short(ADMIN_WALLET)}.`} cta={<Button href="/app" variant="ink">Back to app</Button>} />
        ) : !onChain ? (
          <Gate title="Wrong network" body="Deployment runs only on BNB Smart Chain mainnet (chain 56)." cta={<ConnectWallet />} />
        ) : (
          <Deployer admin={address as Address} />
        )}
      </div>
    </AppShell>
  );
}

function Warning() {
  return (
    <Rise className="mb-10 rounded-blob bg-ink p-6 text-paper md:p-10">
      <Kicker className="text-lemon">Read before you press anything</Kicker>
      <p className="mt-3 font-display text-3xl font-semibold leading-tight md:text-4xl">This is <span className="text-lemon">BNB Smart Chain mainnet</span>. Every step spends <span className="text-lemon">real BNB</span>.</p>
      <ul className="mt-5 space-y-2 font-body text-paper/80">
        <li>The contracts have <span className="font-semibold text-paper">not been audited yet</span>. Do not route meaningful value through them until an audit is complete.</li>
        <li>Deployments cannot be undone. The VestingVault and ParticipationBadge factory links can only be set once.</li>
        <li>Your wallet signs everything. No private key ever touches this page or the backend.</li>
      </ul>
    </Rise>
  );
}

function Deployer({ admin }: { admin: Address }) {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
  const { data: balance } = useBalance({ address: admin, chainId: CHAIN_ID });
  const { auth } = useAuth();
  const qc = useQueryClient();

  const [saved, setSaved] = useState<Saved>(() => ({ params: DEFAULT_PARAMS, steps: {} }));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setSaved(loadSaved()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(LS_KEY, JSON.stringify(saved)); } catch {} }, [saved, loaded]);

  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [estimate, setEstimate] = useState<{ perStep: Partial<Record<StepKey, bigint>>; gasPrice: bigint; total: bigint } | null>(null);
  const [estErr, setEstErr] = useState('');

  const p = saved.params;
  const setParam = (k: keyof Params, v: string) => setSaved((s) => ({ ...s, params: { ...s.params, [k]: v } }));
  const setStep = (k: StepKey, st: StepState) => setSaved((s) => ({ ...s, steps: { ...s.steps, [k]: st } }));
  const addr = (k: DeployKey) => saved.steps[k]?.address;
  const anyStarted = Object.values(saved.steps).some((s) => s && s.status !== 'idle');

  const paramProblems = useMemo(() => {
    const out: string[] = [];
    if (p.babt && !isAddress(p.babt)) out.push('BABT must be an address (or the zero address to disable gating).');
    if (!isAddress(p.feeRecipient)) out.push('Fee recipient must be an address.');
    const pf = Number(p.platformFeeBps), mf = Number(p.marketFeeBps);
    if (!Number.isInteger(pf) || pf < 0 || pf > 1000) out.push('Platform fee must be a whole number of bps between 0 and 1000.');
    if (!Number.isInteger(mf) || mf < 0 || mf > 1000) out.push('Market fee must be a whole number of bps between 0 and 1000.');
    if (!(Number(p.maxHardCapBnb) > 0)) out.push('Max hard cap must be above zero.');
    return out;
  }, [p]);

  const argsFor = useCallback((k: DeployKey, dummy = false, known: Partial<Record<DeployKey, Address>> = {}): readonly unknown[] => {
    const a = (d: DeployKey) => (dummy ? admin : (known[d] ?? addr(d))!);
    const babt = (p.babt || '0x0000000000000000000000000000000000000000') as Address;
    switch (k) {
      case 'vault': case 'badge': case 'locker': return [admin];
      case 'market': return [admin, a('vault'), getAddress(p.feeRecipient), Number(p.marketFeeBps)];
      case 'saleImpl': case 'escrowImpl': return [];
      case 'factory': return [admin, a('saleImpl'), a('escrowImpl'), a('vault'), a('badge'), babt, getAddress(p.feeRecipient), Number(p.platformFeeBps), parseEther(p.maxHardCapBnb)];
    }
  }, [admin, p, saved.steps]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- gas estimate ---------- */
  const runEstimate = useCallback(async () => {
    if (!publicClient || paramProblems.length) return;
    setEstErr('');
    try {
      const gasPrice = await publicClient.getGasPrice();
      const perStep: Partial<Record<StepKey, bigint>> = {};
      for (const d of DEPLOYS) {
        const art = ARTIFACTS[d.artifact];
        const data = encodeDeployData({ abi: art.abi as Abi, bytecode: art.bytecode as Hex, args: argsFor(d.key, true) });
        perStep[d.key] = await publicClient.estimateGas({ account: admin, data });
      }
      for (const w of WIRES) perStep[w.key] = WIRING_GAS;
      const total = Object.values(perStep).reduce((a, b) => a + (b ?? 0n), 0n) * gasPrice;
      setEstimate({ perStep, gasPrice, total });
    } catch (e) { setEstErr(errMsg(e)); }
  }, [publicClient, paramProblems.length, argsFor, admin]);
  useEffect(() => { if (loaded) runEstimate(); }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- steps ---------- */
  const deployStep = async (d: (typeof DEPLOYS)[number], cur: Saved, known: Partial<Record<DeployKey, Address>>): Promise<Address> => {
    if (!publicClient || !walletClient) throw new Error('Wallet not ready');
    const st = cur.steps[d.key];
    if (st?.status === 'done' && st.address) return st.address;
    let hash = st?.hash;
    if (!hash || st?.status === 'error') {
      const art = ARTIFACTS[d.artifact];
      setStep(d.key, { status: 'pending' });
      hash = await walletClient.deployContract({ abi: art.abi as Abi, bytecode: art.bytecode as Hex, args: argsFor(d.key, false, known), account: admin, chain: bsc });
      setStep(d.key, { status: 'pending', hash });
    }
    const rc = await publicClient.waitForTransactionReceipt({ hash });
    if (rc.status !== 'success' || !rc.contractAddress) throw new Error(`${d.label} deployment reverted`);
    setStep(d.key, { status: 'done', hash, address: rc.contractAddress });
    return rc.contractAddress;
  };

  const wireStep = async (w: (typeof WIRES)[number], addrs: Record<DeployKey, Address>, cur: Saved) => {
    if (!publicClient || !walletClient) throw new Error('Wallet not ready');
    const art = ARTIFACTS[w.artifact];
    const target = addrs[w.target], arg = addrs[w.arg];
    const current = (await publicClient.readContract({ address: target, abi: art.abi as Abi, functionName: w.read })) as Address;
    if (current.toLowerCase() === arg.toLowerCase()) { setStep(w.key, { status: 'done', hash: cur.steps[w.key]?.hash }); return; }
    if (w.fn === 'setFactory' && !/^0x0{40}$/i.test(current)) throw new Error(`${w.label} is already set to ${current} and cannot change`);
    let hash = cur.steps[w.key]?.status === 'pending' ? cur.steps[w.key]?.hash : undefined;
    if (!hash) {
      setStep(w.key, { status: 'pending' });
      hash = await walletClient.writeContract({ address: target, abi: art.abi as Abi, functionName: w.fn, args: [arg], account: admin, chain: bsc });
      setStep(w.key, { status: 'pending', hash });
    }
    const rc = await publicClient.waitForTransactionReceipt({ hash });
    if (rc.status !== 'success') throw new Error(`${w.label} reverted`);
    setStep(w.key, { status: 'done', hash });
  };

  const saveConfig = async (addrs: Record<DeployKey, Address>) => {
    const contracts: Record<string, string> = {};
    for (const d of DEPLOYS) contracts[d.registry] = addrs[d.key];
    await adminSaveConfig(contracts, await auth());
    setSaved((s) => ({ ...s, configSaved: true }));
    qc.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
  };

  const runAll = async () => {
    if (paramProblems.length) return;
    setRunning(true); setMsg('');
    let current: StepKey | 'config' = 'vault';
    try {
      const addrs = {} as Record<DeployKey, Address>;
      for (const d of DEPLOYS) {
        current = d.key;
        // read the freshest saved state each step so a resumed run reuses finished work
        const cur = loadSaved();
        addrs[d.key] = await deployStep(d, cur, addrs);
      }
      for (const w of WIRES) { current = w.key; await wireStep(w, addrs, loadSaved()); }
      current = 'config';
      setMsg('Contracts live and wired. Sign in to save the addresses to the backend.');
      await saveConfig(addrs);
      setMsg('Done. Addresses are saved to the backend and the app now reads them.');
    } catch (e) {
      const m = errMsg(e);
      if (current !== 'config') setStep(current, { ...(loadSaved().steps[current] ?? {}), status: 'error', error: m });
      setMsg(current === 'config' ? `Saving to the backend failed: ${m}` : `Stopped at ${current}: ${m}`);
    } finally { setRunning(false); }
  };

  const allDeployed = DEPLOYS.every((d) => saved.steps[d.key]?.status === 'done' && saved.steps[d.key]?.address);
  const allWired = WIRES.every((w) => saved.steps[w.key]?.status === 'done');
  const deployedAddrs = () => Object.fromEntries(DEPLOYS.map((d) => [d.key, addr(d.key)!])) as Record<DeployKey, Address>;
  const lowBalance = estimate && balance && balance.value < estimate.total;

  return (
    <div className="space-y-8">
      <Rise className="rounded-blob border border-ink/10 bg-paper p-6 md:p-8">
        <Kicker>Parameters</Kicker>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="BABT token" hint="confirm on BscScan">
            <Input mono value={p.babt} disabled={anyStarted} onChange={(e) => setParam('babt', e.target.value.trim())} />
          </Field>
          <Field label="Fee recipient"><Input mono value={p.feeRecipient} disabled={anyStarted} onChange={(e) => setParam('feeRecipient', e.target.value.trim())} /></Field>
          <Field label="Platform fee" hint="bps, 200 = 2%, max 1000"><Input mono value={p.platformFeeBps} disabled={anyStarted} onChange={(e) => setParam('platformFeeBps', e.target.value.trim())} /></Field>
          <Field label="Market fee" hint="bps, 100 = 1%, max 1000"><Input mono value={p.marketFeeBps} disabled={anyStarted} onChange={(e) => setParam('marketFeeBps', e.target.value.trim())} /></Field>
          <Field label="Max hard cap per sale" hint="BNB"><Input mono value={p.maxHardCapBnb} disabled={anyStarted} onChange={(e) => setParam('maxHardCapBnb', e.target.value.trim())} /></Field>
          <Field label="Admin and owner"><Input mono value={admin} disabled /></Field>
        </div>
        <p className="mt-4 rounded-2xl bg-lemon/60 p-4 font-body text-sm">
          The default BABT address <a href={addressUrl(DEFAULT_BABT)} target="_blank" rel="noreferrer" className="font-mono underline">{short(DEFAULT_BABT)}</a> is believed to be the Binance Account Bound Token on BSC but has not been verified here. Open it on BscScan and confirm before deploying. Use the zero address to skip BABT gating; it can be changed later with setBabt.
        </p>
        {anyStarted && <p className="mt-3 font-body text-xs text-ink-mute">Parameters are locked once deployment starts so a resumed run uses the same values.</p>}
        {paramProblems.length > 0 && <ul className="mt-3 list-disc pl-5 font-body text-sm text-red-700">{paramProblems.map((x) => <li key={x}>{x}</li>)}</ul>}
      </Rise>

      <Rise className="rounded-blob bg-chalk p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Kicker>Estimated cost</Kicker>
            <p className="mt-2 font-mono text-4xl">{estimate ? `${Number(formatEther(estimate.total)).toFixed(5)} BNB` : estErr ? 'unavailable' : 'estimating'}</p>
            {estimate && <p className="mt-1 font-mono text-xs text-ink-mute">{(Object.values(estimate.perStep).reduce((a, b) => a + (b ?? 0n), 0n)).toLocaleString('en-US')} gas at {(Number(estimate.gasPrice) / 1e9).toLocaleString('en-US', { maximumFractionDigits: 3 })} gwei · plus margin for price moves</p>}
            {estErr && <p className="mt-1 font-body text-sm text-red-700">{estErr}</p>}
          </div>
          <div className="text-right">
            <Kicker>Wallet balance</Kicker>
            <p className={cx('mt-2 font-mono text-2xl', lowBalance && 'text-red-700')}>{balance ? `${Number(formatEther(balance.value)).toFixed(5)} BNB` : '…'}</p>
            {lowBalance && <p className="font-body text-sm text-red-700">Balance is below the estimate.</p>}
          </div>
        </div>
        <div className="mt-4"><Button size="sm" variant="ghost" onClick={runEstimate}>Estimate again</Button></div>
      </Rise>

      <Rise className="rounded-blob border border-ink/10 bg-paper p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Kicker>Steps</Kicker>
          <div className="flex flex-wrap gap-2">
            <Button variant="lemon" disabled={running || paramProblems.length > 0 || !walletClient} onClick={runAll}>
              {running ? 'Working, confirm in MetaMask' : allDeployed && allWired ? (saved.configSaved ? 'Run checks again' : 'Save addresses') : anyStarted ? 'Resume deployment' : 'Start deployment'}
            </Button>
            {anyStarted && !running && (
              <Button variant="ghost" onClick={() => { if (window.confirm('Forget all saved progress on this device? Deployed contracts stay onchain; you would deploy fresh copies next time.')) setSaved({ params: saved.params, steps: {} }); }}>Reset progress</Button>
            )}
          </div>
        </div>
        {msg && <p className="mt-4 rounded-2xl bg-ink p-4 font-body text-sm text-lemon">{msg}</p>}
        <ol className="mt-6 divide-y divide-ink/10">
          {DEPLOYS.map((d, i) => (
            <StepRow key={d.key} n={i + 1} label={d.label} note={d.note} st={saved.steps[d.key]} gas={estimate?.perStep[d.key]}
              onManual={running ? undefined : async (a) => {
                if (!publicClient) return;
                const code = await publicClient.getBytecode({ address: a });
                if (!code || code === '0x') { setMsg(`No contract found at ${a}`); return; }
                setStep(d.key, { status: 'done', address: a });
              }}
              onReset={running ? undefined : () => setStep(d.key, { status: 'idle' })} />
          ))}
          {WIRES.map((w, i) => (
            <StepRow key={w.key} n={DEPLOYS.length + i + 1} label={w.label} note={w.note} st={saved.steps[w.key]} gas={estimate?.perStep[w.key]}
              onReset={running ? undefined : () => setStep(w.key, { status: 'idle' })} />
          ))}
          <li className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-4">
              <Dot status={saved.configSaved ? 'done' : 'idle'} n={DEPLOYS.length + WIRES.length + 1} />
              <div>
                <p className="font-body font-medium">Save addresses to the backend</p>
                <p className="font-body text-xs text-ink-mute">{DEMO ? 'No backend URL is configured, so this step cannot run here.' : 'Signs in as admin and saves the registry the whole app reads.'}</p>
              </div>
            </div>
            {allDeployed && !running && <Button size="sm" variant="ink" onClick={async () => { setMsg(''); try { await saveConfig(deployedAddrs()); setMsg('Addresses saved to the backend.'); } catch (e) { setMsg(`Saving failed: ${errMsg(e)}`); } }}>Save now</Button>}
          </li>
        </ol>
      </Rise>

      {allDeployed && <Checks addrs={deployedAddrs()} admin={admin} />}
    </div>
  );
}

function Dot({ status, n }: { status: Status; n: number }) {
  return (
    <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-xs',
      status === 'done' ? 'bg-lemon ring-1 ring-ink' : status === 'pending' ? 'animate-pulse bg-ink text-lemon' : status === 'error' ? 'bg-red-100 text-red-800' : 'bg-frost text-ink-soft')}>
      {status === 'done' ? '✓' : n}
    </span>
  );
}

function StepRow({ n, label, note, st, gas, onManual, onReset }: { n: number; label: string; note: string; st?: StepState; gas?: bigint; onManual?: (a: Address) => void; onReset?: () => void }) {
  const [manual, setManual] = useState(false);
  const [val, setVal] = useState('');
  const status = st?.status ?? 'idle';
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Dot status={status} n={n} />
          <div>
            <p className="font-body font-medium">{label}</p>
            <p className="font-body text-xs text-ink-mute">{note}{gas ? ` · about ${gas.toLocaleString('en-US')} gas` : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {st?.address && <a href={addressUrl(st.address)} target="_blank" rel="noreferrer" className="underline decoration-lemon decoration-2 underline-offset-4">{short(st.address)}</a>}
          {st?.hash && <a href={txUrl(st.hash)} target="_blank" rel="noreferrer" className="text-ink-mute underline underline-offset-4">tx {short(st.hash)}</a>}
          <Tag tone={status === 'done' ? 'lemon' : status === 'error' ? 'ink' : 'mute'}>{status === 'idle' ? 'waiting' : status}</Tag>
          {onManual && status !== 'done' && <button onClick={() => setManual((m) => !m)} className="font-label text-[10px] uppercase tracking-[0.18em] text-ink-mute underline">use existing</button>}
          {onReset && (status === 'error' || status === 'pending') && <button onClick={onReset} className="font-label text-[10px] uppercase tracking-[0.18em] text-ink-mute underline">reset step</button>}
        </div>
      </div>
      {st?.error && <p className="mt-2 pl-[52px] font-body text-sm text-red-700">{st.error}</p>}
      {manual && onManual && (
        <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">
          <Input mono value={val} onChange={(e) => setVal(e.target.value.trim())} placeholder="0x… already deployed address" className="max-w-md" />
          <Button size="sm" variant="ink" disabled={!isAddress(val)} onClick={() => { onManual(val as Address); setManual(false); }}>Use address</Button>
        </div>
      )}
    </li>
  );
}

function Checks({ addrs, admin }: { addrs: Record<DeployKey, Address>; admin: Address }) {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [rows, setRows] = useState<{ k: string; ok: boolean; v: string }[] | null>(null);
  useEffect(() => {
    if (!publicClient) return;
    const read = (address: Address, art: Artifact, functionName: string) => publicClient.readContract({ address, abi: ARTIFACTS[art].abi as Abi, functionName }).catch(() => undefined);
    const eq = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
    (async () => {
      const [owner, impl, eimpl, fv, fb, vf, vm, bf, mv] = await Promise.all([
        read(addrs.factory, 'SaleFactory', 'owner'), read(addrs.factory, 'SaleFactory', 'saleImplementation'), read(addrs.factory, 'SaleFactory', 'escrowImplementation'),
        read(addrs.factory, 'SaleFactory', 'vault'), read(addrs.factory, 'SaleFactory', 'badge'),
        read(addrs.vault, 'VestingVault', 'factory'), read(addrs.vault, 'VestingVault', 'market'), read(addrs.badge, 'ParticipationBadge', 'factory'), read(addrs.market, 'AllocationMarket', 'vault'),
      ]);
      setRows([
        { k: 'SaleFactory.owner is the admin', ok: eq(owner, admin), v: String(owner ?? '?') },
        { k: 'SaleFactory.saleImplementation', ok: eq(impl, addrs.saleImpl), v: String(impl ?? '?') },
        { k: 'SaleFactory.escrowImplementation', ok: eq(eimpl, addrs.escrowImpl), v: String(eimpl ?? '?') },
        { k: 'SaleFactory.vault', ok: eq(fv, addrs.vault), v: String(fv ?? '?') },
        { k: 'SaleFactory.badge', ok: eq(fb, addrs.badge), v: String(fb ?? '?') },
        { k: 'VestingVault.factory', ok: eq(vf, addrs.factory), v: String(vf ?? '?') },
        { k: 'VestingVault.market', ok: eq(vm, addrs.market), v: String(vm ?? '?') },
        { k: 'ParticipationBadge.factory', ok: eq(bf, addrs.factory), v: String(bf ?? '?') },
        { k: 'AllocationMarket.vault', ok: eq(mv, addrs.vault), v: String(mv ?? '?') },
      ]);
    })();
  }, [publicClient, addrs, admin]);
  return (
    <Rise className="rounded-blob border border-ink/10 bg-paper p-6 md:p-8">
      <Kicker>Post deploy checks</Kicker>
      {!rows ? <p className="mt-4 font-mono text-xs text-ink-mute">Reading…</p> : (
        <ul className="mt-4 divide-y divide-ink/10">
          {rows.map((r) => (
            <li key={r.k} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span className="font-body text-sm">{r.k}</span>
              <span className="flex items-center gap-2 font-mono text-xs"><span className="break-all text-ink-mute">{short(r.v)}</span><Tag tone={r.ok ? 'lemon' : 'ink'}>{r.ok ? 'ok' : 'check'}</Tag></span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 font-body text-xs text-ink-mute">Verify each contract on BscScan with solc 0.8.24, optimizer on at 200 runs, EVM version paris.</p>
    </Rise>
  );
}
