'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { formatEther, formatUnits, parseEther, parseUnits, type Address } from 'viem';
import { usePublicClient, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import Redacted from '@/components/ui/Redacted';
import { fetchSales } from '@/lib/api';
import { useRole } from '@/lib/role';
import type { Sale } from '@/lib/types';
import { ALLOCATION_MARKET_ABI, useContracts } from '@/components/hostbuyer/abis';
import { saleAddress } from '@/components/core/contracts';
import { useSaleDecimals } from '@/components/core/useSaleChain';
import { CHAIN_ID, errMsg } from '@/lib/chain';
import { DemoNote, Field, Input, Kicker, PageHead, Rise, Tag, cx, ease, fmt, short, useAuth } from '@/components/hostbuyer/kit';

interface Listing { id: number; saleId: string; amount: number; askBnb: number; seller: string; mine?: boolean; onchain?: { amount: bigint; price: bigint } }
type ChainListing = { seller: Address; sale: Address; amount: bigint; price: bigint; active: boolean };
const MAX_LISTINGS = 200;
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
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const market = useContracts().contracts.AllocationMarket;

  // Live listings from AllocationMarket (newest MAX_LISTINGS).
  const count = useReadContract({ address: market, abi: ALLOCATION_MARKET_ABI, functionName: 'listingCount', chainId: CHAIN_ID, query: { enabled: !!market, refetchInterval: 30_000 } });
  const n = Number((count.data as bigint | undefined) ?? 0n);
  const ids = Array.from({ length: Math.min(n, MAX_LISTINGS) }, (_, i) => n - 1 - i);
  const rawListings = useReadContracts({
    allowFailure: true,
    contracts: market ? ids.map((id) => ({ address: market, abi: ALLOCATION_MARKET_ABI, functionName: 'getListing', args: [BigInt(id)], chainId: CHAIN_ID })) : [],
    query: { enabled: !!market && n > 0, refetchInterval: 30_000 },
  });
  const chainRows = ids.map((id, i) => ({ id, l: rawListings.data?.[i]?.status === 'success' ? (rawListings.data[i].result as ChainListing) : undefined }))
    .filter((x): x is { id: number; l: ChainListing } => !!x.l && x.l.active);
  const listedSales = Array.from(new Set(chainRows.map((x) => x.l.sale.toLowerCase()))) as Address[];
  const onchainSales = sales.filter((s) => saleAddress(s));
  const decimals = useSaleDecimals(Array.from(new Set([...listedSales, ...onchainSales.map((s) => saleAddress(s)!.toLowerCase() as Address)])));
  const saleByAddr = (a: string) => sales.find((s) => saleAddress(s)?.toLowerCase() === a.toLowerCase());
  const liveList: Listing[] = chainRows.map(({ id, l }) => {
    const d = decimals[l.sale.toLowerCase()] ?? 18;
    return { id, saleId: saleByAddr(l.sale)?.id ?? l.sale, amount: Number(formatUnits(l.amount, d)), askBnb: Number(formatEther(l.price)), seller: l.seller, onchain: { amount: l.amount, price: l.price } };
  });
  const shown = market ? liveList : list;
  useEffect(() => {
    if (market && onchainSales.length && !onchainSales.some((x) => x.id === form.saleId)) setForm((f) => ({ ...f, saleId: onchainSales[0].id }));
  }, [market, onchainSales.length, form.saleId]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => { setTimeout(() => { count.refetch(); rawListings.refetch(); }, 4000); };

  useEffect(() => {
    fetchSales().then((s) => { setSales(s); setForm((f) => ({ ...f, saleId: f.saleId || s.find((x) => x.status === 'settled')?.id || s[0]?.id || '' })); });
    try { const v = localStorage.getItem(LS); if (v) setList(JSON.parse(v)); } catch {}
  }, []);
  const persist = (l: Listing[]) => { setList(l); try { localStorage.setItem(LS, JSON.stringify(l)); } catch {} };
  const saleOf = (id: string) => sales.find((s) => s.id === id);

  async function tx(fn: () => Promise<`0x${string}`>, demo: () => void, done: string) {
    setNote('');
    if (!market) { demo(); setNote(`${done} (demo). Trading goes onchain once the AllocationMarket address is configured.`); return; }
    try {
      const h = await fn();
      setNote(`${done}, waiting for confirmation: ${short(h)}`);
      await publicClient?.waitForTransactionReceipt({ hash: h });
      demo(); setNote(`${done}: ${short(h)}`); refresh();
    } catch (e) { setNote(errMsg(e)); }
  }

  const create = () => {
    const amount = Number(form.amount), ask = Number(form.ask), s = saleOf(form.saleId);
    if (!s || !(amount > 0) || !(ask > 0)) return setNote('Fill every field');
    const sa = saleAddress(s);
    if (market && !sa) return setNote('This sale has no onchain contract yet.');
    const d = sa ? decimals[sa.toLowerCase()] ?? 18 : 18;
    let units: bigint, price: bigint;
    try { units = parseUnits(form.amount, d); price = parseEther(form.ask); } catch { return setNote('Enter valid numbers'); }
    tx(
      // list(address sale, uint256 amount, uint256 price): sale = SealedBidSale clone, amount in token wei, price = total BNB wei
      () => writeContractAsync({ address: market!, abi: ALLOCATION_MARKET_ABI, functionName: 'list', args: [sa!, units, price], chainId: CHAIN_ID }),
      () => { if (!market) persist([{ id: Date.now(), saleId: s.id, amount, askBnb: ask, seller: address ?? '0x0000000000000000000000000000000000000000', mine: true }, ...list]); setForm({ ...form, amount: '', ask: '' }); setOpen(false); },
      'Listed',
    );
  };
  const buy = (l: Listing) => tx(
    () => writeContractAsync({ address: market!, abi: ALLOCATION_MARKET_ABI, functionName: 'buy', args: [BigInt(l.id)], value: l.onchain?.price ?? parseEther(String(l.askBnb)), chainId: CHAIN_ID }),
    () => { if (!market) persist(list.filter((x) => x.id !== l.id)); }, 'Bought',
  );
  const cancel = (l: Listing) => tx(
    () => writeContractAsync({ address: market!, abi: ALLOCATION_MARKET_ABI, functionName: 'cancel', args: [BigInt(l.id)], chainId: CHAIN_ID }),
    () => { if (!market) persist(list.filter((x) => x.id !== l.id)); }, 'Cancelled',
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
                    {(market ? onchainSales : sales).map((s) => <option key={s.id} value={s.id}>{s.tokenName} ({s.tokenSymbol})</option>)}
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
            {shown.map((l, i) => {
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
        {shown.length === 0 && <p className="mt-10 font-serif text-2xl italic text-ink-mute">The desk is empty. Be the first to list.</p>}
      </div>
    </AppShell>
  );
}
