'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import ConnectWallet from '@/components/ui/ConnectWallet';
import { useRole } from '@/lib/role';
import type { SaleType } from '@/lib/types';
import { DEMO, getMyHost, myApplications, submitApplication, type Application, type ApplicationInput } from '@/components/hostbuyer/client';
import { DemoNote, Field, Gate, Input, Kicker, PageHead, Rise, StatusPill, Textarea, cx, ease, fmt, fmtDate, useAuth } from '@/components/hostbuyer/kit';

const STEPS = ['Project', 'Token', 'Sale terms', 'Escrow', 'Review'] as const;
const TYPES: { id: SaleType; name: string; line: string; soon?: boolean }[] = [
  { id: 'ICO', name: 'ICO', line: 'Your token, sold direct, sealed bids, one clearing price.' },
  { id: 'IDO', name: 'IDO', line: 'Sealed round with liquidity seeded on a DEX at settle.' },
  { id: 'PRESALE', name: 'Presale', line: 'Early community round before the main event.' },
  { id: 'IPO', name: 'IPO', line: 'Tokenized equity rounds.', soon: true },
];

const iso = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 16);
const blank = {
  type: 'ICO' as SaleType, projectName: '', tokenName: '', tokenSymbol: '', tokenAddress: '', supply: '', minPrice: '', softCapBnb: '', hardCapBnb: '',
  start: iso(7), end: iso(14), revealEnd: iso(16), escrowAtClosePct: 30, milestones: [{ label: 'Mainnet launch', pct: 35 }, { label: 'Audit and v1', pct: 35 }], summary: '',
};
type Form = typeof blank;

export default function ApplyPage() {
  const { role } = useRole();
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        {role === 'buyer' ? (
          <Gate title="Hosting is a public act" body="You are browsing as a private buyer. Switch to host mode to apply for a sale." cta={<Button href="/app" variant="ink">Back to app</Button>} />
        ) : (
          <ApplyFlow />
        )}
      </div>
    </AppShell>
  );
}

