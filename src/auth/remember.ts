/** "1" keeps the session on this device. "0" keeps it only until the browser closes. Missing means on. */
export const REMEMBER_KEY = "rota.remember";
export const REMEMBER_EMAIL_KEY = "rota.remember.email";

export function rememberOn(stored: string | null): boolean {
  return stored !== "0";
}

/** Prefer the store that matches the choice, and still find a session saved the other way. */
export function readAuthItem(remember: boolean, localValue: string | null, sessionValue: string | null): string | null {
  if (remember) return localValue ?? sessionValue;
  return sessionValue ?? localValue;
}
