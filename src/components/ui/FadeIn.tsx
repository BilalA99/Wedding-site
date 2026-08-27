'use client';

import { motion, HTMLMotionProps, useInView } from 'framer-motion';
import { ReactNode, useRef } from 'react';
import { useOpacitySettle } from '@/hooks/useOpacitySettle';

interface FadeInProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  delay?: number;
  duration?: number;
}

export default function FadeIn({
  children,
  delay = 0,
  duration = 0.8,
  className = "",
  ...props
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  useOpacitySettle(ref, isInView, (delay + duration) * 1000 + 700);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
