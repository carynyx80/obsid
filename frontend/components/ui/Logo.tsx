import Link from 'next/link';

export default function Logo({ href = '/', className = '', size = 'md' }: { href?: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'text-5xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  const dot = size === 'lg' ? 'h-4 w-4' : size === 'sm' ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5';
  return (
    <Link href={href} aria-label="Obsid home" className={`group inline-flex items-end font-display font-extrabold tracking-tight text-ink ${s} ${className}`}>
      <span>obsid</span>
      <span className={`mb-[0.18em] ml-[0.06em] inline-block rounded-full bg-lemon ring-1 ring-ink/80 transition-transform duration-500 group-hover:scale-150 ${dot}`} />
    </Link>
  );
}
