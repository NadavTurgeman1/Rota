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
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await App.addListener("backButton", () => {
      if (window.history.length > 1) window.history.back();
    });
  })().catch(() => undefined);
}
