'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatEther, formatUnits, parseEther, parseUnits, type Address, type Hex } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import type { Sale } from '@/lib/types';
import { useRole } from '@/lib/role';
import ConnectWallet from '@/components/ui/ConnectWallet';
import Redacted from '@/components/ui/Redacted';
import { CHAIN_ID, defaultTickGrid, errMsg, txUrl } from '@/lib/chain';
import {
  MILESTONE_ESCROW_ABI, SEALED_BID_SALE_ABI, computeCommitment, downloadSecret, isV2Secret, loadSecret, priceAtTick, pricePerWholeToken,
  randomSalt, requiredDeposit, saleAddress, saveSecret, secretKey, type BidSecret,
} from './contracts';
import { useSaleChain, type ChainPhase } from './useSaleChain';

const inputCls = 'w-full rounded-2xl bg-paper px-4 py-3.5 font-mono text-lg outline-none ring-1 ring-ink/10 transition focus:ring-2 focus:ring-ink placeholder:text-ink/25';
const labelCls = 'mb-2 block font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute';
const bnb = (wei: bigint, d = 6) => Number(formatEther(wei)).toLocaleString('en-US', { maximumFractionDigits: d });
const bnbPrice = (wei: bigint) => { const n = Number(formatEther(wei)); return n === 0 ? '0' : n < 0.0001 ? n.toPrecision(4) : n.toLocaleString('en-US', { maximumFractionDigits: 8 }); };

function loadPrev(saleId: string, addr: string): BidSecret | null {
  try { const r = localStorage.getItem(secretKey(saleId, addr) + '.prev'); return r ? (JSON.parse(r) as BidSecret) : null; } catch { return null; }
}
function keepPrev(s: BidSecret) {
  try { localStorage.setItem(secretKey(s.saleId, s.bidder) + '.prev', JSON.stringify(s)); } catch {}
}

