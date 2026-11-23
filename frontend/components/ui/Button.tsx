'use client';
import Link from 'next/link';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

type Variant = 'lemon' | 'ink' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const base = 'group relative inline-flex items-center justify-center gap-2 rounded-full font-label font-bold tracking-wide uppercase transition-all duration-300 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap';
const variants: Record<Variant, string> = {
  lemon: 'bg-lemon text-ink hover:bg-ink hover:text-lemon shadow-[0_0_0_0_rgba(212,255,58,0)] hover:shadow-[0_10px_40px_-10px_rgba(212,255,58,0.9)]',
  ink: 'bg-ink text-paper hover:bg-lemon hover:text-ink',
  ghost: 'bg-transparent text-ink ring-1 ring-ink/20 hover:ring-ink hover:bg-ink/5',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[11px]',
  md: 'h-12 px-6 text-xs',
  lg: 'h-16 px-9 text-sm',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  size?: Size;
  href?: string;
  external?: boolean;
  children: ReactNode;
  className?: string;
}

export default function Button({ variant = 'lemon', size = 'md', href, external, children, className = '', ...rest }: ButtonProps) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  if (href) {
    if (external) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>;
    return <Link href={href} className={cls}>{children}</Link>;
  }
  return <button className={cls} {...rest}>{children}</button>;
}
