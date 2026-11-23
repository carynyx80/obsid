'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { parseEther, parseUnits } from 'viem';
import { useWriteContract } from 'wagmi';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import Redacted from '@/components/ui/Redacted';
import { fetchSales } from '@/lib/api';
import { useRole } from '@/lib/role';
import type { Sale } from '@/lib/types';
import { ALLOCATION_MARKET, marketAbi } from '@/components/hostbuyer/abis';
import { DemoNote, Field, Input, Kicker, PageHead, Rise, Tag, cx, ease, fmt, short, useAuth } from '@/components/hostbuyer/kit';

interface Listing { id: number; saleId: string; amount: number; askBnb: number; seller: string; mine?: boolean }
const LS = 'obsid.demo.listings';
const seed: Listing[] = [
  { id: 1, saleId: 's4', amount: 1200, askBnb: 19.2, seller: '0x4a1E7b3C2d9F0e8A6b5C4d3E2f1A0b9C8d7E6f5a' },
  { id: 2, saleId: 's4', amount: 350, askBnb: 5.95, seller: '0x9C2b1A0f8E7d6C5b4A3f2E1d0C9b8A7f6E5d4c3b' },
  { id: 3, saleId: 's1', amount: 8000, askBnb: 3.1, seller: '0x2E5d8C1b4A7f0E3d6C9b2A5f8E1d4C7b0A3f6e9d' },
];