function ApplyFlow() {
  const { address, isConnected, auth } = useAuth();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [f, setF] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mine, setMine] = useState<Application[]>([]);
  const [justSent, setJustSent] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!address) return;
    getMyHost(address).then((h) => h && setF((p) => (p.projectName ? p : { ...p, projectName: h.name })));
    if (DEMO) auth().then(myApplications).then(setMine).catch(() => {});
  }, [address, auth]);
  const [loaded, setLoaded] = useState(DEMO);
  const loadMine = () => auth().then(myApplications).then((l) => { setMine(l); setLoaded(true); }).catch((e) => setErr(e instanceof Error ? e.message : 'Sign in failed'));

  const msTotal = f.milestones.reduce((a, m) => a + (Number(m.pct) || 0), 0);
  const allocated = f.escrowAtClosePct + msTotal;
  const problems = useMemo(() => {
    const p: string[][] = [[], [], [], [], []];
    if (!f.projectName.trim()) p[0].push('Name your project');
    if (f.summary.trim().length < 20) p[0].push('Summary needs at least 20 characters');
    if (!f.tokenName.trim()) p[1].push('Token name');
    if (!/^[A-Za-z0-9]{2,10}$/.test(f.tokenSymbol)) p[1].push('Symbol of 2 to 10 letters');
    if (!/^0x[0-9a-fA-F]{40}$/.test(f.tokenAddress)) p[1].push('A valid token address');
    if (!(Number(f.supply) > 0)) p[1].push('Supply for sale');
    if (!(Number(f.minPrice) > 0)) p[2].push('Minimum price');
    if (!(Number(f.softCapBnb) > 0)) p[2].push('Soft cap');
    if (!(Number(f.hardCapBnb) > Number(f.softCapBnb))) p[2].push('Hard cap above soft cap');
    if (!(new Date(f.end) > new Date(f.start))) p[2].push('End after start');
    if (!(new Date(f.revealEnd) > new Date(f.end))) p[2].push('Reveal ends after bidding ends');
    if (allocated !== 100) p[3].push(`Escrow plan must total 100 percent (now ${allocated})`);
    if (f.milestones.some((m) => !m.label.trim())) p[3].push('Every milestone needs a label');
    return p;
  }, [f, allocated]);

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };
  const canNext = problems[step].length === 0;

  async function submit() {
    setBusy(true); setErr('');
    try {
      const a = await auth();
      const input: ApplicationInput = {
        type: f.type, tokenName: f.tokenName.trim(), tokenSymbol: f.tokenSymbol.toUpperCase(), tokenAddress: f.tokenAddress, supply: Number(f.supply), minPrice: Number(f.minPrice),
        softCapBnb: Number(f.softCapBnb), hardCapBnb: Number(f.hardCapBnb), start: new Date(f.start).toISOString(), end: new Date(f.end).toISOString(), revealEnd: new Date(f.revealEnd).toISOString(),
        escrowAtClosePct: f.escrowAtClosePct, milestones: f.milestones.map((m) => ({ label: m.label.trim(), pct: Number(m.pct) })), summary: f.summary.trim(),
      };
      const app = await submitApplication(input, a, f.projectName);
      setMine((m) => [app, ...m]);
      setJustSent(true); setF(blank); setStep(0);
    } catch (e) { setErr(e instanceof Error ? e.message.slice(0, 200) : 'Something went wrong'); }
    setBusy(false);
  }

  return (
    <>
      <PageHead
        kicker="Host application"
        title={<>Bring a sale<br />to the vault.</>}
        accent="public host, sealed bids, honest price."
        aside={<p className="max-w-xs font-body text-ink-soft">Every sale is reviewed by the Obsid desk before it opens. Your terms are public. Your buyers stay private.</p>}
      />
      <DemoNote />

      {!isConnected ? (
        <Gate title="Connect to apply" body="Your host wallet signs the application so buyers know exactly who stands behind it." cta={<ConnectWallet />} />
      ) : justSent ? (
        <Rise className="relative overflow-hidden rounded-blob bg-ink p-8 text-paper md:p-14">
          <motion.div aria-hidden className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-lemon" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 1, ease }} />
          <div className="relative max-w-xl">
            <Kicker className="text-lemon">Submitted</Kicker>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-none md:text-6xl">Pending admin approval</h2>
            <p className="mt-4 font-serif text-xl italic text-paper/70">We read every word. Expect a decision soon; you will see it below.</p>
            <div className="mt-8"><Button variant="lemon" onClick={() => setJustSent(false)}>Start another</Button></div>
          </div>
        </Rise>
      ) : (
        <div className="grid gap-8 lg:grid-cols-12">
          {/* step rail */}
          <aside className="lg:col-span-3">
            <ol className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0">
              {STEPS.map((s, i) => {
                const reachable = i <= step || problems.slice(0, i).every((p) => p.length === 0);
                return (
                  <li key={s} className="shrink-0">
                    <button
                      disabled={!reachable}
                      onClick={() => go(i)}
                      className={cx('group flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left transition lg:rounded-2xl lg:py-4', i === step ? 'bg-lemon' : 'hover:bg-chalk', !reachable && 'opacity-40')}
                    >
                      <span className="font-mono text-xs text-ink-mute">0{i + 1}</span>
                      <span className="font-label text-xs font-semibold uppercase tracking-[0.16em]">{s}</span>
                      {i < step && problems[i].length === 0 && <span className="ml-auto hidden font-display text-sm lg:inline">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          <section className="relative lg:col-span-9">
            <div className="relative min-h-[460px] overflow-hidden rounded-blob border border-ink/10 bg-chalk p-5 sm:p-8 md:p-10">
              <span aria-hidden className="pointer-events-none absolute -right-4 -top-10 select-none font-display text-[10rem] font-bold leading-none text-ink/[0.04] md:text-[14rem]">0{step + 1}</span>
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={step}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -40 }}
                  transition={{ duration: 0.45, ease }}
                  className="relative"
                >
                  {step === 0 && (
                    <div className="space-y-8">
                      <StepTitle n="Project" line="What are you building, and which kind of sale fits?" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {TYPES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            disabled={t.soon}
                            onClick={() => set('type', t.id)}
                            className={cx(
                              'relative rounded-3xl border p-5 text-left transition',
                              t.soon ? 'cursor-not-allowed border-dashed border-ink/15 bg-paper/40 opacity-60' : f.type === t.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper hover:border-ink/40',
                            )}
                          >
                            <span className="font-display text-3xl font-semibold">{t.name}</span>
                            {t.soon && <span className="absolute right-4 top-4 rounded-full bg-frost px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.18em] text-ink">Coming soon</span>}
                            {f.type === t.id && !t.soon && <motion.span layoutId="typeDot" className="absolute right-4 top-4 h-3 w-3 rounded-full bg-lemon" />}
                            <p className={cx('mt-2 font-body text-sm', f.type === t.id && !t.soon ? 'text-paper/70' : 'text-ink-soft')}>{t.line}</p>
                          </button>
                        ))}
                      </div>
                      <Field label="Project name"><Input value={f.projectName} onChange={(e) => set('projectName', e.target.value)} placeholder="Verdant Labs" /></Field>
                      <Field label="Summary" hint="shown on the sale page"><Textarea value={f.summary} onChange={(e) => set('summary', e.target.value)} placeholder="One clear paragraph about what buyers are backing." /></Field>
                    </div>
                  )}
                  {step === 1 && (
                    <div className="space-y-6">
                      <StepTitle n="Token" line="The asset buyers will receive at settle." />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Token name"><Input value={f.tokenName} onChange={(e) => set('tokenName', e.target.value)} placeholder="Verdant" /></Field>
                        <Field label="Symbol"><Input mono value={f.tokenSymbol} onChange={(e) => set('tokenSymbol', e.target.value.toUpperCase())} placeholder="VRD" maxLength={10} /></Field>
                      </div>
                      <Field label="Token address" hint="BEP20 on BNB Chain"><Input mono value={f.tokenAddress} onChange={(e) => set('tokenAddress', e.target.value.trim())} placeholder="0x…" /></Field>
                      <Field label="Supply for sale" hint="tokens"><Input mono inputMode="decimal" value={f.supply} onChange={(e) => set('supply', e.target.value)} placeholder="10000000" /></Field>
                    </div>
                  )}
                  {step === 2 && (
                    <div className="space-y-6">
                      <StepTitle n="Sale terms" line="Bids are sealed until reveal. One clearing price for everyone." />
                      <div className="grid gap-5 sm:grid-cols-3">
                        <Field label="Min price" hint="BNB"><Input mono inputMode="decimal" value={f.minPrice} onChange={(e) => set('minPrice', e.target.value)} placeholder="0.0002" /></Field>
                        <Field label="Soft cap" hint="BNB"><Input mono inputMode="decimal" value={f.softCapBnb} onChange={(e) => set('softCapBnb', e.target.value)} placeholder="400" /></Field>
                        <Field label="Hard cap" hint="BNB"><Input mono inputMode="decimal" value={f.hardCapBnb} onChange={(e) => set('hardCapBnb', e.target.value)} placeholder="2000" /></Field>
                      </div>
                      <div className="grid gap-5 sm:grid-cols-3">
                        <Field label="Bidding opens"><Input mono type="datetime-local" value={f.start} onChange={(e) => set('start', e.target.value)} /></Field>
                        <Field label="Bidding closes"><Input mono type="datetime-local" value={f.end} onChange={(e) => set('end', e.target.value)} /></Field>
                        <Field label="Reveal closes"><Input mono type="datetime-local" value={f.revealEnd} onChange={(e) => set('revealEnd', e.target.value)} /></Field>
                      </div>
                      <Timeline start={f.start} end={f.end} reveal={f.revealEnd} />
                    </div>
                  )}
                  {step === 3 && (
                    <div className="space-y-6">
                      <StepTitle n="Escrow and milestones" line="Raised BNB unlocks to you in public, in stages." />
                      <EscrowBar close={f.escrowAtClosePct} ms={f.milestones} />
                      <Field label="Released at close" hint={`${f.escrowAtClosePct} percent`}>
                        <input type="range" min={0} max={100} value={f.escrowAtClosePct} onChange={(e) => set('escrowAtClosePct', Number(e.target.value))} className="w-full accent-ink" />
                      </Field>
                      <div className="space-y-3">
                        {f.milestones.map((m, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-3 rounded-2xl bg-paper p-3 sm:flex-nowrap">
                            <span className="font-mono text-xs text-ink-mute">M{i + 1}</span>
                            <Input className="min-w-0 flex-1" value={m.label} onChange={(e) => set('milestones', f.milestones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Milestone label" />
                            <Input mono className="w-24" inputMode="numeric" value={m.pct} onChange={(e) => set('milestones', f.milestones.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)))} />
                            <span className="font-label text-[10px] uppercase tracking-[0.18em] text-ink-mute">pct</span>
                            <button type="button" onClick={() => set('milestones', f.milestones.filter((_, j) => j !== i))} className="font-label text-[10px] uppercase tracking-[0.18em] text-ink-mute hover:text-ink">Remove</button>
                          </div>
                        ))}
                        {f.milestones.length < 6 && (
                          <button type="button" onClick={() => set('milestones', [...f.milestones, { label: '', pct: 0 }])} className="w-full rounded-2xl border border-dashed border-ink/25 py-3 font-label text-xs uppercase tracking-[0.16em] text-ink-soft hover:border-ink hover:text-ink">
                            Add milestone
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {step === 4 && (
                    <div className="space-y-6">
                      <StepTitle n="Review" line="This is exactly what the desk will see." />
                      <div className="grid gap-px overflow-hidden rounded-3xl bg-ink/10 sm:grid-cols-2">
                        {[
                          ['Project', f.projectName], ['Type', f.type], ['Token', `${f.tokenName} · ${f.tokenSymbol}`], ['Address', f.tokenAddress],
                          ['Supply', fmt(Number(f.supply), 0)], ['Min price', `${f.minPrice} BNB`], ['Caps', `${f.softCapBnb} to ${f.hardCapBnb} BNB`],
                          ['Window', `${fmtDate(f.start)} → ${fmtDate(f.end)}`], ['Reveal ends', fmtDate(f.revealEnd)], ['Escrow', `${f.escrowAtClosePct} at close, ${f.milestones.length} milestones`],
                        ].map(([k, v]) => (
                          <div key={k} className="bg-paper p-4">
                            <Kicker>{k}</Kicker>
                            <p className={cx('mt-1 break-all', ['Address', 'Supply', 'Min price', 'Caps', 'Window', 'Reveal ends'].includes(k) ? 'font-mono text-[13px]' : 'font-body')}>{v}</p>
                          </div>
                        ))}
                      </div>
                      <p className="font-serif text-lg italic text-ink-soft">“{f.summary}”</p>
                      {err && <p className="rounded-2xl bg-ink p-4 font-body text-sm text-lemon">{err}</p>}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => go(step - 1)}>Back</Button>
              <div className="flex items-center gap-3">
                {!canNext && <span className="hidden font-serif text-sm italic text-ink-mute sm:inline">{problems[step][0]}</span>}
                {step < 4 ? (
                  <Button variant="ink" disabled={!canNext} onClick={() => go(step + 1)}>Continue</Button>
                ) : (
                  <Button variant="lemon" disabled={busy || problems.some((p) => p.length)} onClick={submit}>{busy ? 'Signing…' : 'Sign and submit'}</Button>
                )}
              </div>
            </div>
            {!canNext && <p className="mt-2 font-serif text-sm italic text-ink-mute sm:hidden">{problems[step][0]}</p>}
          </section>
        </div>
      )}

      {isConnected && <MyApplications list={mine} loaded={loaded || mine.length > 0} onLoad={loadMine} />}
    </>
  );
}

function StepTitle({ n, line }: { n: string; line: string }) {
  return (
    <div>
      <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{n}</h2>
      <p className="mt-1 font-serif text-lg italic text-ink-soft">{line}</p>
    </div>
  );
}

function Timeline({ start, end, reveal }: { start: string; end: string; reveal: string }) {
  const s = new Date(start).getTime(), e = new Date(end).getTime(), r = new Date(reveal).getTime();
  const total = Math.max(r - s, 1);
  const bidPct = Math.max(0, Math.min(100, ((e - s) / total) * 100));
  return (
    <div className="rounded-3xl bg-paper p-5">
      <div className="flex h-10 overflow-hidden rounded-full">
        <motion.div className="flex items-center bg-ink px-4 font-label text-[10px] uppercase tracking-[0.18em] text-lemon" animate={{ width: `${bidPct}%` }} transition={{ ease }}>sealed</motion.div>
        <div className="flex flex-1 items-center bg-lemon px-4 font-label text-[10px] uppercase tracking-[0.18em]">reveal</div>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-mute"><span>{fmtDate(start)}</span><span>{fmtDate(end)}</span><span>{fmtDate(reveal)}</span></div>
    </div>
  );
}

function EscrowBar({ close, ms }: { close: number; ms: { label: string; pct: number }[] }) {
  const total = close + ms.reduce((a, m) => a + m.pct, 0);
  const shades = ['bg-ink/80', 'bg-ink/60', 'bg-ink/40', 'bg-ink/25', 'bg-ink/15', 'bg-ink/10'];
  return (
    <div className="rounded-3xl bg-paper p-5">
      <div className="flex h-12 overflow-hidden rounded-full bg-frost">
        <motion.div layout className="grid place-items-center bg-lemon font-mono text-[11px]" style={{ width: `${Math.min(close, 100)}%` }}>{close > 8 && `${close}`}</motion.div>
        {ms.map((m, i) => (
          <motion.div layout key={i} className={cx('grid place-items-center font-mono text-[11px] text-paper', shades[i])} style={{ width: `${Math.max(0, Math.min(m.pct, 100))}%` }}>{m.pct > 8 && m.pct}</motion.div>
        ))}
      </div>
      <p className={cx('mt-3 font-label text-[11px] uppercase tracking-[0.18em]', total === 100 ? 'text-ink' : 'text-ink-mute')}>
        Allocated <span className="font-mono">{total}</span> of <span className="font-mono">100</span>
      </p>
    </div>
  );
}

function MyApplications({ list, loaded, onLoad }: { list: Application[]; loaded: boolean; onLoad: () => void }) {
  return (
    <section className="mt-20">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">My applications</h2>
        <span className="font-mono text-sm text-ink-mute">{list.length}</span>
      </div>
      {!loaded ? (
        <Button variant="ghost" onClick={onLoad}>Sign in to view status</Button>
      ) : list.length === 0 ? (
        <p className="font-serif text-xl italic text-ink-mute">Nothing filed yet. Your first sale starts above.</p>
      ) : (
        <ul className="divide-y divide-ink/10 border-y border-ink/10">
          {list.map((a, i) => (
            <motion.li key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease }} className="grid items-center gap-3 py-5 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <p className="font-display text-xl font-semibold">{a.tokenName} <span className="font-mono text-sm font-normal text-ink-mute">{a.tokenSymbol}</span></p>
                <p className="font-label text-[10px] uppercase tracking-[0.18em] text-ink-mute">{a.type} · filed {fmtDate(a.createdAt)}</p>
              </div>
              <p className="font-mono text-sm sm:col-span-3">{a.softCapBnb} to {a.hardCapBnb} BNB</p>
              <div className="sm:col-span-4 sm:text-right">
                <StatusPill status={a.status} />
                {a.reason && <p className="mt-2 font-serif text-sm italic text-ink-soft">{a.reason}</p>}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
