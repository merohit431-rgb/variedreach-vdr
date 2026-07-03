'use client';

import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';

// Marketing pages load framer-motion through LazyMotion so only the ~5KB
// dom-animation feature set ships instead of the full runtime. Every motion
// element on marketing surfaces must use `m.` (via this module), never
// `motion.` -- strict mode throws if the full component sneaks in.
export { m, useReducedMotion };
export { AnimatePresence } from 'framer-motion';

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </m.div>
  );
}
