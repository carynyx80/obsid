import type { Metadata } from 'next';
import Link from 'next/link';
import DocsHeader from '@/components/docs/DocsHeader';
import HowToTabs from '@/components/docs/HowToTabs';
import Faq from '@/components/docs/Faq';
import { DocsFooter } from '@/components/docs/Prose';

export const metadata: Metadata = {
  title: 'How to use · Obsid',
  description: 'Step by step guides for hosts and buyers on Obsid, the sealed bid launchpad on BNB Chain.',
};

export default function HowToPage() {
  return (
    <div className="min-h-screen bg-paper">
      <DocsHeader />

      <header className="relative overflow-hidden border-b border-frost bg-chalk grain">
        <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-lemon opacity-40 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20 lg:px-8">
          <span className="rounded-full bg-ink px-3 py-1 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-lemon">How to use</span>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-[2.4rem] font-extrabold leading-[0.95] tracking-tighter sm:text-6xl lg:text-7xl">
            Launch loud. <span className="font-serif font-normal italic tracking-normal">Bid quiet.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            Two tracks, one launchpad. Pick your side and follow the steps, from connecting a wallet to claiming tokens.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 font-mono text-[11px] text-ink-soft">
            <span className="rounded-full border border-ink/10 bg-paper px-3 py-1.5">BNB Smart Chain · Chain 56</span>
            <span className="rounded-full border border-ink/10 bg-paper px-3 py-1.5">ICO · IDO · Presale</span>
            <span className="rounded-full border border-ink/10 bg-paper px-3 py-1.5">Buyer data stored: none</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <HowToTabs />

        <section className="mt-24" id="faq">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-label text-xs font-bold uppercase tracking-[0.2em] text-ink-mute">FAQ</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                Questions, <span className="font-serif font-normal italic">answered.</span>
              </h2>
            </div>
            <Link href="/whitepaper" className="font-label text-sm font-bold underline decoration-lemon decoration-4 underline-offset-4">
              Read the full whitepaper
            </Link>
          </div>
          <Faq />
        </section>

        <section className="relative mt-20 overflow-hidden rounded-blob bg-ink px-6 py-14 text-center text-chalk sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-lemon opacity-25 blur-3xl" />
          <p className="relative font-serif text-3xl italic leading-tight sm:text-5xl">Your bid is your business.</p>
          <p className="relative mx-auto mt-4 max-w-md text-chalk/70">Browse live ICOs, IDOs and Presales on BNB Chain, or apply to host your own.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/app" className="rounded-full bg-lemon px-7 py-3.5 font-label font-bold text-ink transition hover:bg-lemon-deep">Launch app</Link>
            <Link href="/whitepaper" className="rounded-full border border-chalk/30 px-7 py-3.5 font-label font-bold transition hover:bg-chalk/10">Whitepaper</Link>
          </div>
        </section>
      </main>
      <DocsFooter />
    </div>
  );
}
