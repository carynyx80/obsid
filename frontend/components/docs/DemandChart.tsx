/* Cumulative demand at each price tick versus fixed supply, for the worked example. */
const ticks = [
  { price: '0.00018', demand: 300 },
  { price: '0.00016', demand: 750 },
  { price: '0.00014', demand: 1250 },
  { price: '0.00012', demand: 1550 },
  { price: '0.00010', demand: 1750 },
];
const SUPPLY = 1000;
const MAX = 2000;

export default function DemandChart() {
  const W = 640;
  const H = 340;
  const padL = 56;
  const padR = 16;
  const padT = 24;
  const padB = 56;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const bw = innerW / ticks.length;
  const y = (v: number) => padT + innerH - (v / MAX) * innerH;
  const supplyY = y(SUPPLY);

  return (
    <figure className="my-8 overflow-hidden rounded-3xl border border-frost bg-paper p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-label text-xs font-bold uppercase tracking-[0.2em] text-ink-mute">Cumulative demand by price tick</p>
        <div className="flex flex-wrap gap-4 font-mono text-[10px] text-ink-soft">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink" />Above clearing</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-lemon ring-1 ring-ink" />Clearing tick</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-frost" />Below clearing</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bar chart of cumulative demand by price tick. Demand first reaches the one million token supply at 0.00014 BNB, which becomes the clearing price.">
        {[0, 500, 1000, 1500, 2000].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#E9EDE0" strokeWidth={1} />
            <text x={padL - 8} y={y(g) + 3} textAnchor="end" fontSize="10" fill="#7C8270" fontFamily="var(--f-mono)">
              {g === 0 ? '0' : `${g / 1000}M`}
            </text>
          </g>
        ))}
        {ticks.map((t, i) => {
          const x = padL + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const top = y(t.demand);
          const fill = i < 2 ? '#0B0F05' : i === 2 ? '#D4FF3A' : '#E9EDE0';
          return (
            <g key={t.price}>
              <rect x={x} y={top} width={w} height={padT + innerH - top} rx={8} fill={fill} stroke={i === 2 ? '#0B0F05' : 'none'} strokeWidth={1.5} />
              <text x={x + w / 2} y={top - 7} textAnchor="middle" fontSize="11" fontWeight={600} fill="#0B0F05" fontFamily="var(--f-mono)">
                {t.demand >= 1000 ? `${(t.demand / 1000).toFixed(2)}M` : `${t.demand}k`}
              </text>
              <text x={x + w / 2} y={H - padB + 20} textAnchor="middle" fontSize="10" fill="#3A4030" fontFamily="var(--f-mono)">
                {t.price}
              </text>
            </g>
          );
        })}
        <line x1={padL} x2={W - padR} y1={supplyY} y2={supplyY} stroke="#0B0F05" strokeWidth={2} strokeDasharray="6 5" />
        <rect x={W - padR - 128} y={supplyY - 22} width={128} height={18} rx={9} fill="#0B0F05" />
        <text x={W - padR - 64} y={supplyY - 9.5} textAnchor="middle" fontSize="10" fill="#D4FF3A" fontFamily="var(--f-mono)">
          Supply 1,000,000
        </text>
        <text x={padL + innerW / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="#7C8270" fontFamily="var(--f-label)" letterSpacing="2">
          PRICE PER TOKEN IN BNB, HIGH TO LOW
        </text>
      </svg>
      <figcaption className="mt-3 font-serif text-lg italic text-ink-mute">
        Walking down from the highest tick, demand first covers supply at 0.00014 BNB. That tick becomes the single clearing price.
      </figcaption>
    </figure>
  );
}