export default function TradePage() {
  const { role } = useRole();
  const { address } = useAuth();
  const priv = role !== 'host';
  const [sales, setSales] = useState<Sale[]>([]);
  const [list, setList] = useState<Listing[]>(seed);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ saleId: '', amount: '', ask: '' });
  const [note, setNote] = useState('');
  const { writeContractAsync, isPending } = useWriteContract();

  useEffect(() => {
    fetchSales().then((s) => { setSales(s); setForm((f) => ({ ...f, saleId: f.saleId || s.find((x) => x.status === 'settled')?.id || s[0]?.id || '' })); });
    try { const v = localStorage.getItem(LS); if (v) setList(JSON.parse(v)); } catch {}
  }, []);
  const persist = (l: Listing[]) => { setList(l); try { localStorage.setItem(LS, JSON.stringify(l)); } catch {} };
  const saleOf = (id: string) => sales.find((s) => s.id === id);

  async function tx(fn: () => Promise<`0x${string}`>, demo: () => void, done: string) {
    setNote('');
    if (!ALLOCATION_MARKET) { demo(); setNote(`${done} (demo). Set NEXT_PUBLIC_ALLOCATION_MARKET to trade onchain.`); return; }
    try { const h = await fn(); demo(); setNote(`${done}: ${short(h)}`); } catch (e) { setNote(e instanceof Error ? e.message.split('\n')[0].slice(0, 140) : 'Transaction failed'); }
  }

  const create = () => {
    const amount = Number(form.amount), ask = Number(form.ask), s = saleOf(form.saleId);
    if (!s || !(amount > 0) || !(ask > 0)) return setNote('Fill every field');
    tx(
      () => writeContractAsync({ address: ALLOCATION_MARKET!, abi: marketAbi, functionName: 'list', args: [s.tokenAddress as `0x${string}`, parseUnits(form.amount, 18), parseEther(form.ask)] }),
      () => { persist([{ id: Date.now(), saleId: s.id, amount, askBnb: ask, seller: address ?? '0x0000000000000000000000000000000000000000', mine: true }, ...list]); setForm({ ...form, amount: '', ask: '' }); setOpen(false); },
      'Listed',
    );
  };
  const buy = (l: Listing) => tx(
    () => writeContractAsync({ address: ALLOCATION_MARKET!, abi: marketAbi, functionName: 'buy', args: [BigInt(l.id)], value: parseEther(String(l.askBnb)) }),
    () => persist(list.filter((x) => x.id !== l.id)), 'Bought',
  );
  const cancel = (l: Listing) => tx(
    () => writeContractAsync({ address: ALLOCATION_MARKET!, abi: marketAbi, functionName: 'cancel', args: [BigInt(l.id)] }),
    () => persist(list.filter((x) => x.id !== l.id)), 'Cancelled',
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <PageHead
          kicker="Allocation desk"
          title={<>Trade the<br />unclaimed.</>}
          accent="sell a locked allocation, quietly."
          aside={<Button variant="ink" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'Create listing'}</Button>}
        />
        <DemoNote />
        <Rise className="mb-8 flex items-start gap-3 rounded-3xl border border-dashed border-ink/25 bg-paper/60 p-4 backdrop-blur">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lemon font-display text-xs">i</span>
          <p className="font-body text-sm text-ink-soft"><span className="font-semibold text-ink">Heads up.</span> In v1 the trade price and size are visible onchain once a listing fills. Your original bid stays sealed.</p>
        </Rise>

        <AnimatePresence>
          {open && (
            <motion.section initial={{ opacity: 0, y: -12, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -12, height: 0 }} transition={{ ease }} className="mb-10 overflow-hidden">
              <div className="grid gap-5 rounded-blob bg-lemon p-6 md:grid-cols-4 md:items-end md:p-8">
                <Field label="Sale">
                  <select value={form.saleId} onChange={(e) => setForm({ ...form, saleId: e.target.value })} className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-[15px] outline-none focus:border-ink">
                    {sales.map((s) => <option key={s.id} value={s.id}>{s.tokenName} ({s.tokenSymbol})</option>)}
                  </select>
                </Field>
                <Field label="Tokens"><Input mono inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="1000" /></Field>
                <Field label="Ask" hint="BNB total"><Input mono inputMode="decimal" value={form.ask} onChange={(e) => setForm({ ...form, ask: e.target.value })} placeholder="12.5" /></Field>
                <Button variant="ink" disabled={isPending} onClick={create}>{isPending ? 'Confirm in wallet' : 'List allocation'}</Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
        {note && <p className="mb-6 font-serif text-lg italic text-ink-soft">{note}</p>}

        <div className="hidden grid-cols-12 gap-4 border-b border-ink/10 px-6 pb-3 md:grid">
          {['Sale', 'Allocation', 'Ask', 'Per token', 'Seller', ''].map((h, i) => (
            <Kicker key={i} className={cx(i === 0 ? 'col-span-3' : 'col-span-2', i === 5 && 'col-span-1')}>{h}</Kicker>
          ))}
        </div>
        <ul className="space-y-3 md:mt-3">
          <AnimatePresence initial={false}>
            {list.map((l, i) => {
              const s = saleOf(l.saleId);
              const mine = l.mine || (address && l.seller.toLowerCase() === address.toLowerCase());
              return (
                <motion.li key={l.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }} exit={{ opacity: 0, x: 60 }}
                  className="grid grid-cols-2 items-center gap-4 rounded-3xl border border-ink/10 bg-paper/70 p-5 backdrop-blur transition hover:border-ink md:grid-cols-12 md:px-6">
                  <div className="col-span-2 md:col-span-3">
                    <p className="font-display text-xl font-semibold">{s?.tokenName ?? l.saleId}</p>
                    <div className="mt-1 flex gap-2"><Tag tone="mute">{s?.type ?? 'Sale'}</Tag>{mine && <Tag tone="lemon">yours</Tag>}</div>
                  </div>
                  <div className="md:col-span-2"><Kicker className="md:hidden">Allocation</Kicker><p className="font-mono">{mine ? <Redacted active={priv}>{fmt(l.amount, 2)}</Redacted> : fmt(l.amount, 2)} <span className="text-ink-mute">{s?.tokenSymbol}</span></p></div>
                  <div className="md:col-span-2"><Kicker className="md:hidden">Ask</Kicker><p className="font-mono text-lg">{fmt(l.askBnb, 4)} <span className="text-sm text-ink-mute">BNB</span></p></div>
                  <div className="md:col-span-2"><Kicker className="md:hidden">Per token</Kicker><p className="font-mono text-sm text-ink-soft">{(l.askBnb / l.amount).toPrecision(3)}</p></div>
                  <div className="md:col-span-2"><Kicker className="md:hidden">Seller</Kicker><p className="font-mono text-xs text-ink-mute">{short(l.seller)}</p></div>
                  <div className="col-span-2 md:col-span-1 md:text-right">
                    {mine ? <Button size="sm" variant="ghost" onClick={() => cancel(l)}>Cancel</Button> : <Button size="sm" variant="lemon" disabled={isPending} onClick={() => buy(l)}>Buy</Button>}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {list.length === 0 && <p className="mt-10 font-serif text-2xl italic text-ink-mute">The desk is empty. Be the first to list.</p>}
      </div>
    </AppShell>
  );
}
