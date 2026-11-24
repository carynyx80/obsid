'use client';
// Host side onchain actions for one sale: fund the sale with tokens, withdraw unsold tokens,
// withdraw released escrow BNB, and lock IDO liquidity in the LiquidityLocker.
import { useState } from 'react';
import { formatEther, formatUnits, isAddress, maxUint256, parseUnits, type Address } from 'viem';
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from 'wagmi';
import Button from '@/components/ui/Button';
import { CHAIN_ID, LIQUIDITY_LOCKER_ABI, MILESTONE_ESCROW_ABI, SALE_STATE, SEALED_BID_SALE_ABI, addressUrl, erc20Abi, errMsg, txUrl, useContracts } from '@/lib/chain';
import type { Sale } from '@/lib/types';
import { Field, Input, Tag, cx, fmt, short } from './kit';

type Step = { label: string; state: 'idle' | 'busy' | 'done' | 'error'; msg?: string; hash?: string };

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
  return { run, step };
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

export default function HostSalePanel({ sale, saleAddr }: { sale: Sale; saleAddr: Address }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { contracts } = useContracts();
  const { run, step } = useRunner();

  const base = { address: saleAddr, abi: SEALED_BID_SALE_ABI, chainId: CHAIN_ID } as const;
  const q = useReadContracts({
    contracts: [
      { ...base, functionName: 'host' },
      { ...base, functionName: 'saleToken' },
      { ...base, functionName: 'supply' },
      { ...base, functionName: 'funded' },
      { ...base, functionName: 'state' },
      { ...base, functionName: 'startTime' },
      { ...base, functionName: 'unsoldWithdrawn' },
      { ...base, functionName: 'escrow' },
      { ...base, functionName: 'totalSold' },
    ],
    query: { refetchInterval: 15000 },
  });
  const [host, token, supply, funded, stateIdx, startTime, unsoldWithdrawn, escrow, totalSold] = (q.data ?? []).map((r) => r.result) as [
    Address | undefined, Address | undefined, bigint | undefined, boolean | undefined, number | undefined, bigint | undefined, boolean | undefined, Address | undefined, bigint | undefined,
  ];

  const t = useReadContracts({
    contracts: token && address ? [
      { address: token, abi: erc20Abi, functionName: 'decimals', chainId: CHAIN_ID },
      { address: token, abi: erc20Abi, functionName: 'symbol', chainId: CHAIN_ID },
      { address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: CHAIN_ID },
      { address: token, abi: erc20Abi, functionName: 'allowance', args: [address, saleAddr], chainId: CHAIN_ID },
    ] : [],
    query: { enabled: !!token && !!address, refetchInterval: 15000 },
  });
  const [decimals = 18, symbol = sale.tokenSymbol, balance = 0n, allowance = 0n] = (t.data ?? []).map((r) => r.result) as [number?, string?, bigint?, bigint?];

  const e = useReadContracts({
    contracts: escrow ? [
      { address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: 'hostClaimable', chainId: CHAIN_ID },
      { address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: 'lockedAmount', chainId: CHAIN_ID },
      { address: escrow, abi: MILESTONE_ESCROW_ABI, functionName: 'refundMode', chainId: CHAIN_ID },
    ] : [],
    query: { enabled: !!escrow, refetchInterval: 15000 },
  });
  const [hostClaimable = 0n, lockedAmount = 0n, refundMode = false] = (e.data ?? []).map((r) => r.result) as [bigint?, bigint?, boolean?];

  const refresh = () => { q.refetch(); t.refetch(); e.refetch(); };
  const isHost = !!address && !!host && address.toLowerCase() === host.toLowerCase();
  const wrongChain = chainId !== CHAIN_ID;
  const state = stateIdx !== undefined ? SALE_STATE[stateIdx] : undefined;
  const beforeStart = startTime !== undefined && Number(startTime) * 1000 > Date.now();
  const unsoldAmount = supply === undefined ? 0n : state === 'Failed' ? supply : supply - (totalSold ?? 0n);
  const tk = (v?: bigint) => (v === undefined ? '…' : fmt(Number(formatUnits(v, decimals)), 4));

  // Liquidity lock form
  const [lpToken, setLpToken] = useState('');
  const [lpAmount, setLpAmount] = useState('');
  const [lpUntil, setLpUntil] = useState('');
  const locker = contracts.LiquidityLocker;
  const lp = useReadContracts({
    contracts: isAddress(lpToken) && address && locker ? [
      { address: lpToken as Address, abi: erc20Abi, functionName: 'decimals', chainId: CHAIN_ID },
      { address: lpToken as Address, abi: erc20Abi, functionName: 'allowance', args: [address, locker], chainId: CHAIN_ID },
      { address: lpToken as Address, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: CHAIN_ID },
    ] : [],
    query: { enabled: isAddress(lpToken) && !!address && !!locker },
  });
  const [lpDec = 18, lpAllow = 0n, lpBal = 0n] = (lp.data ?? []).map((r) => r.result) as [number?, bigint?, bigint?];
  let lpUnits = 0n; try { lpUnits = parseUnits(lpAmount || '0', lpDec); } catch { lpUnits = 0n; }
  const unlockTs = lpUntil ? Math.floor(new Date(lpUntil).getTime() / 1000) : 0;

  if (q.isLoading) return <Card><p className="font-body text-ink-mute">Reading the sale contract…</p></Card>;
  if (!host) return <Card><p className="font-body text-ink-mute">Could not read this sale contract on BNB Smart Chain.</p></Card>;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-ink-mute">{sale.type} · {sale.tokenSymbol}</p>
          <h3 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">{sale.tokenName}</h3>
          <a className="font-mono text-xs text-ink-mute underline" href={addressUrl(saleAddr)} target="_blank" rel="noreferrer">{short(saleAddr)}</a>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag tone={funded ? 'lemon' : 'line'}>{funded ? 'Funded' : 'Not funded'}</Tag>
          {state && <Tag tone="ink">{state === 'Pending' ? 'Open' : state}</Tag>}
          {refundMode && <Tag tone="mute">Refund mode</Tag>}
        </div>
      </div>

      {!isHost && <p className="mt-4 rounded-2xl bg-chalk px-4 py-3 font-body text-sm text-ink-soft">Connect the host wallet {short(host)} to manage this sale.</p>}
      {isHost && wrongChain && <p className="mt-4 rounded-2xl bg-chalk px-4 py-3 font-body text-sm text-ink-soft">Switch your wallet to BNB Smart Chain to continue.</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* 1. Fund */}
        <Block n="01" title="Fund the sale" accent="tokens in before bids open">
          <Row k="Tokens required" v={`${tk(supply)} ${symbol}`} />
          <Row k="Your balance" v={`${tk(balance)} ${symbol}`} />
          {funded ? (
            <p className="mt-3 font-serif text-lg italic">Funded. Bids can open on schedule.</p>
          ) : !beforeStart ? (
            <p className="mt-3 font-body text-sm text-ink-soft">The start time has passed without funding, so this sale cannot take bids. Ask the admin to cancel it.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {allowance < (supply ?? 0n) ? (
                <Button variant="ink" onClick={() => run('Approve', { address: token!, abi: erc20Abi, functionName: 'approve', args: [saleAddr, supply!] }, refresh)} disabled={!isHost || wrongChain || !supply}>
                  Approve {symbol}
                </Button>
              ) : (
                <Button variant="lemon" onClick={() => run('Fund', { ...base, functionName: 'fund' }, refresh)} disabled={!isHost || wrongChain || balance < (supply ?? 0n)}>
                  Deposit {tk(supply)} {symbol}
                </Button>
              )}
              {balance < (supply ?? 0n) && <p className="font-body text-xs text-ink-mute">Your wallet holds fewer tokens than the sale needs.</p>}
            </div>
          )}
        </Block>

        {/* 2. Escrow */}
        <Block n="02" title="Raised BNB" accent="released by milestone">
          <Row k="Ready to withdraw" v={`${fmt(Number(formatEther(hostClaimable)), 4)} BNB`} />
          <Row k="Still locked" v={`${fmt(Number(formatEther(lockedAmount)), 4)} BNB`} />
          <div className="mt-4">
            <Button variant="lemon" onClick={() => run('Withdraw BNB', { address: escrow!, abi: MILESTONE_ESCROW_ABI, functionName: 'withdrawHost' }, refresh)} disabled={!isHost || wrongChain || hostClaimable === 0n || !escrow}>
              Withdraw BNB
            </Button>
          </div>
          <p className="mt-3 font-body text-xs text-ink-mute">The admin releases each milestone. If buyers vote for refunds, locked BNB goes back to them.</p>
        </Block>

        {/* 3. Unsold */}
        <Block n="03" title="Unsold tokens" accent="back to you after close">
          <Row k="Returnable" v={state && state !== 'Pending' && funded ? `${tk(unsoldAmount)} ${symbol}` : 'After the sale closes'} />
          {unsoldWithdrawn ? (
            <p className="mt-3 font-serif text-lg italic">Already withdrawn.</p>
          ) : (
            <div className="mt-4">
              <Button variant="ink" onClick={() => run('Withdraw unsold', { ...base, functionName: 'withdrawUnsold' }, refresh)} disabled={!isHost || wrongChain || state === 'Pending' || state === undefined}>
                Withdraw unsold
              </Button>
            </div>
          )}
        </Block>
      </div>

      {sale.type === 'IDO' && (
        <div className="mt-4 rounded-[2rem] bg-ink p-6 text-paper">
          <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-lemon">04 · Liquidity lock</p>
          <h4 className="mt-2 font-display text-xl font-extrabold">Lock your LP tokens <span className="font-serif font-normal italic">in public view.</span></h4>
          {!locker ? (
            <p className="mt-3 font-body text-sm text-paper/70">The liquidity locker is not deployed yet.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="LP token address"><Input mono value={lpToken} onChange={(ev) => setLpToken(ev.target.value.trim())} placeholder="0x…" /></Field>
              <Field label={`Amount${isAddress(lpToken) ? ` (balance ${fmt(Number(formatUnits(lpBal, lpDec)), 4)})` : ''}`}><Input mono value={lpAmount} onChange={(ev) => setLpAmount(ev.target.value)} placeholder="0.0" /></Field>
              <Field label="Locked until"><Input type="datetime-local" value={lpUntil} onChange={(ev) => setLpUntil(ev.target.value)} /></Field>
              <div className="sm:col-span-3">
                {lpAllow < lpUnits ? (
                  <Button variant="lemon" onClick={() => run('Approve LP', { address: lpToken as Address, abi: erc20Abi, functionName: 'approve', args: [locker, maxUint256] }, () => lp.refetch())} disabled={!address || wrongChain || !isAddress(lpToken) || lpUnits === 0n}>
                    Approve LP token
                  </Button>
                ) : (
                  <Button variant="lemon" onClick={() => run('Lock liquidity', { address: locker, abi: LIQUIDITY_LOCKER_ABI, functionName: 'lock', args: [lpToken as Address, lpUnits, BigInt(unlockTs), address!] }, () => lp.refetch())} disabled={!address || wrongChain || !isAddress(lpToken) || lpUnits === 0n || unlockTs * 1000 <= Date.now()}>
                    Lock liquidity
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <StepNote step={step} />
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-[2.5rem] border border-ink/10 bg-paper p-5 shadow-[0_30px_80px_-50px_rgba(11,15,5,0.35)] sm:p-8">{children}</section>;
}
function Block({ n, title, accent, children }: { n: string; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[2rem] bg-chalk p-5">
      <p className="font-mono text-xs text-ink-mute">{n}</p>
      <h4 className="mt-1 font-display text-lg font-extrabold">{title}</h4>
      <p className="font-serif text-base italic text-ink-soft">{accent}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/5 py-2">
      <span className="font-label text-[11px] font-bold uppercase tracking-widest text-ink-mute">{k}</span>
      <span className="font-mono text-sm">{v}</span>
    </div>
  );
}
