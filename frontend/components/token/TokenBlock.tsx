'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { OBSID_CA, OBSID_BUY_URL } from '@/lib/token';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function TokenBlock({ className = '' }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const onCopy = async () => {
    if (!OBSID_CA) return;
    if (await copyText(OBSID_CA)) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    }
  };

  const buyCls =
    'group inline-flex h-16 w-full items-center justify-center gap-3 rounded-full bg-lemon px-9 font-display text-lg font-extrabold uppercase tracking-tight text-ink transition-all duration-300 sm:w-auto sm:text-xl';

  return (
    <div className={`max-w-xl ${className}`}>
      <div className="flex items-center gap-3 rounded-full bg-paper/80 py-2 pl-2 pr-2 ring-1 ring-ink/10 backdrop-blur">
        <span className="shrink-0 rounded-full bg-ink px-3 py-1.5 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-lemon">CA</span>
        {OBSID_CA ? (
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink sm:text-sm" title={OBSID_CA}>
            {OBSID_CA}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-mute sm:text-sm">CA dropping soon</span>
        )}
        <button
          type="button"
          onClick={onCopy}
          disabled={!OBSID_CA}
          aria-label="Copy contract address"
          className="shrink-0 rounded-full bg-ink px-4 py-2 font-label text-[10px] font-bold uppercase tracking-wider text-paper transition-colors hover:bg-lemon hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="mt-4">
        {OBSID_BUY_URL ? (
          <a
            href={OBSID_BUY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buyCls} hover:bg-ink hover:text-lemon hover:shadow-[0_10px_40px_-10px_rgba(212,255,58,0.9)] active:scale-[0.97]`}
          >
            BUY $OBSID
            <span className="transition-transform duration-300 group-hover:translate-x-1">↗</span>
          </a>
        ) : (
          <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <button type="button" disabled className={`${buyCls} cursor-not-allowed opacity-50`}>
              BUY $OBSID
            </button>
            <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">link coming soon</span>
          </div>
        )}
      </div>

      <Link
        href="/app/stake"
        className="mt-4 inline-block font-serif text-lg italic text-ink-soft underline decoration-lemon decoration-2 underline-offset-4 transition-colors hover:text-ink hover:decoration-4"
      >
        Stake $OBSID for guaranteed access to every sale.
      </Link>
    </div>
  );
}
