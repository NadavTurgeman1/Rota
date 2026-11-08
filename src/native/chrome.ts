/** Native chrome for the Capacitor shell. No-op in the browser. */
export function startNativeChrome(): void {
  void (async () => {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const [{ StatusBar, Style }, { App }] = await Promise.all([
      import("@capacitor/status-bar"),
      import("@capacitor/app"),
    ]);
    const dark = document.documentElement.classList.contains("dark");
    const inShell = Boolean(document.querySelector(".shell"));
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? "#0c0c0e" : inShell ? "#f5f5f6" : "#f4f0e6" });
    await App.addListener("backButton", () => {
      if (window.history.length > 1) window.history.back();
    });
  })().catch(() => undefined);
}
