'use client';
// Stake $OBSID for guaranteed access to every staker gated sale.
import { useEffect, useState } from 'react';
import { formatUnits, maxUint256, parseAbi, parseUnits, type Address } from 'viem';
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from 'wagmi';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import ConnectWallet from '@/components/ui/ConnectWallet';
import { CHAIN_ID, erc20Abi, errMsg, txUrl, useContracts } from '@/lib/chain';
import { OBSID_BUY_URL, OBSID_CA } from '@/lib/token';
import { Field, Input, Kicker, PageHead, Rise, Tag, cx, fmt } from '@/components/hostbuyer/kit';

export const STAKING_ABI = parseAbi([
  'function stake(uint256 amount)',
  'function requestUnstake(uint256 amount)',
  'function cancelUnstake()',
  'function withdraw(address to)',
  'function staked(address) view returns (uint256)',
  'function pendingUnstake(address) view returns (uint256 amount, uint64 readyAt)',
  'function tierOf(address user) view returns (uint8)',
  'function hasAccess(address user) view returns (bool)',
  'function thresholds() view returns (uint256[])',
  'function gateTier() view returns (uint8)',
  'function cooldown() view returns (uint64)',
  'function totalStaked() view returns (uint256)',
  'function token() view returns (address)',
]);

const PLACEHOLDER = [10_000, 50_000, 250_000, 1_000_000];

type Step = { label: string; state: 'busy' | 'done' | 'error'; msg?: string; hash?: string };

function useRunner() {
  const pc = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<Step | null>(null);
  async function run(label: string, args: Parameters<typeof writeContractAsync>[0], after?: () => void) {
    setStep({ label, state: 'busy' });
    try {
      const hash = await writeContractAsync({ ...args, chainId: CHAIN_ID } as Parameters<typeof writeContractAsync>[0]);
      setStep({ label, state: 'busy', hash, msg: 'Waiting for confirmation' });
      const r = await pc!.waitForTransactionReceipt({ hash });
      if (r.status !== 'success') throw new Error('Transaction reverted');
      setStep({ label, state: 'done', hash });
      after?.();
      return true;
    } catch (e) {
      setStep({ label, state: 'error', msg: errMsg(e) });
      return false;
    }
  }
  return { run, step, busy: step?.state === 'busy' };
}

function StepNote({ step }: { step: Step | null }) {
  if (!step) return null;
  return (
    <div className={cx('mt-4 rounded-2xl px-4 py-3 font-body text-sm', step.state === 'error' ? 'bg-red-50 text-red-700' : step.state === 'done' ? 'bg-lemon-soft text-ink' : 'bg-chalk text-ink-soft')}>
      <span className="font-label font-bold uppercase tracking-widest">{step.label}</span>{' '}
      {step.state === 'busy' && (step.msg ?? 'Confirm in your wallet')}
      {step.state === 'done' && 'confirmed.'}
      {step.state === 'error' && step.msg}
      {step.hash && <a className="ml-2 underline" href={txUrl(step.hash)} target="_blank" rel="noreferrer">View on BscScan</a>}
    </div>
  );
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function countdown(sec: number) {
  if (sec <= 0) return 'Ready now';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
}

function TierLadder({ tiers, gate, mine, placeholder }: { tiers: number[]; gate: number; mine: number; placeholder?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiers.map((t, i) => {
        const n = i + 1;
        const isMine = n === mine;
        const unlocks = n >= gate;
        return (
          <Rise key={n} delay={0.05 * i} className={cx('relative rounded-3xl p-6 transition', isMine ? 'bg-ink text-paper' : unlocks ? 'bg-lemon-soft text-ink ring-1 ring-ink/10' : 'bg-chalk text-ink ring-1 ring-ink/5')}>
            <div className="flex items-start justify-between gap-2">
              <span className={cx('font-label text-[11px] uppercase tracking-[0.22em]', isMine ? 'text-lemon' : 'text-ink-mute')}>Tier {n}</span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {n === gate && <Tag tone="lemon">Access</Tag>}
                {isMine && <Tag tone="line" className="border-paper/40 text-paper">You</Tag>}
              </div>
            </div>
            <div className="mt-6 font-display text-4xl font-semibold leading-none tracking-tight">{fmt(t, 0)}</div>
            <div className={cx('mt-2 font-mono text-xs', isMine ? 'text-paper/70' : 'text-ink-mute')}>$OBSID staked</div>
            <p className={cx('mt-4 font-serif text-sm italic', isMine ? 'text-paper/80' : 'text-ink-soft')}>
              {unlocks ? 'Bid in every staker gated sale.' : 'Below the access line.'}
            </p>
          </Rise>
        );
      })}
      {placeholder && <p className="font-body text-xs text-ink-mute sm:col-span-2 lg:col-span-4">Illustrative tiers. Final thresholds are set onchain at launch.</p>}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-chalk p-4 ring-1 ring-ink/5">
      <Kicker>{label}</Kicker>
      <div className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight">{value}</div>
      {sub && <div className="mt-1 font-body text-xs text-ink-mute">{sub}</div>}
    </div>
  );
}

