'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatEther, parseEther, type Hex } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { bsc } from 'wagmi/chains';
import type { Sale } from '@/lib/types';
import { useRole } from '@/lib/role';
import ConnectWallet from '@/components/ui/ConnectWallet';
import Redacted from '@/components/ui/Redacted';
import {
  SEALED_BID_ABI, bidCost, computeCommitment, downloadSecret, loadSecret, randomSalt, saleAddress, saveSecret, toUnits, type BidSecret,
} from './contracts';

const inputCls = 'w-full rounded-2xl bg-paper px-4 py-3.5 font-mono text-lg outline-none ring-1 ring-ink/10 transition focus:ring-2 focus:ring-ink placeholder:text-ink/25';
const labelCls = 'mb-2 block font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute';

export default function BidPanel({ sale }: { sale: Sale }) {
  const { role } = useRole();
  const priv = role === 'buyer';
  const { address, isConnected, chainId } = useAccount();
  const contract = saleAddress(sale);
  const phase: 'commit' | 'reveal' | 'closed' | 'soon' = sale.status === 'bidding' ? 'commit' : sale.status === 'reveal' ? 'reveal' : sale.status === 'upcoming' ? 'soon' : 'closed';
  const [tab, setTab] = useState<'commit' | 'reveal'>(phase === 'reveal' ? 'reveal' : 'commit');

  const [price, setPrice] = useState(String(sale.minPrice));
  const [amount, setAmount] = useState('');
  const [extra, setExtra] = useState('');
  const [secret, setSecret] = useState<BidSecret | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { if (address) setSecret(loadSecret(sale.id, address)); }, [address, sale.id]);

  const { writeContract, data: hash, isPending, error: wErr, reset } = useWriteContract();
  const { isLoading: mining, isSuccess: mined } = useWaitForTransactionReceipt({ hash, chainId: bsc.id });

  const cost = useMemo(() => {
    try { const u = toUnits(price, amount); return bidCost(u.price, u.amount); } catch { return 0n; }
  }, [price, amount]);
  const extraWei = useMemo(() => { try { return parseEther(extra || '0'); } catch { return 0n; } }, [extra]);
  const deposit = cost + extraWei;

  const onCommit = () => {
    setErr(''); reset();
    if (!address) return setErr('Connect your wallet first.');
    const p = Number(price), a = Number(amount);
    if (!(p > 0) || !(a > 0)) return setErr('Enter a price and an amount above zero.');
    if (p < sale.minPrice) return setErr(`Price must be at least ${sale.minPrice} BNB.`);
    const { price: pw, amount: aw } = toUnits(price, amount);
    const salt = randomSalt();
    const commitment = computeCommitment(pw, aw, salt, address);
    const s: BidSecret = { saleId: sale.id, bidder: address, price, amount, salt, commitment, deposit: formatEther(deposit), createdAt: new Date().toISOString() };
    saveSecret(s); setSecret(s);
    if (contract) writeContract({ address: contract, abi: SEALED_BID_ABI, functionName: 'commit', args: [commitment], value: deposit, chainId: bsc.id });
  };

  const onReveal = () => {
    setErr(''); reset();
    if (!address) return setErr('Connect your wallet first.');
    if (!secret) return setErr('No saved secret found for this wallet. Import your secret file.');
    const { price: pw, amount: aw } = toUnits(secret.price, secret.amount);
    if (contract) writeContract({ address: contract, abi: SEALED_BID_ABI, functionName: 'reveal', args: [pw, aw, secret.salt as Hex], chainId: bsc.id });
  };

  const onImport = async (f: File | undefined) => {
    if (!f || !address) return;
    try {
      const s = JSON.parse(await f.text()) as BidSecret;
      if (s.saleId !== sale.id) return setErr('That secret belongs to a different sale.');
      if (s.bidder.toLowerCase() !== address.toLowerCase()) return setErr('That secret belongs to a different wallet.');
      saveSecret(s); setSecret(s); setErr('');
    } catch { setErr('Could not read that file.'); }
  };

  return (
    <div className={`relative overflow-hidden rounded-[2rem] p-6 sm:p-8 ${priv ? 'bg-white/55 ring-1 ring-white backdrop-blur-2xl' : 'bg-chalk ring-1 ring-ink/5'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold">Your <span className="font-serif font-normal italic">sealed</span> bid</h2>
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      </div>

      <div className="mt-5 flex gap-1 rounded-full bg-ink/5 p-1">
        {(['commit', 'reveal'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`relative flex-1 rounded-full py-2.5 font-label text-xs font-bold uppercase tracking-wider transition ${tab === t ? 'text-lemon' : 'text-ink/60'}`}>
            {tab === t && <motion.span layoutId="bidtab" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="relative">{t === 'commit' ? '1 · Commit' : '2 · Reveal'}</span>
          </button>
        ))}
      </div>

      {!contract && (
        <p className="mt-4 rounded-2xl bg-lemon/60 px-4 py-3 font-body text-sm">Contract deploys at launch. You can prepare and save your sealed bid now.</p>
      )}

      <AnimatePresence mode="wait">
        {tab === 'commit' ? (
          <motion.div key="c" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="mt-6 space-y-4">
            {phase !== 'commit' && <p className="font-body text-sm text-ink-mute">{phase === 'soon' ? 'Bidding has not opened yet.' : 'The commit phase is over for this sale.'}</p>}
            <div>
              <label className={labelCls}>Price per token (BNB)</label>
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} placeholder={String(sale.minPrice)} />
              <p className="mt-1 font-mono text-[10px] text-ink-mute">floor {sale.minPrice} BNB</p>
            </div>
            <div>
              <label className={labelCls}>Token amount ({sale.tokenSymbol})</label>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="10000" />
            </div>
            <div>
              <label className={labelCls}>Extra deposit to mask size (optional, BNB)</label>
              <input inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} className={inputCls} placeholder="0" />
              <p className="mt-1 font-body text-xs text-ink-mute">Overpay on purpose so your deposit says nothing about your real bid. The excess is refunded at settlement.</p>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-paper">
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-lemon">Deposit sent</span>
              <span className="font-mono text-lg"><Redacted active={priv}>{Number(formatEther(deposit)).toLocaleString('en-US', { maximumFractionDigits: 6 })} BNB</Redacted></span>
            </div>
            {!isConnected ? <ConnectWallet className="w-full" size="lg" /> : (
              <button onClick={onCommit} disabled={phase !== 'commit' || isPending || mining || chainId !== bsc.id} className="h-16 w-full rounded-full bg-lemon font-label text-sm font-extrabold uppercase tracking-wider text-ink ring-1 ring-ink/20 transition hover:bg-ink hover:text-lemon disabled:opacity-40">
                {isPending ? 'Confirm in wallet…' : mining ? 'Sealing onchain…' : contract ? 'Seal and commit' : 'Seal and save secret'}
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div key="r" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="mt-6 space-y-4">
            {phase !== 'reveal' && <p className="font-body text-sm text-ink-mute">{phase === 'commit' || phase === 'soon' ? 'Reveal opens after bidding closes. Keep your secret safe until then.' : 'The reveal window has ended.'}</p>}
            {secret ? (
              <div className="space-y-2 rounded-2xl bg-paper p-5 ring-1 ring-ink/10">
                <Row k="Price" v={<Redacted active={priv}>{secret.price} BNB</Redacted>} />
                <Row k="Amount" v={<Redacted active={priv}>{secret.amount} {sale.tokenSymbol}</Redacted>} />
                <Row k="Deposit" v={<Redacted active={priv}>{secret.deposit} BNB</Redacted>} />
                <Row k="Commitment" v={<span className="break-all">{secret.commitment.slice(0, 10)}…{secret.commitment.slice(-6)}</span>} />
              </div>
            ) : (
              <p className="font-body text-sm text-ink-soft">{isConnected ? 'No saved secret for this wallet on this device.' : 'Connect the wallet you bid with.'}</p>
            )}
            <label className="flex cursor-pointer items-center justify-center rounded-full py-3 font-label text-xs font-bold uppercase tracking-wider ring-1 ring-ink/20 hover:bg-ink/5">
              Import secret file
              <input type="file" accept="application/json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
            </label>
            {!isConnected ? <ConnectWallet className="w-full" size="lg" /> : (
              <button onClick={onReveal} disabled={phase !== 'reveal' || !secret || !contract || isPending || mining || chainId !== bsc.id} className="h-16 w-full rounded-full bg-ink font-label text-sm font-extrabold uppercase tracking-wider text-lemon transition hover:bg-lemon hover:text-ink disabled:opacity-40">
                {isPending ? 'Confirm in wallet…' : mining ? 'Revealing…' : 'Reveal my bid'}
              </button>
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

      {(err || wErr) && <p className="mt-4 font-body text-sm text-red-700">{err || (wErr as { shortMessage?: string })?.shortMessage || wErr?.message}</p>}
      {hash && (
        <a href={`https://bscscan.com/tx/${hash}`} target="_blank" rel="noreferrer" className="mt-4 block font-mono text-xs underline decoration-lemon decoration-2 underline-offset-4">
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
