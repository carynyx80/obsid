import Link from 'next/link';
import type { ReactNode } from 'react';

export function Section({ id, n, title, kicker, children }: { id: string; n: string; title: string; kicker?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-frost pt-14 pb-6 first:border-t-0 first:pt-0 sm:pt-20">
      <div className="mb-8 flex items-end gap-4 sm:gap-6">
        <span className="font-display text-6xl font-extrabold leading-none tracking-tighter text-lemon [-webkit-text-stroke:1.5px_#0B0F05] sm:text-8xl">
          {n}
        </span>
        <div className="pb-1">
          {kicker && <p className="mb-1 font-label text-[11px] font-bold uppercase tracking-[0.22em] text-ink-mute">{kicker}</p>}
          <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h2>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="font-body text-[17px] leading-[1.75] text-ink-soft sm:text-lg">{children}</p>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-4 font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">{children}</h3>;
}

export function Pull({ children, by }: { children: ReactNode; by?: string }) {
  return (
    <figure className="my-10 border-l-4 border-lemon bg-chalk py-6 pl-6 pr-4 sm:pl-10">
      <blockquote className="font-serif text-3xl italic leading-[1.15] text-ink sm:text-[2.6rem]">{children}</blockquote>
      {by && <figcaption className="mt-4 font-label text-xs font-bold uppercase tracking-[0.2em] text-ink-mute">{by}</figcaption>}
    </figure>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[17px] leading-[1.7] text-ink-soft sm:text-lg">
          <span className="mt-[0.7em] h-2 w-2 shrink-0 rounded-full bg-ink" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({ title, children, tone = 'lemon' }: { title: string; children: ReactNode; tone?: 'lemon' | 'ink' }) {
  const cls = tone === 'ink' ? 'bg-ink text-chalk' : 'bg-lemon-soft text-ink';
  return (
    <aside className={`rounded-3xl p-6 sm:p-8 ${cls}`}>
      <p className={`mb-2 font-label text-xs font-bold uppercase tracking-[0.2em] ${tone === 'ink' ? 'text-lemon' : 'text-ink-mute'}`}>{title}</p>
      <div className="space-y-3 text-base leading-relaxed sm:text-[17px]">{children}</div>
    </aside>
  );
}

export function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-chalk px-1.5 py-0.5 font-mono text-[0.82em] text-ink">{children}</code>;
}

export function DocsFooter() {
  return (
    <footer className="border-t border-frost bg-chalk">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="font-display text-xl font-semibold">obsid</p>
          <p className="mt-1 font-serif text-lg italic text-ink-mute">Public hosts. Private buyers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/whitepaper" className="rounded-full border border-ink/15 px-4 py-2 font-label text-sm font-semibold hover:bg-paper">Whitepaper</Link>
          <Link href="/how-to" className="rounded-full border border-ink/15 px-4 py-2 font-label text-sm font-semibold hover:bg-paper">How to use</Link>
          <Link href="/app" className="rounded-full bg-ink px-4 py-2 font-label text-sm font-bold text-lemon">Launch app</Link>
        </div>
      </div>
    </footer>
  );
}
