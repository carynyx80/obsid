'use client';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Button from '@/components/ui/Button';
import Logo from '@/components/ui/Logo';
import NetworkChip from '@/components/ui/NetworkChip';
import HeatGauge from '@/components/ui/HeatGauge';
import Reveal, { SplitWords } from '@/components/core/Reveal';

const steps = [
  { n: '01', t: 'Seal', s: 'your bid', d: 'Pick a price and an amount. Your browser hashes them with a secret salt. Only the fingerprint goes onchain, along with your BNB deposit.' },
  { n: '02', t: 'Reveal', s: 'when it closes', d: 'After bidding ends, you open your sealed envelope. The contract checks it matches the fingerprint you committed. Nobody could peek before.' },
  { n: '03', t: 'Settle', s: 'at one fair price', d: 'Everyone pays the same clearing price. Winners get tokens, unused BNB is refunded, and the host is paid through escrow.' },
];

const hidden = ['Your bid price', 'Your bid amount', 'Your wallet balance strategy', 'Your final allocation (to everyone but you)'];
const provable = ['Total BNB committed', 'Number of bids', 'Clearing price after settlement', 'Every escrow release, onchain'];

const types = [
  { k: 'ICO', d: 'Initial coin offering. Launch a brand new token straight to the community.', live: true },
  { k: 'IDO', d: 'Initial DEX offering. Raise and list with liquidity locked at launch.', live: true },
  { k: 'Presale', d: 'Early round for believers, with vesting baked in from day one.', live: true },
  { k: 'IPO', d: 'Tokenized equity with KYC and jurisdiction gating.', live: false },
];

const features = [
  { t: 'Demand gauge', d: 'Feel the heat of a sale without seeing a single bid.' },
  { t: 'Proof of participation', d: 'A soulbound badge that proves you were there, not what you paid.' },
  { t: 'Vesting portal', d: 'Claim unlocked tokens on schedule from one quiet screen.' },
  { t: 'Private allocation trading', d: 'Move a position peer to peer without broadcasting its size.' },
];

