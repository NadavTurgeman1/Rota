/** True only inside the installed iOS or Android app. The website stays false. */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Matches the status bar to the current theme. No-op in the browser. */
export function syncNativeStatusBar(): void {
  void (async () => {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    const dark = document.documentElement.classList.contains("dark");
    const inShell = Boolean(document.querySelector(".shell"));
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? "#0c0c0e" : inShell ? "#f5f5f6" : "#f4f0e6" });
  })().catch(() => undefined);
}

/** Native chrome for the Capacitor shell. No-op in the browser. */
export function startNativeChrome(): void {
  syncNativeStatusBar();
  void (async () => {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { App } = await import("@capacitor/app");
    await App.addListener("backButton", () => {
      if (window.history.length > 1) window.history.back();
    });
  })().catch(() => undefined);
}
