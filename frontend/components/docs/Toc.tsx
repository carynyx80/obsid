'use client';
import { useEffect, useState } from 'react';

export type TocItem = { id: string; n: string; title: string };

function useActive(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

export function TocDesktop({ items }: { items: TocItem[] }) {
  const active = useActive(items.map((i) => i.id));
  return (
    <nav aria-label="Table of contents" className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8 no-scrollbar">
      <p className="mb-4 font-label text-xs font-bold uppercase tracking-[0.2em] text-ink-mute">Contents</p>
      <ol className="space-y-0.5 border-l border-frost">
        {items.map((i) => {
          const on = active === i.id;
          return (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                className={`-ml-px flex items-baseline gap-3 border-l-2 py-1.5 pl-4 text-sm transition ${
                  on ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-mute hover:text-ink'
                }`}
              >
                <span className={`font-mono text-[10px] ${on ? 'rounded bg-lemon px-1 text-ink' : ''}`}>{i.n}</span>
                <span>{i.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function TocMobile({ items }: { items: TocItem[] }) {
  const [open, setOpen] = useState(false);
  const active = useActive(items.map((i) => i.id));
  const current = items.find((i) => i.id === active) ?? items[0];
  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-frost bg-paper/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <span className="flex items-baseline gap-2 text-sm">
          <span className="font-mono text-[10px] rounded bg-lemon px-1">{current.n}</span>
          <span className="font-semibold">{current.title}</span>
        </span>
        <span className="font-label text-xs font-bold uppercase tracking-widest text-ink-mute">
          {open ? 'Close' : 'Contents'}
        </span>
      </button>
      {open && (
        <ol className="max-h-[60vh] space-y-0.5 overflow-y-auto pb-4">
          {items.map((i) => (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                onClick={() => setOpen(false)}
                className={`flex items-baseline gap-3 rounded-lg px-2 py-2 text-sm ${active === i.id ? 'bg-chalk font-semibold' : 'text-ink-soft'}`}
              >
                <span className="font-mono text-[10px]">{i.n}</span>
                {i.title}
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
