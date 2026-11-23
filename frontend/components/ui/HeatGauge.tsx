'use client';
import { motion } from 'framer-motion';
import type { Heat } from '@/lib/types';

const levels: Record<Heat, { pct: number; label: string; note: string }> = {
  cold: { pct: 0.14, label: 'Cold', note: 'Quiet so far' },
  warm: { pct: 0.42, label: 'Warm', note: 'Steady interest' },
  hot: { pct: 0.72, label: 'Hot', note: 'Strong demand' },
  'on fire': { pct: 0.96, label: 'On fire', note: 'Heavily contested' },
};

/** Shows demand intensity only. No bid prices or amounts are ever exposed. */
export default function HeatGauge({ heat, compact = false, className = '' }: { heat: Heat; compact?: boolean; className?: string }) {
  const l = levels[heat] ?? levels.cold;
  const segs = 12;
  const lit = Math.max(1, Math.round(l.pct * segs));
  return (
    <div className={`w-full ${className}`}>
      {!compact && (
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">Demand</span>
          <span className="font-serif text-lg italic leading-none text-ink">{l.note}</span>
        </div>
      )}
      <div className="flex items-end gap-[3px]">
        {Array.from({ length: segs }).map((_, i) => {
          const on = i < lit;
          const hgt = 8 + i * (compact ? 1.2 : 2);
          return (
            <motion.span
              key={i}
              initial={{ scaleY: 0, opacity: 0 }}
              whileInView={{ scaleY: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 20 }}
              style={{ height: hgt, originY: 1 }}
              className={`flex-1 rounded-[3px] ${on ? (i >= segs - 3 && heat === 'on fire' ? 'bg-ink' : 'bg-lemon ring-1 ring-ink/20') : 'bg-ink/10'}`}
            >
              {on && i === lit - 1 && (
                <motion.span className="block h-full w-full rounded-[3px] bg-lemon" animate={{ opacity: [1, 0.35, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />
              )}
            </motion.span>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-label text-xs font-extrabold uppercase tracking-wider text-ink">{l.label}</span>
        {!compact && <span className="font-body text-[11px] text-ink-mute">No bid data shown</span>}
      </div>
    </div>
  );
}
