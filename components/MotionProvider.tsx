"use client";

import { LazyMotion, domAnimation } from "framer-motion";

/**
 * Phase 6: loads framer-motion's lightweight DOM-animation feature pack once,
 * app-wide. Components use `m` instead of `motion`, so the full feature bundle
 * stays out of the initial JS. Anything that genuinely needs drag (calendar
 * sheets, the floating nudge button) keeps importing `motion` — with `strict`
 * off mixing is allowed and those heavier features load lazily.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict={false}>
      {children}
    </LazyMotion>
  );
}
