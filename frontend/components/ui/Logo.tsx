import Link from 'next/link';

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" aria-hidden="true" className={`inline-block h-[1.6em] w-[1.6em] shrink-0 ${className}`}>
      <rect width="400" height="400" rx="96" fill="#D4FF3A" />
      <circle cx="200" cy="200" r="104" fill="none" stroke="#0B0F05" strokeWidth="44" />
      <path d="M74 200 A126 126 0 0 0 326 200 Z" fill="#0B0F05" />
    </svg>
  );
}

export default function Logo({
  href = '/',
  className = '',
  size = 'md',
  markOnly = false,
}: {
  href?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  markOnly?: boolean;
}) {
  const s = size === 'lg' ? 'text-5xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  const dot = size === 'lg' ? 'h-4 w-4' : size === 'sm' ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5';
  return (
    <Link href={href} aria-label="Obsid home" className={`group inline-flex items-center gap-[0.35em] font-display font-extrabold tracking-tight text-ink ${s} ${className}`}>
      <LogoMark className="transition-transform duration-500 group-hover:rotate-[8deg]" />
      {!markOnly && (
        <span className="inline-flex items-end">
          <span>obsid</span>
          <span className={`mb-[0.18em] ml-[0.06em] inline-block rounded-full bg-lemon ring-1 ring-ink/80 transition-transform duration-500 group-hover:scale-150 ${dot}`} />
        </span>
      )}
    </Link>
  );
}
