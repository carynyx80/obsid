'use client';
import { motion } from 'framer-motion';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import Reveal from '@/components/core/Reveal';

const pillars = [
  { n: '01', t: 'Tokenized equity', d: 'Real shares in real companies, represented onchain. Ownership you can hold in your own wallet.' },
  { n: '02', t: 'KYC once, privately', d: 'Verify through a licensed partner. Obsid only ever sees a yes or no attestation, never your documents.' },
  { n: '03', t: 'Jurisdiction gating', d: 'Each offering is open only where it is legal. Eligibility is checked by the contract at commit time.' },
  { n: '04', t: 'Still sealed', d: 'The same sealed bid auction, the same single clearing price. Institutions and individuals bid on equal terms.' },
];

export default function IPO() {
  return (
    <AppShell>
      <section className="relative mx-auto max-w-7xl overflow-hidden px-4 pb-24 pt-10 sm:px-8 sm:pt-16">
        <motion.div aria-hidden initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} className="pointer-events-none absolute -right-32 -top-10 h-[26rem] w-[26rem] rounded-[45%_55%_60%_40%/50%_45%_55%_50%] bg-lemon sm:h-[36rem] sm:w-[36rem]" />
        <div className="relative">
          <span className="inline-block rounded-full bg-ink px-4 py-2 font-label text-xs font-extrabold uppercase tracking-wider text-lemon">Coming soon</span>
          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="mt-6 font-display text-[18vw] font-extrabold leading-[0.85] tracking-[-0.04em] sm:text-[11rem]">
            IPO<span className="font-serif font-normal italic">,</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }} className="font-serif text-4xl italic leading-tight sm:text-6xl">
            onchain and sealed.
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 max-w-xl font-body text-lg text-ink-soft">
            Public offerings for tokenized equity are on the way. Same privacy for buyers, same transparency for issuers, plus the compliance layer that real securities demand.
          </motion.p>
        </div>

        <div className="relative mt-20 grid gap-5 sm:grid-cols-2">
          {pillars.map((p, i) => (
            <Reveal key={p.n} delay={i * 0.08}>
              <div className={`h-full rounded-[2rem] p-8 ${i === 1 ? 'bg-ink text-paper' : i === 2 ? 'bg-lemon' : 'bg-chalk'}`}>
                <span className={`font-mono text-sm ${i === 1 ? 'text-lemon' : 'text-ink-mute'}`}>{p.n}</span>
                <h3 className="mt-8 font-display text-3xl font-extrabold">{p.t}</h3>
                <p className={`mt-3 font-body ${i === 1 ? 'text-paper/70' : 'text-ink-soft'}`}>{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="relative mt-16 flex flex-col items-start gap-5 rounded-[2rem] bg-paper p-8 ring-1 ring-ink/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-2xl font-extrabold">Issuer and want in <span className="font-serif font-normal italic">early?</span></p>
          <div className="flex flex-wrap gap-3">
            <Button href="/whitepaper" variant="ghost">Read the whitepaper</Button>
            <Button href="/app/menu">Back to menu</Button>
          </div>
        </Reveal>
      </section>
    </AppShell>
  );
}
