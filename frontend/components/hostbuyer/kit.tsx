'use client';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { useCallback, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { DEMO, getAuth, type AuthHeaders } from './client';

/* ---------- formatting ---------- */
export const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { maximumFractionDigits: d });
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
export const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'passed';
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------- auth hook ---------- */
export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const auth = useCallback(async (): Promise<AuthHeaders> => {
    if (!address) throw new Error('Connect a wallet first');
    return getAuth(address, (message) => signMessageAsync({ message }));
  }, [address, signMessageAsync]);
  return { address, isConnected, auth };
}

/* ---------- motion ---------- */
export const ease = [0.22, 1, 0.36, 1] as const;
export function Rise({ delay = 0, className, children, ...rest }: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay }} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/* ---------- typography blocks ---------- */
export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx('font-label text-[11px] uppercase tracking-[0.22em] text-ink-mute', className)}>{children}</span>;
}
export function PageHead({ kicker, title, accent, aside, dark }: { kicker: string; title: React.ReactNode; accent?: React.ReactNode; aside?: React.ReactNode; dark?: boolean }) {
  return (
    <header className="relative grid gap-6 pb-10 pt-6 md:grid-cols-12 md:items-end md:pb-14 md:pt-10">
      <Rise className="md:col-span-8">
        <Kicker className={dark ? 'text-lemon' : undefined}>{kicker}</Kicker>
        <h1 className={cx('mt-4 font-display text-[clamp(2.4rem,7vw,5.6rem)] font-semibold leading-[0.92] tracking-tight', dark ? 'text-paper' : 'text-ink')}>
          {title}
          {accent && <span className="block font-serif text-[0.78em] font-normal italic tracking-normal text-ink-soft">{accent}</span>}
        </h1>
      </Rise>
      {aside && <Rise delay={0.15} className="md:col-span-4 md:justify-self-end">{aside}</Rise>}
    </header>
  );
}

export function Tag({ children, tone = 'ink', className }: { children: React.ReactNode; tone?: 'ink' | 'lemon' | 'line' | 'mute'; className?: string }) {
  const t = { ink: 'bg-ink text-lemon', lemon: 'bg-lemon text-ink', line: 'border border-ink/20 text-ink', mute: 'bg-frost text-ink-soft' }[tone];
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label text-[10px] font-semibold uppercase tracking-[0.18em]', t, className)}>{children}</span>;
}

export function DemoNote() {
  if (!DEMO) return null;
  return (
    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-dashed border-ink/25 bg-paper/70 px-3 py-1.5 font-label text-[10px] uppercase tracking-[0.2em] text-ink-soft">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lemon-deep" /> demo mode · data stays in this browser
    </div>
  );
}

export function StatusPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const m = { pending: 'bg-frost text-ink', approved: 'bg-lemon text-ink', rejected: 'bg-ink text-paper' }[status];
  const l = { pending: 'Pending admin approval', approved: 'Approved', rejected: 'Rejected' }[status];
  return <span className={cx('rounded-full px-3 py-1 font-label text-[10px] font-semibold uppercase tracking-[0.18em]', m)}>{l}</span>;
}

/* ---------- fields ---------- */
const inputCls = 'w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-[15px] text-ink outline-none transition placeholder:text-ink-mute/70 focus:border-ink focus:ring-4 focus:ring-lemon/60';
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">{label}</span>
        {hint && <span className="font-serif text-sm italic text-ink-mute">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
export function Input({ mono, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input {...p} className={cx(inputCls, mono && 'font-mono text-[13px]', className)} />;
}
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, 'min-h-[120px] resize-y', p.className)} />;
}

/* ---------- copy ---------- */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400); } catch {} }}
      className="rounded-full bg-ink px-3 py-1.5 font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-lemon transition hover:bg-ink-soft"
    >
      {done ? 'Copied' : label}
    </button>
  );
}

/* ---------- gates ---------- */
export function Gate({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <Rise className="mx-auto my-16 max-w-xl rounded-blob border border-ink/10 bg-paper/80 p-8 text-center backdrop-blur md:p-12">
      <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full bg-lemon font-display text-xl">✶</div>
      <h2 className="font-display text-3xl font-semibold leading-tight">{title}</h2>
      <p className="mt-3 font-body text-ink-soft">{body}</p>
      {cta && <div className="mt-8 flex justify-center">{cta}</div>}
    </Rise>
  );
}
