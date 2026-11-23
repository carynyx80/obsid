'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useRole } from '@/lib/role';

export default function PrivateSeal() {
  const { role } = useRole();
  return (
    <AnimatePresence>
      {role === 'buyer' && (
        <motion.div
          initial={{ scale: 0, rotate: -40, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0, rotate: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="pointer-events-none fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6"
          aria-label="Private mode on"
        >
          <div className="relative grid h-20 w-20 place-items-center sm:h-24 sm:w-24">
            <motion.svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}>
              <defs><path id="sealpath" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" /></defs>
              <circle cx="50" cy="50" r="49" fill="#D4FF3A" stroke="#0B0F05" strokeWidth="1.5" />
              <text fontSize="9.5" letterSpacing="2.4" fill="#0B0F05" style={{ fontFamily: 'var(--f-label)', fontWeight: 800 }}>
                <textPath href="#sealpath">PRIVATE • SEALED • YOURS ONLY • </textPath>
              </text>
            </motion.svg>
            <svg viewBox="0 0 24 24" className="relative h-7 w-7 sm:h-8 sm:w-8" fill="none" stroke="#0B0F05" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
