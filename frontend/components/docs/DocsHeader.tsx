'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Logo from '@/components/ui/Logo';

const links = [
  { href: '/whitepaper', label: 'Whitepaper' },
  { href: '/how-to', label: 'How to use' },
];

export default function DocsHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-frost bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo size="sm" />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-2 font-label text-sm font-semibold transition ${
                path?.startsWith(l.href) ? 'bg-ink text-lemon' : 'text-ink-soft hover:bg-chalk'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/app"
            className="ml-2 rounded-full bg-lemon px-5 py-2 font-label text-sm font-bold text-ink transition hover:bg-lemon-deep"
          >
            Launch app
          </Link>
        </nav>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full border border-frost md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <span className="relative block h-3 w-4">
            <span className={`absolute left-0 h-0.5 w-4 bg-ink transition ${open ? 'top-1.5 rotate-45' : 'top-0'}`} />
            <span className={`absolute left-0 top-1.5 h-0.5 w-4 bg-ink transition ${open ? 'opacity-0' : ''}`} />
            <span className={`absolute left-0 h-0.5 w-4 bg-ink transition ${open ? 'top-1.5 -rotate-45' : 'top-3'}`} />
          </span>
        </button>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-frost bg-paper px-4 py-3 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-label font-semibold hover:bg-chalk">
              {l.label}
            </Link>
          ))}
          <Link href="/app" onClick={() => setOpen(false)} className="mt-1 rounded-xl bg-lemon px-3 py-2.5 font-label font-bold">
            Launch app
          </Link>
        </nav>
      )}
    </header>
  );
}
