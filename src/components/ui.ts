/** Shared Tailwind class sets. Sizes stay on the 4px grid: controls are 32, 36 or 40px tall. */

const control = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium disabled:cursor-not-allowed disabled:opacity-50";

export const button = {
  primary: `${control} h-9 rounded-xl bg-brand px-4 text-sm text-on-brand shadow-card hover:bg-brand-hover disabled:hover:bg-brand`,
  quiet: `${control} h-9 rounded-xl border border-line bg-card px-4 text-sm text-ink shadow-card hover:border-field-line hover:bg-well disabled:hover:border-line disabled:hover:bg-card`,
  danger: `${control} h-9 rounded-xl border border-danger-line bg-card px-4 text-sm text-danger-text hover:bg-danger-softer disabled:hover:bg-card`,
  small: `${control} h-8 rounded-lg border border-line bg-card px-3 text-xs text-ink hover:border-field-line hover:bg-well`,
  icon: `${control} h-9 w-9 rounded-xl border border-line bg-card text-ink-soft shadow-card hover:border-field-line hover:bg-well hover:text-ink`,
  /** A filled action inside a list, such as approving a proposal. */
  action: "w-full rounded-lg bg-brand px-3 py-2 text-start text-xs font-medium leading-5 text-on-brand hover:bg-brand-hover",
};

export const field =
  "h-10 w-full min-w-0 rounded-xl border border-field-line bg-card px-3 text-sm text-ink placeholder:text-subtle hover:border-muted read-only:border-line read-only:bg-well read-only:hover:border-line";

export const select = `${field} pe-8`;

export const surface = "rounded-2xl border border-line bg-card shadow-card";

export const card = `${surface} p-4 sm:p-6`;

export const cardTitle = "text-base font-semibold tracking-tight text-ink";

export const cardHint = "mt-1 text-sm leading-6 text-muted";

export const label = "flex flex-col gap-1.5 text-sm";

export const labelText = "font-medium text-ink-soft";

export const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
