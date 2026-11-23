'use client';
import { useEffect, useState } from 'react';

export function useNow(ms = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export default function Countdown({ to, className = '', big = false }: { to: string; className?: string; big?: boolean }) {
  const now = useNow();
  if (now === null) return <span className={`font-mono ${className}`}>··:··:··</span>;
  let s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const parts = [{ v: d, l: 'd' }, { v: h, l: 'h' }, { v: m, l: 'm' }, { v: s, l: 's' }];
  return (
    <span className={`inline-flex items-baseline gap-2 font-mono tabular-nums ${big ? 'text-3xl sm:text-4xl' : 'text-sm'} ${className}`}>
      {parts.map((p) => (
        <span key={p.l}>{String(p.v).padStart(2, '0')}<span className="ml-0.5 text-[0.6em] opacity-50">{p.l}</span></span>
      ))}
    </span>
  );
}
