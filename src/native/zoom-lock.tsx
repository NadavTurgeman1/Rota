"use client";

import { useEffect } from "react";
import { isNativeApp } from "./chrome";

const VIEWPORT = "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

/** Stops pinch, double-tap, and focus zoom inside the installed app only. */
export function NativeZoomLock() {
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add("native-app");
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.setAttribute("content", VIEWPORT);

    const blockGesture = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener("gesturestart", blockGesture, { passive: false });
    document.addEventListener("gesturechange", blockGesture, { passive: false });
    document.addEventListener("gestureend", blockGesture, { passive: false });
    const blockWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };
    document.addEventListener("wheel", blockWheelZoom, { passive: false });
    return () => {
      document.documentElement.classList.remove("native-app");
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("gestureend", blockGesture);
      document.removeEventListener("wheel", blockWheelZoom);
    };
  }, []);
  return null;
}
