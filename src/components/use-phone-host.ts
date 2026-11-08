"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** On a phone, moves one control cluster into the logo bar without a second copy. */
export function usePhoneHost(slotRef: RefObject<HTMLDivElement | null>): HTMLDivElement | null {
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setPhone(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useLayoutEffect(() => {
    const node = slotRef.current;
    setHost((current) => (current === node ? current : node));
  });

  return phone ? host : null;
}

export function usePhoneSlot() {
  const slotRef = useRef<HTMLDivElement>(null);
  const host = usePhoneHost(slotRef);
  return { slotRef, host };
}