export default function BidPanel({ sale }: { sale: Sale }) {
  const { role } = useRole();
  const priv = role === 'buyer';
  const { address, isConnected, chainId } = useAccount();
  const contract = saleAddress(sale);
  const chain = useSaleChain(contract, address);
  const live = !!chain?.loaded;

  const phase: ChainPhase = live
    ? chain!.phase
    : sale.status === 'bidding' ? 'commit' : sale.status === 'reveal' ? 'reveal' : sale.status === 'upcoming' ? 'soon' : 'done';

  // Tick grid: live from the contract, otherwise the default grid the admin would create from this sale.
  const grid = useMemo(() => {
    if (live) return { minPrice: chain!.minPrice, tickSize: chain!.tickSize, numTicks: chain!.numTicks, decimals: chain!.decimals };
    try { return { ...defaultTickGrid({ minPriceBnb: sale.minPrice, hardCapBnb: sale.hardCapBnb, supply: sale.supply, decimals: 18 }), decimals: 18 }; }
    catch { return { minPrice: 0n, tickSize: 0n, numTicks: 1, decimals: 18 }; }
  }, [live, chain?.minPrice, chain?.tickSize, chain?.numTicks, chain?.decimals, sale.minPrice, sale.hardCapBnb, sale.supply]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tab, setTab] = useState<'commit' | 'reveal' | 'after'>('commit');
  const autoTab = useRef(false);
  useEffect(() => {
    if (autoTab.current) return;
    if (phase === 'reveal') { setTab('reveal'); autoTab.current = true; }
    else if (phase === 'finalize' || phase === 'done') { setTab('after'); autoTab.current = true; }
    else if (live) autoTab.current = true;
  }, [phase, live]);

  const [tick, setTick] = useState(0);
  const [amount, setAmount] = useState('');
  const [extra, setExtra] = useState('');
  const [secret, setSecret] = useState<BidSecret | null>(null);
  const [err, setErr] = useState('');
  const [lastAction, setLastAction] = useState<'commit' | 'reveal' | 'other' | null>(null);

  useEffect(() => { if (address) setSecret(loadSecret(sale.id, address)); else setSecret(null); }, [address, sale.id]);
  useEffect(() => { if (tick >= grid.numTicks) setTick(Math.max(0, grid.numTicks - 1)); }, [grid.numTicks, tick]);

  const { writeContract, data: hash, isPending, error: wErr, reset } = useWriteContract();
  const { isLoading: mining, isSuccess: mined } = useWaitForTransactionReceipt({ hash, chainId: CHAIN_ID });
  useEffect(() => {
    if (!mined) return;
    chain?.refetch();
    if (lastAction === 'reveal' && secret) { const s = { ...secret, revealed: true }; saveSecret(s); setSecret(s); }
  }, [mined]); // eslint-disable-line react-hooks/exhaustive-deps

  const price = priceAtTick(grid.minPrice, grid.tickSize, tick);
  const amountUnits = useMemo(() => { try { return parseUnits(amount || '0', grid.decimals); } catch { return 0n; } }, [amount, grid.decimals]);
  const required = requiredDeposit(price, amountUnits);
  const extraWei = useMemo(() => { try { return parseEther(extra || '0'); } catch { return 0n; } }, [extra]);
  const targetDeposit = required + extraWei;
  const existing = chain?.bid?.deposit ?? 0n;
  const toSend = targetDeposit > existing ? targetDeposit - existing : 0n;
  const wrongChain = isConnected && chainId !== CHAIN_ID;
  const busy = isPending || mining;

  type Req = { address: Address; abi: typeof SEALED_BID_SALE_ABI; functionName: string; args?: readonly unknown[]; value?: bigint; chainId: number };
  const send = (action: 'commit' | 'reveal' | 'other', req: Req) => {
    setLastAction(action);
    writeContract(req as unknown as Parameters<typeof writeContract>[0]);
  };

  const onCommit = () => {
    setErr(''); reset();
    if (!address) return setErr('Connect your wallet first.');
    if (!(amountUnits > 0n)) return setErr('Enter a token amount above zero.');
    if (tick < 0 || tick >= grid.numTicks) return setErr('Pick a price tick from the ladder.');
    if (live && !chain!.funded) return setErr('The host has not funded this sale yet. Commits open once it is funded.');
    if (live && toSend === 0n) return setErr('Your current deposit already covers this bid. Add a small extra deposit to replace your sealed bid.');
    const salt = randomSalt();
    const commitment = computeCommitment(BigInt(tick), amountUnits, salt, address);
    const s: BidSecret = {
      v: 2, saleId: sale.id, sale: contract ?? undefined, bidder: address, tick, amountUnits: amountUnits.toString(), decimals: grid.decimals,
      price: formatEther(pricePerWholeToken(price, grid.decimals)), amount, salt, commitment,
      deposit: formatEther(existing + (live ? toSend : targetDeposit)), createdAt: new Date().toISOString(),
    };
    if (secret && isV2Secret(secret)) keepPrev(secret); // the old commitment stays valid onchain until this tx lands
    saveSecret(s); setSecret(s);
    if (contract && live) send('commit', { address: contract, abi: SEALED_BID_SALE_ABI, functionName: 'commit', args: [commitment], value: toSend, chainId: CHAIN_ID });
  };

  /** The saved secret whose commitment matches the one onchain (current first, then the previous one). */
  const revealable = (): BidSecret | null => {
    if (!address) return null;
    const onchain = chain?.bid?.commitment;
    const cands = [secret, loadPrev(sale.id, address)].filter((x): x is BidSecret => isV2Secret(x));
    if (!onchain) return cands[0] ?? null;
    return cands.find((c) => c.commitment.toLowerCase() === onchain.toLowerCase()) ?? null;
  };

  const onReveal = () => {
    setErr(''); reset();
    if (!address) return setErr('Connect your wallet first.');
    if (!contract || !live) return setErr('This sale has no live contract yet.');
    if (secret && !isV2Secret(secret)) return setErr('This secret was made before price ticks existed and cannot be revealed onchain.');
    const s = revealable();
    if (!s) return setErr(chain?.bid?.commitment && chain.bid.commitment !== `0x${'0'.repeat(64)}` ? 'No saved secret matches your onchain commitment. Import the right secret file.' : 'No sealed bid found for this wallet.');
    if (s !== secret) { saveSecret(s); setSecret(s); }
    send('reveal', { address: contract, abi: SEALED_BID_SALE_ABI, functionName: 'reveal', args: [BigInt(s.tick), BigInt(s.amountUnits), s.salt as Hex], chainId: CHAIN_ID });
  };

  const onImport = async (f: File | undefined) => {
    if (!f || !address) return;
    try {
      const s = JSON.parse(await f.text()) as BidSecret;
      if (s.saleId !== sale.id) return setErr('That secret belongs to a different sale.');
      if (s.bidder.toLowerCase() !== address.toLowerCase()) return setErr('That secret belongs to a different wallet.');
      if (!isV2Secret(s)) return setErr('That secret file has no price tick and cannot be revealed.');
      saveSecret(s); setSecret(s); setErr('');
    } catch { setErr('Could not read that file.'); }
  };

  const simple = (fn: string, args: readonly unknown[] = [], target: 'sale' | 'escrow' = 'sale') => {
    setErr(''); reset();
    const addr = (target === 'sale' ? contract : chain?.escrow) as Address | undefined;
    if (!addr) return setErr('Contract not available.');
    send('other', { address: addr, abi: target === 'sale' ? SEALED_BID_SALE_ABI : MILESTONE_ESCROW_ABI, functionName: fn, args, chainId: CHAIN_ID });
  };

  const tabs: { k: 'commit' | 'reveal' | 'after'; l: string }[] = [
    { k: 'commit', l: '1 · Commit' }, { k: 'reveal', l: '2 · Reveal' }, { k: 'after', l: '3 · Settle' },
  ];

  return (
    <div className={`relative overflow-hidden rounded-[2rem] p-6 sm:p-8 ${priv ? 'bg-white/55 ring-1 ring-white backdrop-blur-2xl' : 'bg-chalk ring-1 ring-ink/5'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold">Your <span className="font-serif font-normal italic">sealed</span> bid</h2>
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      </div>

      <div className="mt-5 flex gap-1 rounded-full bg-ink/5 p-1">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`relative flex-1 rounded-full py-2.5 font-label text-[11px] font-bold uppercase tracking-wider transition ${tab === t.k ? 'text-lemon' : 'text-ink/60'}`}>
            {tab === t.k && <motion.span layoutId="bidtab" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="relative">{t.l}</span>
          </button>
        ))}
      </div>

      {!contract && <p className="mt-4 rounded-2xl bg-lemon/60 px-4 py-3 font-body text-sm">Contract deploys at launch. You can prepare and save your sealed bid now. The tick ladder below is a preview.</p>}
      {contract && !live && <p className="mt-4 rounded-2xl bg-frost px-4 py-3 font-body text-sm">Reading the sale contract…</p>}
      {live && chain!.paused && <p className="mt-4 rounded-2xl bg-ink px-4 py-3 font-body text-sm text-lemon">This sale is paused by the admin. Actions resume when it is unpaused.</p>}
      {live && !chain!.funded && phase !== 'done' && <p className="mt-4 rounded-2xl bg-lemon/60 px-4 py-3 font-body text-sm">Waiting for the host to fund the sale with tokens. Commits open once it is funded.</p>}

      <AnimatePresence mode="wait">
        {tab === 'commit' && (
          <motion.div key="c" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="mt-6 space-y-4">
            {phase !== 'commit' && <p className="font-body text-sm text-ink-mute">{phase === 'soon' ? 'Bidding has not opened yet.' : 'The commit phase is over for this sale.'}</p>}
            <div>
              <div className="flex items-baseline justify-between">
                <label className={labelCls}>Price tick</label>
                <span className="font-mono text-[10px] text-ink-mute">{grid.numTicks} ticks</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-ink px-5 py-3 text-paper">
                <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-lemon">Tick <Redacted active={priv}>{tick}</Redacted></span>
                <span className="font-mono text-base"><Redacted active={priv}>{bnbPrice(pricePerWholeToken(price, grid.decimals))} BNB</Redacted> <span className="text-paper/50">per token</span></span>
              </div>
              {grid.numTicks > 1 && (
                <input type="range" min={0} max={grid.numTicks - 1} step={1} value={tick} onChange={(e) => setTick(Number(e.target.value))} className="mt-3 w-full accent-[#0B0F05]" aria-label="Price tick" />
              )}
              <div className="no-scrollbar mt-2 max-h-48 overflow-y-auto rounded-2xl bg-paper ring-1 ring-ink/10">
                {Array.from({ length: grid.numTicks }, (_, t) => {
                  const p = pricePerWholeToken(priceAtTick(grid.minPrice, grid.tickSize, t), grid.decimals);
                  const sel = t === tick;
                  const clearing = live && chain!.state === 'Succeeded' && t === chain!.clearingTick;
                  return (
                    <button key={t} type="button" onClick={() => setTick(t)} className={`flex w-full items-center justify-between px-4 py-2 text-left font-mono text-xs transition ${sel ? 'bg-lemon' : 'hover:bg-frost'}`}>
                      <span className="text-ink-mute">#{t}{clearing && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 font-label text-[9px] uppercase text-lemon">clearing</span>}</span>
                      <span>{bnbPrice(p)} BNB</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 font-mono text-[10px] text-ink-mute">price(tick) = floor + tick × step · floor {bnbPrice(pricePerWholeToken(grid.minPrice, grid.decimals))} BNB</p>
            </div>
            <div>
              <label className={labelCls}>Token amount ({sale.tokenSymbol})</label>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="10000" />
            </div>
            <div>
              <label className={labelCls}>Extra deposit to mask size (optional, BNB)</label>
              <input inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} className={inputCls} placeholder="0" />
              <p className="mt-1 font-body text-xs text-ink-mute">Your deposit is public onchain. Overpay on purpose so it says nothing about your real bid. The excess is refunded at settlement.</p>
            </div>
            <div className="space-y-2 rounded-2xl bg-ink px-5 py-4 text-paper">
              <div className="flex items-center justify-between">
                <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-lemon">Bid needs</span>
                <span className="font-mono text-sm"><Redacted active={priv}>{bnb(required)} BNB</Redacted></span>
              </div>
              {existing > 0n && (
                <div className="flex items-center justify-between">
                  <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-paper/60">Already deposited</span>
                  <span className="font-mono text-sm"><Redacted active={priv}>{bnb(existing)} BNB</Redacted></span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-lemon">Deposit sent now</span>
                <span className="font-mono text-lg"><Redacted active={priv}>{bnb(live ? toSend : targetDeposit)} BNB</Redacted></span>
              </div>
            </div>
            {!isConnected ? <ConnectWallet className="w-full" size="lg" /> : (
              <button onClick={onCommit} disabled={(live && phase !== 'commit') || busy || wrongChain || (live && chain!.paused)} className="h-16 w-full rounded-full bg-lemon font-label text-sm font-extrabold uppercase tracking-wider text-ink ring-1 ring-ink/20 transition hover:bg-ink hover:text-lemon disabled:opacity-40">
                {isPending ? 'Confirm in wallet…' : mining ? 'Sealing onchain…' : live ? (chain!.bid?.commitment && existing > 0n ? 'Replace sealed bid' : 'Seal and commit') : 'Seal and save secret'}
              </button>
            )}
          </motion.div>
        )}

        {tab === 'reveal' && (
          <motion.div key="r" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="mt-6 space-y-4">
            {phase !== 'reveal' && <p className="font-body text-sm text-ink-mute">{phase === 'commit' || phase === 'soon' ? 'Reveal opens after bidding closes. Keep your secret safe until then.' : 'The reveal window has ended.'}</p>}
            {secret ? (
              <div className="space-y-2 rounded-2xl bg-paper p-5 ring-1 ring-ink/10">
                <Row k="Tick" v={<Redacted active={priv}>{isV2Secret(secret) ? `#${secret.tick}` : 'none'}</Redacted>} />
                <Row k="Price" v={<Redacted active={priv}>{secret.price} BNB</Redacted>} />
                <Row k="Amount" v={<Redacted active={priv}>{secret.amount} {sale.tokenSymbol}</Redacted>} />
                <Row k="Deposit" v={<Redacted active={priv}>{secret.deposit} BNB</Redacted>} />
                <Row k="Commitment" v={<span className="break-all">{secret.commitment.slice(0, 10)}…{secret.commitment.slice(-6)}</span>} />
                {live && chain!.bid && <Row k="Onchain" v={chain!.bid.revealed ? 'Revealed' : chain!.bid.commitment.toLowerCase() === secret.commitment.toLowerCase() ? 'Matches' : 'Different commitment'} />}
              </div>
            ) : (
              <p className="font-body text-sm text-ink-soft">{isConnected ? 'No saved secret for this wallet on this device.' : 'Connect the wallet you bid with.'}</p>
            )}
            <label className="flex cursor-pointer items-center justify-center rounded-full py-3 font-label text-xs font-bold uppercase tracking-wider ring-1 ring-ink/20 hover:bg-ink/5">
              Import secret file
              <input type="file" accept="application/json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
            </label>
            {!isConnected ? <ConnectWallet className="w-full" size="lg" /> : (
              <button onClick={onReveal} disabled={phase !== 'reveal' || !secret || !live || busy || wrongChain || !!chain?.bid?.revealed} className="h-16 w-full rounded-full bg-ink font-label text-sm font-extrabold uppercase tracking-wider text-lemon transition hover:bg-lemon hover:text-ink disabled:opacity-40">
                {chain?.bid?.revealed ? 'Revealed' : isPending ? 'Confirm in wallet…' : mining ? 'Revealing…' : 'Reveal my bid'}
              </button>
            )}
          </motion.div>
        )}

        {tab === 'after' && (
          <motion.div key="a" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="mt-6 space-y-4">
            {!live ? (
              <p className="font-body text-sm text-ink-mute">Settlement happens onchain once the sale contract is live.</p>
            ) : (
              <>
                {phase !== 'finalize' && phase !== 'done' && <p className="font-body text-sm text-ink-mute">Finalize opens when the reveal window ends.</p>}
                {phase === 'finalize' && (
                  <div className="rounded-2xl bg-paper p-5 ring-1 ring-ink/10">
                    <p className="font-body text-sm text-ink-soft">The reveal window is over. Anyone can finalize to compute the clearing price and route the raise to escrow.</p>
                    <button onClick={() => simple('finalize')} disabled={busy || wrongChain || !isConnected || chain!.paused} className="mt-4 h-14 w-full rounded-full bg-lemon font-label text-sm font-extrabold uppercase tracking-wider text-ink ring-1 ring-ink/20 transition hover:bg-ink hover:text-lemon disabled:opacity-40">
                      {busy ? 'Working…' : 'Finalize sale'}
                    </button>
                  </div>
                )}
                {phase === 'done' && (
                  <div className="space-y-2 rounded-2xl bg-paper p-5 ring-1 ring-ink/10">
                    <Row k="Outcome" v={chain!.state === 'Succeeded' ? 'Succeeded' : 'Failed or cancelled'} />
                    {chain!.state === 'Succeeded' && <Row k="Clearing price" v={`${bnbPrice(pricePerWholeToken(chain!.clearingPrice, chain!.decimals))} BNB`} />}
                    {chain!.bid && chain!.bid.deposit > 0n && (
                      <>
                        <Row k="Your allocation" v={<Redacted active={priv}>{Number(formatUnits(chain!.allocation?.allocation ?? 0n, chain!.decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 })} {sale.tokenSymbol}</Redacted>} />
                        <Row k="You pay" v={<Redacted active={priv}>{bnb(chain!.allocation?.payment ?? 0n)} BNB</Redacted>} />
                        <Row k="Refund" v={<Redacted active={priv}>{bnb(chain!.allocation?.refund ?? 0n)} BNB</Redacted>} />
                        <Row k="Status" v={chain!.bid.settled ? 'Settled' : 'Not settled'} />
                      </>
                    )}
                  </div>
                )}
                {phase === 'done' && chain!.bid && chain!.bid.deposit > 0n && !chain!.bid.settled && address && (
                  <button onClick={() => simple('settle', [address])} disabled={busy || wrongChain || chain!.paused} className="h-16 w-full rounded-full bg-lemon font-label text-sm font-extrabold uppercase tracking-wider text-ink ring-1 ring-ink/20 transition hover:bg-ink hover:text-lemon disabled:opacity-40">
                    {busy ? 'Working…' : 'Settle my bid'}
                  </button>
                )}
                {phase === 'done' && chain!.bid?.settled && (chain!.allocation?.allocation ?? 0n) > 0n && (
                  <p className="font-body text-sm text-ink-soft">Your tokens sit in the vesting vault. Claim them from the <a href="/app/claim" className="underline decoration-lemon decoration-2 underline-offset-4">vesting portal</a>.</p>
                )}
                {chain!.escrowState?.refundMode && (
                  <div className="rounded-2xl bg-ink p-5 text-paper">
                    <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-lemon">Escrow in refund mode</p>
                    <p className="mt-1 font-mono text-lg"><Redacted active={priv}>{bnb(chain!.escrowState.refundable)} BNB</Redacted> <span className="text-paper/50">claimable</span></p>
                    <button onClick={() => simple('claimRefund', [], 'escrow')} disabled={busy || wrongChain || chain!.escrowState.refundable === 0n} className="mt-3 h-12 w-full rounded-full bg-lemon font-label text-xs font-extrabold uppercase tracking-wider text-ink disabled:opacity-40">Claim refund</button>
                  </div>
                )}
                {!chain!.escrowState?.refundMode && chain!.escrowState?.funded && chain!.escrowState.lockedAmount > 0n && chain!.bid?.settled && (chain!.allocation?.allocation ?? 0n) > 0n && (
                  <div className="rounded-2xl bg-paper p-5 ring-1 ring-ink/10">
                    <p className="font-body text-sm text-ink-soft">Unhappy with delivery? Buyers holding more than half of the tokens sold can switch the escrow into refund mode. While your vote is active your position cannot be transferred.</p>
                    {chain!.escrowState.voted > 0n ? (
                      <button onClick={() => simple('revokeRefundVote', [], 'escrow')} disabled={busy || wrongChain} className="mt-3 h-12 w-full rounded-full font-label text-xs font-bold uppercase tracking-wider ring-1 ring-ink/20 hover:bg-ink/5 disabled:opacity-40">Revoke refund vote</button>
                    ) : (
                      <button onClick={() => simple('voteRefund', [], 'escrow')} disabled={busy || wrongChain} className="mt-3 h-12 w-full rounded-full bg-ink font-label text-xs font-bold uppercase tracking-wider text-lemon disabled:opacity-40">Vote for refund</button>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {secret && tab === 'commit' && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-5 rounded-2xl bg-lemon p-5 ring-1 ring-ink/20">
          <p className="font-label text-[10px] font-extrabold uppercase tracking-[0.2em]">Secret saved on this device</p>
          <p className="mt-1 font-body text-sm text-ink-soft">You need it to reveal. Download a backup in case you clear your browser.</p>
          <button onClick={() => downloadSecret(secret)} className="mt-3 rounded-full bg-ink px-4 py-2 font-label text-[11px] font-bold uppercase tracking-wider text-lemon">Download secret</button>
        </motion.div>
      )}

      {(err || wErr) && <p className="mt-4 font-body text-sm text-red-700">{err || errMsg(wErr)}</p>}
      {hash && (
        <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="mt-4 block font-mono text-xs underline decoration-lemon decoration-2 underline-offset-4">
          {mined ? 'Confirmed' : 'Pending'} · {hash.slice(0, 10)}…{hash.slice(-6)}
        </a>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">{k}</span>
      <span className="font-mono text-sm">{v}</span>
    </div>
  );
}
