import { Unbounded, Instrument_Serif, Bricolage_Grotesque, Martian_Mono, Syne } from 'next/font/google';
export const display = Unbounded({ subsets: ['latin'], variable: '--f-display', weight: ['400', '600', '800'] });
export const serif = Instrument_Serif({ subsets: ['latin'], variable: '--f-serif', weight: '400', style: ['normal', 'italic'] });
export const body = Bricolage_Grotesque({ subsets: ['latin'], variable: '--f-body' });
export const mono = Martian_Mono({ subsets: ['latin'], variable: '--f-mono' });
export const label = Syne({ subsets: ['latin'], variable: '--f-label', weight: ['500', '700', '800'] });
export const fontVars = [display.variable, serif.variable, body.variable, mono.variable, label.variable].join(' ');
