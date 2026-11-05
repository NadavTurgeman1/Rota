"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** 600ms rise. Stagger stays at 80ms and never stacks past 480ms. */
export const REVEAL_MS = 600;
export const REVEAL_STAGGER_MS = 80;
export const REVEAL_STAGGER_CAP_MS = 480;
export const REVEAL_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function revealDelay(index: number): number {
  return Math.min(index * REVEAL_STAGGER_MS, REVEAL_STAGGER_CAP_MS);
}

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`landing-reveal ${shown ? "is-in" : ""} ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
