'use client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useRole } from '@/lib/role';
import Logo from './Logo';
import NetworkChip from './NetworkChip';
import ConnectWallet from './ConnectWallet';
import PrivateSeal from './PrivateSeal';

export function RoleBadge() {
  const { role } = useRole();
  if (!role) return null;
  const buyer = role === 'buyer';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-label text-[11px] font-extrabold uppercase tracking-wider ${buyer ? 'bg-ink text-lemon' : 'bg-lemon text-ink ring-1 ring-ink/20'}`}>
      {buyer ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      )}
      <span className="hidden sm:inline">{buyer ? 'Buyer · private' : 'Host · public'}</span><span className="sm:hidden">{buyer ? 'Buyer' : 'Host'}</span>
    </span>
  );
}

export default function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { role, setRole } = useRole();
  const router = useRouter();
  const buyer = role === 'buyer';
  const switchRole = () => { setRole(null); router.push('/app'); };

  return (
    <div className={`relative min-h-screen transition-colors duration-700 ${buyer ? 'private-mode' : 'bg-paper'}`}>
      {buyer && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-lemon/30 blur-3xl" />
          <div className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-white/70 blur-3xl" />
        </div>
      )}
      <header className={`sticky top-0 z-40 border-b ${buyer ? 'border-white/60 bg-white/40' : 'border-ink/5 bg-paper/80'} backdrop-blur-xl`}>
        <div className={`mx-auto flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 ${wide ? 'max-w-[1600px]' : 'max-w-7xl'}`}>
          <Logo href="/app/menu" size="sm" className="sm:text-2xl" />
          <RoleBadge />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:block"><NetworkChip /></div>
            {role && (
              <button onClick={switchRole} aria-label="Switch role" className="font-label text-[11px] font-bold uppercase tracking-wider text-ink/70 underline decoration-lemon decoration-2 underline-offset-4 hover:text-ink">
                <span className="hidden sm:inline">Switch role</span><span className="sm:hidden">Switch</span>
              </button>
            )}
            <ConnectWallet size="sm" />
          </div>
        </div>
      </header>
      <motion.main
        key={role ?? 'none'}
        initial={{ opacity: 0, y: 12, filter: buyer ? 'blur(8px)' : 'blur(0px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10"
      >
        {children}
      </motion.main>
      <PrivateSeal />
    </div>
  );
}
