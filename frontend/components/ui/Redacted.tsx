'use client';
import { useState, type ReactNode } from 'react';

/** Wraps a private number. When active (buyer mode), renders a redaction bar that reveals on hover, focus or tap. */
export default function Redacted({ children, active = true, className = '' }: { children: ReactNode; active?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!active) return <span className={className}>{children}</span>;
  return (
    <span
      tabIndex={0}
      role="button"
      aria-label="Private value, tap to reveal"
      onClick={() => setOpen((o) => !o)}
      onBlur={() => setOpen(false)}
      className={`redact px-1 ${open ? '!bg-transparent !text-inherit' : ''} ${className}`}
      style={open ? { color: 'inherit' } : undefined}
    >
      {children}
    </span>
  );
}
