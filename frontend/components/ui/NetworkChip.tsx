export default function NetworkChip({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full bg-paper/80 px-3 py-1.5 font-label text-[11px] font-bold uppercase tracking-wider text-ink ring-1 ring-ink/10 backdrop-blur ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {compact ? 'BSC Mainnet' : 'BNB Smart Chain Mainnet'}
    </span>
  );
}
