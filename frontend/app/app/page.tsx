'use client';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Logo from '@/components/ui/Logo';
import ConnectWallet from '@/components/ui/ConnectWallet';
import NetworkChip from '@/components/ui/NetworkChip';
import { useRole, type Role } from '@/lib/role';

export default function SignIn() {
  const { setRole } = useRole();
  const router = useRouter();
  const choose = (r: Role) => { setRole(r); router.push('/app/menu'); };

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-3">
          <div className="hidden sm:block"><NetworkChip /></div>
          <ConnectWallet size="sm" />
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="font-label text-xs font-bold uppercase tracking-[0.3em] text-ink-mute">Step in</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="mt-3 font-display text-5xl font-extrabold leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
          Who are you <span className="font-serif font-normal italic">today?</span>
        </motion.h1>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {/* HOST */}
          <motion.button
            onClick={() => choose('host')}
            initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }}
            className="group relative flex min-h-[26rem] flex-col justify-between overflow-hidden rounded-[2.5rem] bg-lemon p-8 text-left sm:min-h-[32rem] sm:p-10"
          >
            <motion.div aria-hidden className="absolute -right-16 -top-16 h-72 w-72 sm:h-96 sm:w-96" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 40, ease: 'linear' }}>
              <svg viewBox="0 0 200 200" className="h-full w-full">
                {Array.from({ length: 24 }).map((_, i) => (
                  <rect key={i} x="98" y="4" width="4" height="34" rx="2" fill="#0B0F05" transform={`rotate(${i * 15} 100 100)`} />
                ))}
                <circle cx="100" cy="100" r="48" fill="#FFFFFF" stroke="#0B0F05" strokeWidth="3" />
              </svg>
            </motion.div>
            <span className="relative w-fit rounded-full bg-ink px-3 py-1.5 font-label text-[11px] font-extrabold uppercase tracking-wider text-lemon">Public mode</span>
            <div className="relative">
              <h2 className="font-display text-6xl font-extrabold tracking-tight sm:text-8xl">Host</h2>
              <p className="mt-2 font-serif text-2xl italic sm:text-3xl">Out in the open.</p>
              <p className="mt-4 max-w-sm font-body text-ink-soft">Launch an ICO, IDO or presale. Your profile, terms, team and totals are fully public, so buyers can trust what they see.</p>
              <span className="mt-8 inline-flex items-center gap-3 font-label text-sm font-extrabold uppercase tracking-wider">
                Enter as host <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-lemon transition-transform duration-300 group-hover:translate-x-2">→</span>
              </span>
            </div>
          </motion.button>

          {/* BUYER */}
          <motion.button
            onClick={() => choose('buyer')}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }}
            className="group relative flex min-h-[26rem] flex-col justify-between overflow-hidden rounded-[2.5rem] bg-frost p-8 text-left ring-1 ring-ink/5 sm:min-h-[32rem] sm:p-10"
          >
            <div aria-hidden className="absolute inset-0">
              <motion.div className="absolute right-6 top-8 h-56 w-56 rounded-full bg-lemon sm:h-72 sm:w-72" animate={{ x: [0, -30, 0], y: [0, 20, 0] }} transition={{ repeat: Infinity, duration: 9, ease: 'easeInOut' }} />
              <motion.div className="absolute right-32 top-32 h-40 w-40 rounded-full bg-ink sm:h-52 sm:w-52" animate={{ x: [0, 24, 0], y: [0, -16, 0] }} transition={{ repeat: Infinity, duration: 11, ease: 'easeInOut' }} />
              <div className="absolute inset-0 bg-white/40 backdrop-blur-2xl" />
              <div className="absolute right-8 top-24 space-y-3 sm:right-12">
                {[28, 20, 32].map((w, i) => <div key={i} className="h-4 rounded bg-ink/80" style={{ width: `${w * 4}px` }} />)}
              </div>
            </div>
            <span className="relative w-fit rounded-full bg-paper px-3 py-1.5 font-label text-[11px] font-extrabold uppercase tracking-wider text-ink ring-1 ring-ink/10">Private mode</span>
            <div className="relative">
              <h2 className="font-display text-6xl font-extrabold tracking-tight sm:text-8xl">Buyer</h2>
              <p className="mt-2 font-serif text-2xl italic sm:text-3xl">Behind frosted glass.</p>
              <p className="mt-4 max-w-sm font-body text-ink-soft">Place sealed bids that nobody can read. Your prices, amounts and allocations stay redacted, even on your own screen, until you tap to peek.</p>
              <span className="mt-8 inline-flex items-center gap-3 font-label text-sm font-extrabold uppercase tracking-wider">
                Enter as buyer <span className="grid h-10 w-10 place-items-center rounded-full bg-lemon text-ink ring-1 ring-ink/20 transition-transform duration-300 group-hover:translate-x-2">→</span>
              </span>
            </div>
          </motion.button>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <span className="font-body text-sm text-ink-mute">You can switch roles anytime. Connect now or later.</span>
          <ConnectWallet />
        </motion.div>
      </div>
    </div>
  );
}
