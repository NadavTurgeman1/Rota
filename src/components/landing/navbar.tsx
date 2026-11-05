"use client";

import { useEffect, useState } from "react";
import { landingConfig as config } from "../../landing/config";
import { Logo } from "../login-screen";

export function useLandingTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("rota.theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(saved === "dark" || (saved !== "light" && prefersDark) ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("rota.theme", theme);
  }, [theme]);

  return {
    theme: theme ?? "light",
    toggle() {
      setTheme((current) => (current === "dark" ? "light" : "dark"));
    },
  };
}

function ThemeButton({ theme, onToggle }: { theme: "light" | "dark"; onToggle: () => void }) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card text-ink"
      aria-label={dark ? config.themeLight : config.themeDark}
      onClick={onToggle}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export function Navbar({ theme, onToggle }: { theme: "light" | "dark"; onToggle: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line material-bar">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-5 sm:gap-3">
        <a href="#top" className="shrink-0 rounded-md" aria-label={config.name}>
          <Logo className="h-6 sm:h-7" />
        </a>
        <nav className="ms-4 hidden items-center gap-5 md:flex" aria-label={config.navLabel}>
          {config.nav.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-medium text-muted hover:text-ink">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <ThemeButton theme={theme} onToggle={onToggle} />
          <a href={config.loginUrl} className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-line bg-card px-2.5 text-xs font-semibold text-ink hover:bg-well sm:px-4 sm:text-sm">
            {config.loginLabel}
          </a>
          <a href={config.startUrl} className="hidden h-10 items-center justify-center rounded-full bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-hover sm:inline-flex">
            {config.startLabel}
          </a>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card text-ink md:hidden"
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? config.menuClose : config.menuOpen}
            onClick={() => setOpen((current) => !current)}
          >
            <MenuIcon open={open} />
          </button>
        </div>
      </div>
      {open ? (
        <nav id="landing-menu" aria-label={config.navLabel} className="border-t border-line px-5 py-4 md:hidden">
          <ul className="flex flex-col gap-1">
            {config.nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="flex h-11 items-center rounded-lg px-2 text-sm font-medium text-ink hover:bg-well" onClick={() => setOpen(false)}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <a href={config.startUrl} className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand">
            {config.startLabel}
          </a>
        </nav>
      ) : null}
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.75]">
      {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.75]">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.75]">
      <path d="M15 3.5A8.5 8.5 0 1 0 20.5 14 7 7 0 0 1 15 3.5Z" />
    </svg>
  );
}
