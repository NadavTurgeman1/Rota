export const THEME_KEY = "rota.theme";
export const THEME_EXPLICIT_KEY = "rota.theme.explicit";

export type AppTheme = "light" | "dark";

/** The phone decides, unless the person picked light or dark in settings. */
export function resolvedTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  const explicit = window.localStorage.getItem(THEME_EXPLICIT_KEY) === "1";
  const saved = window.localStorage.getItem(THEME_KEY);
  if (explicit && (saved === "light" || saved === "dark")) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function rememberTheme(theme: AppTheme): void {
  window.localStorage.setItem(THEME_EXPLICIT_KEY, "1");
  window.localStorage.setItem(THEME_KEY, theme);
}