const marquee = ['sealed bids', 'one clearing price', 'no front running', 'no whale watching', 'escrowed raises', 'bnb chain mainnet'];

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const blobY = useTransform(scrollYProgress, [0, 1], [0, 220]);
  const blobR = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const frostO = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div className="overflow-x-hidden bg-paper text-ink">
      {/* NAV */}
      <nav className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto mt-3 flex max-w-7xl items-center justify-between rounded-full bg-paper/70 px-4 py-2 ring-1 ring-ink/5 backdrop-blur-xl sm:mx-6 sm:px-6 lg:mx-auto">
          <Logo />
          <div className="flex items-center gap-4 sm:gap-7">
            <Link href="/whitepaper" className="hidden font-label text-xs font-bold uppercase tracking-wider hover:underline hover:decoration-lemon hover:decoration-4 sm:inline">Whitepaper</Link>
            <Link href="/how-to" className="hidden font-label text-xs font-bold uppercase tracking-wider hover:underline hover:decoration-lemon hover:decoration-4 sm:inline">How to use</Link>
            <Button href="/app" size="sm">Open App</Button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section ref={heroRef} className="relative min-h-[100svh] px-4 pb-16 pt-32 sm:px-8 sm:pt-40">
        <motion.div style={{ y: blobY, rotate: blobR }} className="absolute -right-24 top-20 h-[22rem] w-[22rem] rounded-[42%_58%_63%_37%/45%_40%_60%_55%] bg-lemon sm:-right-10 sm:h-[38rem] sm:w-[38rem]" />
        <motion.div style={{ opacity: frostO }} className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-frost/40 to-frost" />
        <div className="relative mx-auto max-w-7xl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-8 flex flex-wrap items-center gap-3">
            <NetworkChip />
            <span className="font-label text-[11px] font-bold uppercase tracking-[0.25em] text-ink-mute">Sealed bid launchpad</span>
          </motion.div>
          <h1 className="font-display text-[15vw] font-extrabold leading-[0.88] tracking-[-0.04em] sm:text-[11vw] lg:text-[9.5rem]">
            <SplitWords text="Hosts in" />
            <br />
            <SplitWords text="daylight." delay={0.15} />
            <br />
            <span className="relative inline-block">
              <SplitWords text="Buyers" delay={0.35} />
              <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="absolute left-0 top-[48%] h-[0.38em] w-[92%] origin-left rounded-md bg-ink" />
            </span>
            <br />
            <span className="font-serif text-[16vw] font-normal italic leading-[0.8] tracking-normal sm:text-[12vw] lg:text-[10.5rem]">
              <SplitWords text="in the dark." delay={0.5} />
            </span>
          </h1>
          <div className="mt-12 grid gap-10 md:grid-cols-12">
            <Reveal delay={0.9} className="md:col-span-5 md:col-start-1">
              <p className="font-body text-lg leading-relaxed text-ink-soft sm:text-xl">
                Obsid is where projects raise in public and buyers bid in private. Every bid is sealed onchain until the auction closes, then everyone pays one fair price. No whales to watch. No bots to beat.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button href="/app" size="lg">
                  Open App
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </Button>
                <Button href="/how-to" variant="ghost" size="lg">How it works</Button>
              </div>
            </Reveal>
            <Reveal delay={1.1} className="md:col-span-4 md:col-start-9">
              <div className="rounded-blob bg-paper p-6 shadow-[0_30px_80px_-30px_rgba(11,15,5,0.35)] ring-1 ring-ink/5">
                <div className="flex items-center justify-between">
                  <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">Live sale</span>
                  <span className="font-mono text-[11px] text-ink-mute">VRD / BNB</span>
                </div>
                <p className="mt-4 font-mono text-4xl font-medium tracking-tight">1,284.5<span className="ml-1 text-base text-ink-mute">BNB</span></p>
                <p className="font-body text-sm text-ink-mute">committed by 912 sealed bids</p>
                <div className="mt-5"><HeatGauge heat="on fire" /></div>
                <div className="mt-5 flex items-center gap-2 rounded-2xl bg-frost p-3">
                  <span className="font-label text-[10px] font-bold uppercase tracking-wider text-ink-mute">Your bid</span>
                  <span className="redact ml-auto px-2 font-mono text-sm">2.40 BNB @ 0.00031</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="relative -rotate-2 bg-ink py-5 text-lemon">
        <motion.div className="flex w-max gap-10 whitespace-nowrap" animate={{ x: ['0%', '-50%'] }} transition={{ repeat: Infinity, duration: 28, ease: 'linear' }}>
          {[...marquee, ...marquee, ...marquee, ...marquee].map((m, i) => (
            <span key={i} className="flex items-center gap-10 font-display text-2xl font-semibold uppercase sm:text-4xl">
              {m}<span className="font-serif text-3xl normal-case italic text-paper sm:text-5xl">✺</span>
            </span>
          ))}
        </motion.div>
      </section>

      {/* HOW */}
      <section id="how" className="px-4 py-28 sm:px-8 sm:py-40">
        <div className="mx-auto max-w-7xl">
          <Reveal className="grid items-end gap-6 md:grid-cols-12">
            <h2 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl md:col-span-8">
              Three moves.<br /><span className="font-serif font-normal italic">Zero leaks.</span>
            </h2>
            <p className="font-body text-lg text-ink-soft md:col-span-4">A sealed bid is a promise you can prove later, and nobody can read early. Here is the whole dance.</p>
          </Reveal>
          <div className="mt-20 space-y-6">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <div className={`group grid items-center gap-6 rounded-blob p-8 transition-colors duration-500 sm:p-12 md:grid-cols-12 ${i === 1 ? 'bg-lemon md:ml-[12%]' : i === 2 ? 'bg-ink text-paper md:ml-[24%]' : 'bg-chalk md:mr-[12%]'}`}>
                  <span className={`font-mono text-6xl font-light sm:text-8xl md:col-span-3 ${i === 2 ? 'text-lemon' : ''}`}>{s.n}</span>
                  <div className="md:col-span-4">
                    <h3 className="font-display text-4xl font-extrabold sm:text-5xl">{s.t}</h3>
                    <p className="font-serif text-2xl italic sm:text-3xl">{s.s}</p>
                  </div>
                  <p className={`font-body text-base leading-relaxed md:col-span-5 ${i === 2 ? 'text-paper/75' : 'text-ink-soft'}`}>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HIDDEN VS PROVABLE */}
      <section className="relative bg-frost px-4 py-28 sm:px-8 sm:py-40">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-ink-mute">The privacy line</p>
            <h2 className="mt-4 max-w-4xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
              What stays <span className="font-serif font-normal italic">yours</span>, and what anyone can check.
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-6 md:grid-cols-2">
            <Reveal className="rounded-blob bg-white/60 p-8 ring-1 ring-white backdrop-blur-xl sm:p-12">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-lemon">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                </span>
                <h3 className="font-display text-2xl font-extrabold">Hidden</h3>
              </div>
              <ul className="mt-8 space-y-5">
                {hidden.map((h) => (
                  <li key={h} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
                    <span className="font-body text-lg">{h}</span>
                    <span className="redact h-5 w-24 sm:w-32" />
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.15} className="rounded-blob bg-paper p-8 ring-1 ring-ink/5 sm:p-12">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-lemon text-ink ring-1 ring-ink/20">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12l5 5L20 7" /></svg>
                </span>
                <h3 className="font-display text-2xl font-extrabold">Provable</h3>
              </div>
              <ul className="mt-8 space-y-5">
                {provable.map((h, i) => (
                  <li key={h} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
                    <span className="font-body text-lg">{h}</span>
                    <span className="font-mono text-sm text-ink-mute">{['1,284.5 BNB', '912', '0.000294', 'tx 0x9a…e1'][i]}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SALE TYPES */}
      <section className="px-4 py-28 sm:px-8 sm:py-40">
        <div className="mx-auto max-w-7xl">
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">Four ways<br />to <span className="font-serif font-normal italic">launch.</span></h2>
            <Button href="/app" variant="ink">Browse sales</Button>
          </Reveal>
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {types.map((t, i) => (
              <Reveal key={t.k} delay={i * 0.08}>
                <motion.div whileHover={{ y: -8, rotate: i % 2 ? 1 : -1 }} className={`relative flex h-full min-h-[18rem] flex-col justify-between overflow-hidden rounded-blob p-7 ${t.live ? (i === 0 ? 'bg-lemon' : 'bg-chalk') : 'bg-ink text-paper'}`}>
                  <span className="font-display text-6xl font-extrabold tracking-tight">{t.k}</span>
                  <div>
                    {!t.live && <span className="mb-3 inline-block rounded-full bg-lemon px-3 py-1 font-label text-[10px] font-extrabold uppercase tracking-wider text-ink">Coming soon</span>}
                    <p className={`font-body ${t.live ? 'text-ink-soft' : 'text-paper/70'}`}>{t.d}</p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ESCROW */}
      <section className="px-4 pb-28 sm:px-8 sm:pb-40">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[3rem] bg-ink p-8 text-paper sm:p-16">
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-lemon opacity-90 blur-[2px]" />
          <div className="relative grid gap-12 md:grid-cols-2">
            <Reveal>
              <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-lemon">Rug proof escrow</p>
              <h2 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] sm:text-6xl">The money waits <span className="font-serif font-normal italic text-lemon">for the work.</span></h2>
              <p className="mt-6 max-w-md font-body text-lg text-paper/70">Raised BNB never lands in a host wallet in one go. A slice unlocks at close, the rest unlocks per milestone. Miss the soft cap and every buyer is refunded automatically.</p>
            </Reveal>
            <Reveal delay={0.2} className="space-y-4 self-end">
              {[{ l: 'At close', p: 30 }, { l: 'Mainnet beta', p: 35 }, { l: 'Audit and v1', p: 35 }].map((m, i) => (
                <div key={m.l} className="rounded-3xl bg-paper/5 p-5 ring-1 ring-paper/10 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span className="font-label text-sm font-bold uppercase tracking-wider">{m.l}</span>
                    <span className="font-mono text-lemon">{m.p}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper/10">
                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${m.p * 2.6}%` }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.2, duration: 1, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full bg-lemon" />
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-lemon px-4 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal><h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">Also <span className="font-serif font-normal italic">inside.</span></h2></Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-blob bg-ink/15 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <Reveal key={f.t} delay={i * 0.08} className="h-full bg-lemon p-8">
                <span className="font-mono text-sm text-ink/50">0{i + 1}</span>
                <h3 className="mt-10 font-display text-2xl font-extrabold leading-tight">{f.t}</h3>
                <p className="mt-3 font-body text-ink-soft">{f.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* DOCS CTA */}
      <section className="px-4 py-28 sm:px-8 sm:py-40">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
          {[{ h: '/whitepaper', t: 'Whitepaper', s: 'The mechanism, the math, the contracts.' }, { h: '/how-to', t: 'How to use', s: 'From connecting a wallet to claiming tokens.' }].map((d, i) => (
            <Reveal key={d.h} delay={i * 0.1}>
              <Link href={d.h} className="group flex min-h-[16rem] flex-col justify-between rounded-blob bg-chalk p-8 ring-1 ring-ink/5 transition-colors duration-500 hover:bg-ink hover:text-paper sm:p-12">
                <span className="font-label text-xs font-bold uppercase tracking-[0.3em] text-ink-mute group-hover:text-lemon">Read</span>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h3 className="font-display text-4xl font-extrabold sm:text-5xl">{d.t}</h3>
                    <p className="mt-2 font-serif text-xl italic">{d.s}</p>
                  </div>
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-lemon text-2xl text-ink transition-transform duration-500 group-hover:-rotate-45">→</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative overflow-hidden bg-ink px-4 pb-10 pt-24 text-paper sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-serif text-3xl italic text-lemon sm:text-4xl">Bid like nobody is watching.</p>
              <p className="mt-2 font-body text-paper/60">Because nobody is.</p>
            </div>
            <div className="flex flex-wrap gap-6 font-label text-xs font-bold uppercase tracking-wider">
              <Link href="/whitepaper" className="hover:text-lemon">Whitepaper</Link>
              <Link href="/how-to" className="hover:text-lemon">How to use</Link>
              <Link href="/app" className="hover:text-lemon">Open App</Link>
            </div>
          </div>
          <p className="mt-16 select-none font-display text-[26vw] font-extrabold leading-[0.8] tracking-[-0.06em] text-paper/[0.06] lg:text-[20rem]">obsid.</p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-paper/10 pt-6">
            <span className="font-mono text-[11px] text-paper/40">Chain ID 56 · BNB Smart Chain</span>
            <span className="font-body text-xs text-paper/40">© 2026 Obsid. Not financial advice.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