export default function StakePanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { contracts } = useContracts();
  const staking = (contracts as Record<string, `0x${string}` | undefined>).ObsidStaking;
  const { run, step, busy } = useRunner();
  const now = useNow();

  const base = { address: staking, abi: STAKING_ABI, chainId: CHAIN_ID } as const;
  const g = useReadContracts({
    contracts: staking ? [
      { ...base, functionName: 'thresholds' },
      { ...base, functionName: 'gateTier' },
      { ...base, functionName: 'cooldown' },
      { ...base, functionName: 'totalStaked' },
      { ...base, functionName: 'token' },
    ] : [],
    query: { enabled: !!staking, refetchInterval: 20000 },
  });
  const [thr, gateTierR, cooldownR, totalStaked, tokenR] = (g.data ?? []).map((r) => r.result) as [(readonly bigint[])?, number?, bigint?, bigint?, Address?];
  const token = tokenR ?? OBSID_CA ?? undefined;

  const u = useReadContracts({
    contracts: staking && address ? [
      { ...base, functionName: 'staked', args: [address] },
      { ...base, functionName: 'pendingUnstake', args: [address] },
      { ...base, functionName: 'tierOf', args: [address] },
      { ...base, functionName: 'hasAccess', args: [address] },
    ] : [],
    query: { enabled: !!staking && !!address, refetchInterval: 15000 },
  });
  const [stakedR, pendingR, tierR, accessR] = (u.data ?? []).map((r) => r.result) as [bigint?, (readonly [bigint, bigint])?, number?, boolean?];

  const t = useReadContracts({
    contracts: token && address ? [
      { address: token, abi: erc20Abi, functionName: 'decimals', chainId: CHAIN_ID },
      { address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: CHAIN_ID },
      { address: token, abi: erc20Abi, functionName: 'allowance', args: [address, staking ?? address], chainId: CHAIN_ID },
    ] : [],
    query: { enabled: !!token && !!address, refetchInterval: 15000 },
  });
  const [decimals = 18, balance = 0n, allowance = 0n] = (t.data ?? []).map((r) => r.result) as [number?, bigint?, bigint?];

  const refresh = () => { g.refetch(); u.refetch(); t.refetch(); };
  const whole = (v: bigint) => Number(formatUnits(v, decimals));
  const tk = (v?: bigint) => (v === undefined ? '…' : fmt(whole(v), 2));

  const tiers = thr && thr.length ? thr.map((v) => whole(v)) : PLACEHOLDER;
  const gate = gateTierR ?? 1;
  const mine = tierR ?? 0;
  const cooldownDays = cooldownR !== undefined ? Math.round(Number(cooldownR) / 86400 * 10) / 10 : 7;
  const pendingAmt = pendingR?.[0] ?? 0n;
  const readyAt = Number(pendingR?.[1] ?? 0n) * 1000;
  const secsLeft = Math.max(0, Math.floor((readyAt - now) / 1000));
  const ready = pendingAmt > 0n && secsLeft === 0;
  const wrongChain = isConnected && chainId !== CHAIN_ID;

  const [amt, setAmt] = useState('');
  const [unAmt, setUnAmt] = useState('');
  const parse = (s: string) => { try { return parseUnits(s || '0', decimals); } catch { return 0n; } };
  const amtUnits = parse(amt);
  const unUnits = parse(unAmt);
  const needsApprove = amtUnits > 0n && allowance < amtUnits;

  const toNext = mine < tiers.length ? Math.max(0, tiers[mine] - (stakedR !== undefined ? whole(stakedR) : 0)) : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
      <PageHead
        kicker="Guaranteed access"
        title={<>Stake $OBSID.<br />Get into every sale.</>}
        accent="Hold your place in line, onchain."
        aside={
          <div className="flex flex-col items-start gap-3 md:items-end">
            {OBSID_BUY_URL ? <Button href={OBSID_BUY_URL} external variant="ink">Buy $OBSID</Button> : <Tag tone="mute">Buy link coming soon</Tag>}
            {staking && totalStaked !== undefined && <span className="font-mono text-xs text-ink-mute">{tk(totalStaked)} $OBSID staked in total</span>}
          </div>
        }
      />

      <section className="mb-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">The tier ladder</h2>
          <p className="max-w-md font-body text-sm text-ink-soft">
            Reach Tier {gate} or higher and you can bid in every staker gated sale. Access is not an allocation: winning tokens still depends on your sealed bid clearing.
          </p>
        </div>
        <TierLadder tiers={tiers} gate={gate} mine={mine} placeholder={!staking || !thr?.length} />
      </section>

      {!staking ? (
        <Rise className="rounded-blob bg-ink p-8 text-paper md:p-12">
          <Kicker className="text-lemon">Staking opens soon</Kicker>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight md:text-4xl">The vault is not live yet.</h2>
          <p className="mt-3 max-w-xl font-body text-paper/75">Pick up $OBSID now and you will be ready to stake the moment the contract goes live. Unstaking will use a cooldown, so plan ahead of the sales you care about.</p>
          {OBSID_BUY_URL && <div className="mt-8"><Button href={OBSID_BUY_URL} external>Buy $OBSID</Button></div>}
        </Rise>
      ) : !isConnected ? (
        <Rise className="rounded-blob border border-ink/10 bg-paper p-8 text-center md:p-12">
          <h2 className="font-display text-3xl font-semibold">Connect to stake</h2>
          <p className="mx-auto mt-3 max-w-md font-body text-ink-soft">See your balance, tier and access status, then stake in two taps.</p>
          <div className="mt-8 flex justify-center"><ConnectWallet /></div>
        </Rise>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <Rise className="rounded-blob bg-paper p-6 ring-1 ring-ink/10 md:p-8 lg:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Your position</h2>
              {accessR ? <Tag tone="lemon">Access yes</Tag> : <Tag tone="mute">No access yet</Tag>}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Stat label="Wallet" value={tk(balance)} sub="$OBSID" />
              <Stat label="Staked" value={tk(stakedR)} sub="$OBSID" />
              <Stat label="Tier" value={mine ? `Tier ${mine}` : 'None'} sub={mine < tiers.length ? `${fmt(toNext, 0)} more to Tier ${mine + 1}` : 'Top tier'} />
              <Stat label="Access" value={accessR ? 'Yes' : 'No'} sub={`Needs Tier ${gate}`} />
            </div>
            {pendingAmt > 0n && (
              <div className="mt-5 rounded-2xl bg-lemon-soft p-4">
                <Kicker>Pending unstake</Kicker>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-2xl font-semibold">{tk(pendingAmt)} $OBSID</span>
                  <span className="font-mono text-sm">{countdown(secsLeft)}</span>
                </div>
                <p className="mt-1 font-body text-xs text-ink-soft">Ready {new Date(readyAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. This amount no longer counts toward your tier.</p>
              </div>
            )}
          </Rise>

          <Rise delay={0.1} className="rounded-blob bg-paper p-6 ring-1 ring-ink/10 md:p-8 lg:col-span-7">
            {wrongChain && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 font-body text-sm text-red-700">Switch your wallet to BNB Smart Chain to continue.</p>}

            <h3 className="font-display text-xl font-semibold">Stake</h3>
            <Field label="Amount" hint={`Balance ${tk(balance)}`} className="mt-4">
              <div className="flex gap-2">
                <Input inputMode="decimal" placeholder="0" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} mono />
                <Button type="button" variant="ghost" size="sm" className="h-auto" onClick={() => setAmt(formatUnits(balance, decimals))}>Max</Button>
              </div>
            </Field>
            <div className="mt-4 flex flex-wrap gap-3">
              {needsApprove ? (
                <Button disabled={busy || wrongChain || !token} onClick={() => run('Approve', { address: token!, abi: erc20Abi, functionName: 'approve', args: [staking, maxUint256] }, refresh)}>Approve $OBSID</Button>
              ) : (
                <Button disabled={busy || wrongChain || amtUnits === 0n || amtUnits > balance} onClick={() => run('Stake', { address: staking, abi: STAKING_ABI, functionName: 'stake', args: [amtUnits] }, () => { setAmt(''); refresh(); })}>Stake</Button>
              )}
              {OBSID_BUY_URL && <Button href={OBSID_BUY_URL} external variant="ghost">Buy $OBSID</Button>}
            </div>

            <div className="my-8 h-px bg-ink/10" />

            <h3 className="font-display text-xl font-semibold">Unstake</h3>
            <p className="mt-2 font-body text-sm text-ink-soft">
              Unstaking has a {cooldownDays} day cooldown. The amount you request stops counting toward your tier immediately, so you may lose access to gated sales right away. You can cancel any time before withdrawing.
            </p>
            <Field label="Amount" hint={`Staked ${tk(stakedR)}`} className="mt-4">
              <div className="flex gap-2">
                <Input inputMode="decimal" placeholder="0" value={unAmt} onChange={(e) => setUnAmt(e.target.value.replace(/[^0-9.]/g, ''))} mono />
                <Button type="button" variant="ghost" size="sm" className="h-auto" onClick={() => setUnAmt(formatUnits(stakedR ?? 0n, decimals))}>Max</Button>
              </div>
            </Field>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="ink" disabled={busy || wrongChain || unUnits === 0n || unUnits > (stakedR ?? 0n)} onClick={() => run('Request unstake', { address: staking, abi: STAKING_ABI, functionName: 'requestUnstake', args: [unUnits] }, () => { setUnAmt(''); refresh(); })}>Request unstake</Button>
              {pendingAmt > 0n && (
                <Button variant="ghost" disabled={busy || wrongChain} onClick={() => run('Cancel unstake', { address: staking, abi: STAKING_ABI, functionName: 'cancelUnstake' }, refresh)}>Cancel unstake</Button>
              )}
              {pendingAmt > 0n && (
                <Button disabled={busy || wrongChain || !ready || !address} onClick={() => run('Withdraw', { address: staking, abi: STAKING_ABI, functionName: 'withdraw', args: [address!] }, refresh)}>
                  {ready ? 'Withdraw' : `Withdraw in ${countdown(secsLeft)}`}
                </Button>
              )}
            </div>
            <StepNote step={step} />
          </Rise>
        </div>
      )}

      <p className="mt-12 max-w-2xl font-body text-xs text-ink-mute">
        Staking gives you the right to bid in every staker gated sale on Obsid. It does not guarantee an allocation: tokens go to bids that clear the sale price. Staked $OBSID stays yours and can be withdrawn after the cooldown.
      </p>
    </div>
    </AppShell>
  );
}
