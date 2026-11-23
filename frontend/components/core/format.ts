import type { Sale, SaleStatus } from '@/lib/types';
export const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { maximumFractionDigits: d });
export const statusLabel: Record<SaleStatus, string> = { upcoming: 'Upcoming', bidding: 'Bidding open', reveal: 'Reveal phase', settled: 'Settled', failed: 'Refunding' };
export const statusCls: Record<SaleStatus, string> = {
  upcoming: 'bg-paper text-ink ring-1 ring-ink/15',
  bidding: 'bg-lemon text-ink ring-1 ring-ink/20',
  reveal: 'bg-ink text-lemon',
  settled: 'bg-chalk text-ink-soft ring-1 ring-ink/10',
  failed: 'bg-red-100 text-red-800',
};
export const countdownTarget = (s: Sale) => (s.status === 'upcoming' ? s.start : s.status === 'bidding' ? s.end : s.status === 'reveal' ? s.revealEnd : null);
export const countdownLabel = (s: Sale) => (s.status === 'upcoming' ? 'Opens in' : s.status === 'bidding' ? 'Bidding closes in' : s.status === 'reveal' ? 'Reveal ends in' : 'Closed');
export const typeLabel = { ICO: 'ICO', IDO: 'IDO', PRESALE: 'Presale', IPO: 'IPO' } as const;
