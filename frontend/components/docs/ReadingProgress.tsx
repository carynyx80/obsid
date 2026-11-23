'use client';
import { motion, useScroll, useSpring } from 'framer-motion';

export default function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-1.5 origin-left bg-lemon shadow-[0_0_12px_rgba(212,255,58,0.8)]"
      style={{ scaleX }}
    />
  );
}
