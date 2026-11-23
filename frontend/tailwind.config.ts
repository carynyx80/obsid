import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FFFFFF',
        chalk: '#F6F8EF',
        lemon: { DEFAULT: '#D4FF3A', deep: '#B8E600', soft: '#F1FFC2' },
        ink: { DEFAULT: '#0B0F05', soft: '#3A4030', mute: '#7C8270' },
        frost: '#E9EDE0',
      },
      fontFamily: {
        display: ['var(--f-display)'],   // Unbounded: big headlines
        serif: ['var(--f-serif)'],       // Instrument Serif: editorial accents
        body: ['var(--f-body)'],         // Bricolage Grotesque: paragraphs
        mono: ['var(--f-mono)'],         // Martian Mono: numbers, addresses
        label: ['var(--f-label)'],       // Syne: buttons, tags, nav
      },
      borderRadius: { blob: '2.5rem' },
    },
  },
  plugins: [],
};
export default config;
