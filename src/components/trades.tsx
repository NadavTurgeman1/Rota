import { useEffect, useState, type ReactNode } from "react";
import { dayName, seatProblem, type Lang, type RotaState, type TradeKind, type TradeSeat } from "../domain";
import type { ShiftTrade } from "../db/trades";
import { copy } from "../i18n/copy";
import { formatDayDate, shiftLabel, siteLabel } from "../schedule/display";
import { hoursSinceWeek } from "../schedule/edit";
import { hebrewWeek } from "../schedule/hebrew-calendar";
import { DayDates, useHebrewCalendar } from "./day-dates";
import { button, card, cardTitle, pill } from "./ui";

export type { ShiftTrade };

export interface TradeSite {
  id: string;
  name: string;
  state: RotaState;
}

/** Every call resolves to an error code, or null when it worked. */
export interface TradeApi {
  options: (siteId: string, week: string, slotKey: string) => Promise<TradeSeat[] | string>;
  create: (input: { siteId: string; week: string; kind: TradeKind; slotKey: string; target?: TradeSeat }) => Promise<string | null>;
  answer: (tradeId: string, accept: boolean) => Promise<string | null>;
  cancel: (tradeId: string) => Promise<string | null>;
}

const LATER_KEY = "rota.trades.later";
const DISMISSED_KEY = "rota.trades.dismissed";

function readIds(storage: Storage | undefined, key: string): string[] {
  try {
    const parsed = JSON.parse(storage?.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(storage: Storage | undefined, key: string, ids: string[]) {
  storage?.setItem(key, JSON.stringify(ids.slice(-200)));
}

/** Ids put aside for this session, or for good. Read after mount so the server render matches. */
export function useSetAside(key: "later" | "dismissed") {
  const [ids, setIds] = useState<string[]>([]);
  const storageKey = key === "later" ? LATER_KEY : DISMISSED_KEY;
  const storage = () => (typeof window === "undefined" ? undefined : key === "later" ? window.sessionStorage : window.localStorage);
  useEffect(() => {
    setIds(readIds(storage(), storageKey));
  }, []);
  return {
    ids,
    add(id: string) {
      setIds((current) => {
        const next = current.includes(id) ? current : [...current, id];
        writeIds(storage(), storageKey, next);
        return next;
      });
    },
    clear() {
      setIds([]);
      writeIds(storage(), storageKey, []);
    },
  };
}

function seatToken(seat: TradeSeat): string {
  return `${seat.slotKey}#${seat.employeeId}`;
}

function slotParts(slotKey: string): { day: number; shiftId: string } {
  const [day, shiftId] = slotKey.split("|");
  return { day: Number(day), shiftId: shiftId ?? "" };
}

export function personName(state: RotaState | undefined, employeeId: string | null): string {
  return (employeeId && state?.emps.find((item) => item.id === employeeId)?.name) || "—";
}

export function tradeError(lang: Lang, code: string): string {
  const errors = copy[lang].tradeError;
  return code in errors ? errors[code as keyof typeof errors] : errors.failed;
}

/** False once the week no longer shows the seats as the request described them. */
export function tradeStillHeld(trade: ShiftTrade, sites: TradeSite[]): boolean {
  const site = sites.find((item) => item.id === trade.siteId);
  const schedule = site?.state.sched[trade.week];
  if (!schedule) return true;
  const holds = (slotKey: string | null, employeeId: string | null) => !slotKey || !employeeId || (schedule.assign[slotKey] ?? []).includes(employeeId);
  return holds(trade.slotKey, trade.requesterId) && (trade.kind !== "swap" || holds(trade.targetSlotKey, trade.targetId));
}

function SeatBox({ state, week, lang, name, slotKey, highlight }: { state: RotaState; week: string; lang: Lang; name: string; slotKey: string | null; highlight?: boolean }) {
  const hebrew = useHebrewCalendar();
  const slot = slotKey ? slotParts(slotKey) : null;
  const shift = slot ? state.biz.shifts.find((item) => item.id === slot.shiftId) : null;
  return (
    <div className={`min-w-0 flex-1 rounded-xl border p-3 text-center ${highlight ? "border-brand bg-brand-soft" : "border-line bg-well"}`}>
      <p className="truncate font-semibold text-ink">{name}</p>
      {slot && shift ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            {dayName(slot.day, lang)} · {formatDayDate(week, slot.day, lang)}
          </p>
          {hebrew ? <p className="text-[11px] text-muted">{hebrewWeek(week, lang)[slot.day].hebrew}</p> : null}
          <p className="text-sm text-muted">
            {shiftLabel(shift.name, lang)} ·{" "}
            <span dir="ltr">
              {shift.start}–{shift.end}
            </span>
          </p>
        </>
      ) : null}
    </div>
  );
}

/** The requester's seat on one side and the other person, with their seat for a swap, on the other. */
export function TradeCard({
  state,
  lang,
  kind,
  week,
  from,
  to,
  takerId,
}: {
  state: RotaState;
  lang: Lang;
  kind: TradeKind;
  week: string;
  from: TradeSeat;
  to?: TradeSeat | null;
  takerId?: string | null;
}) {
  const t = copy[lang];
  const arrow = kind === "swap" ? "⇄" : lang === "he" ? "←" : "→";
  const otherId = kind === "swap" ? (to?.employeeId ?? null) : (takerId ?? null);
  return (
    <div data-testid="trade-card" className="flex items-stretch gap-2">
      <SeatBox state={state} week={week} lang={lang} name={personName(state, from.employeeId)} slotKey={from.slotKey} />
      <span aria-hidden className="grid shrink-0 place-items-center px-1 text-2xl font-semibold text-brand-text">
        {arrow}
      </span>
      <SeatBox
        state={state}
        week={week}
        lang={lang}
        name={otherId ? personName(state, otherId) : t.tradeAnyone}
        slotKey={kind === "swap" ? (to?.slotKey ?? null) : null}
        highlight={kind === "giveaway" && !otherId}
      />
    </div>
  );
}

export interface PromptAction {
  label: string;
  tone: "primary" | "quiet" | "danger";
  testId: string;
  run: () => Promise<string | null> | void;
}

/** A blocking request card. An action that resolves to an error code keeps it open and shows why. */
export function TradePrompt({ title, note, lang, testId, children, actions }: { title: string; note?: string; lang: Lang; testId: string; children: ReactNode; actions: PromptAction[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={`${testId}-title`} data-testid={testId} className={`${card} w-full max-w-lg`}>
        <h2 id={`${testId}-title`} className={cardTitle}>
          {title}
        </h2>
        {note ? <p className="mt-1 text-sm leading-6 text-muted">{note}</p> : null}
        <div className="mt-4">{children}</div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger-text">
            {tradeError(lang, error)}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.testId}
              type="button"
              data-testid={action.testId}
              className={button[action.tone]}
              disabled={busy}
              onClick={() => {
                const pending = action.run();
                if (!pending) return;
                setBusy(true);
                setError(null);
                void pending.then((code) => {
                  setBusy(false);
                  if (code) setError(code);
                });
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The published week as clickable seats. Only `pickable` seats respond, and `visible` hides the rest. */
function SeatGrid({
  state,
  week,
  lang,
  selfId,
  picked,
  pickable,
  visible,
  onPick,
}: {
  state: RotaState;
  week: string;
  lang: Lang;
  selfId: string;
  picked: string[];
  pickable: (seat: TradeSeat) => boolean;
  visible?: (seat: TradeSeat) => boolean;
  onPick: (seat: TradeSeat) => void;
}) {
  const schedule = state.sched[week];
  const days = [0, 1, 2, 3, 4, 5, 6];
  const shown = (slotKey: string, employeeId: string) => !visible || visible({ slotKey, employeeId });
  const shifts = state.biz.shifts.filter((shift) =>
    days.some((day) => {
      const slotKey = `${day}|${shift.id}`;
      const people = schedule?.assign[slotKey] ?? [];
      if (visible) return people.some((employeeId) => shown(slotKey, employeeId));
      return Number(shift.req[day] || 0) > 0 || people.length > 0;
    }),
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-well">
            <th className="w-24 p-2 text-start text-xs font-medium text-muted" />
            {days.map((day) => (
              <th key={day} className="p-2 text-center align-top text-xs font-medium text-ink-soft">
                <span className="block">{dayName(day, lang)}</span>
                <DayDates week={week} day={day} lang={lang} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shifts.map((shift) => (
            <tr key={shift.id} className="border-t border-line">
              <th className="p-2 text-start align-top text-xs font-medium text-ink-soft">
                <span className="block">{shiftLabel(shift.name, lang)}</span>
                <span dir="ltr" className="block text-muted">
                  {shift.start}–{shift.end}
                </span>
              </th>
              {days.map((day) => {
                const slotKey = `${day}|${shift.id}`;
                const people = (schedule?.assign[slotKey] ?? []).filter((employeeId) => shown(slotKey, employeeId));
                return (
                  <td key={day} className="border-s border-line p-1.5 align-top">
                    <div className="flex flex-col gap-1">
                      {people.map((employeeId) => {
                        const seat = { slotKey, employeeId };
                        const token = seatToken(seat);
                        const chosen = picked.includes(token);
                        const open = !chosen && pickable(seat);
                        const tone = chosen
                          ? "bg-brand text-on-brand ring-2 ring-brand ring-offset-1 ring-offset-card"
                          : open
                            ? "cursor-pointer bg-brand-soft text-brand-text hover:ring-2 hover:ring-brand"
                            : "bg-well text-subtle";
                        return (
                          <button
                            key={token}
                            type="button"
                            data-testid={`trade-seat-${token}`}
                            data-pickable={open || chosen ? "true" : "false"}
                            aria-pressed={chosen}
                            disabled={!open && !chosen}
                            className={`truncate rounded-lg px-2 py-1 text-xs ${employeeId === selfId ? "font-semibold" : "font-medium"} ${tone} disabled:cursor-default`}
                            onClick={() => onPick(seat)}
                          >
                            {personName(state, employeeId)}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pick my seat, then (for a swap) a colleague's seat the server says fits every rule, then send. */
function TradeComposer({
  kind,
  lang,
  selfId,
  week,
  sites,
  busySeats,
  api,
  onClose,
}: {
  kind: TradeKind;
  lang: Lang;
  selfId: string;
  week: string;
  sites: TradeSite[];
  busySeats: Set<string>;
  api: TradeApi;
  onClose: () => void;
}) {
  const t = copy[lang];
  const [siteId, setSiteId] = useState<string | null>(null);
  const [mine, setMine] = useState<TradeSeat | null>(null);
  const [targets, setTargets] = useState<TradeSeat[] | "loading" | null>(null);
  const [target, setTarget] = useState<TradeSeat | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nowHours = hoursSinceWeek(week, new Date());
  const shown = siteId ? sites.filter((site) => site.id === siteId) : sites;
  const anyMine = sites.some((site) =>
    Object.entries(site.state.sched[week]?.assign ?? {}).some(([slotKey, people]) => people.includes(selfId) && !seatProblem({ ...site.state, week }, week, { slotKey, employeeId: selfId }, nowHours)),
  );

  function reset() {
    setSiteId(null);
    setMine(null);
    setTargets(null);
    setTarget(null);
    setError(null);
  }

  function pickMine(site: TradeSite, seat: TradeSeat) {
    if (mine && seatToken(mine) === seatToken(seat)) {
      reset();
      return;
    }
    setSiteId(site.id);
    setMine(seat);
    setTarget(null);
    setError(null);
    if (kind !== "swap") return;
    setTargets("loading");
    void api.options(site.id, week, seat.slotKey).then((result) => {
      if (typeof result === "string") {
        setError(result);
        setTargets([]);
        return;
      }
      setTargets(result);
    });
  }

  const ready = Boolean(mine && siteId && (kind === "giveaway" || target));
  const site = siteId ? sites.find((item) => item.id === siteId) : null;
  const hint = !mine ? (kind === "swap" ? t.tradePickMine : t.tradePickGiveaway) : kind === "swap" && !target ? t.tradePickTarget : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="trade-composer-title" data-testid="trade-composer" data-kind={kind} className={`${card} mx-auto my-6 w-full max-w-5xl`}>
        <div className="flex items-start gap-3">
          <h2 id="trade-composer-title" className={cardTitle}>
            {kind === "swap" ? t.tradeSwap : t.tradeGiveaway}
          </h2>
          <button type="button" className={`${button.small} ms-auto`} onClick={onClose}>
            {t.tradeClose}
          </button>
        </div>
        {!anyMine ? (
          <p className="mt-2 text-sm leading-6 text-ink">{t.tradeNoSeats}</p>
        ) : hint ? (
          <p className="mt-2 text-sm leading-6 text-muted">{hint}</p>
        ) : null}
        {targets === "loading" ? <p className="mt-2 text-sm text-muted">{t.tradeChecking}</p> : null}
        {Array.isArray(targets) && targets.length === 0 && !error ? (
          <p role="alert" className="mt-2 text-sm font-medium text-ink">
            {t.tradeNoTargets}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-4">
          {shown.map((item) => {
            const view = { ...item.state, week };
            const options = new Set(Array.isArray(targets) ? targets.map(seatToken) : []);
            const ownSeat = (seat: TradeSeat) =>
              seat.employeeId === selfId && !busySeats.has(`${item.id}|${seat.slotKey}`) && !seatProblem(view, week, seat, nowHours);
            const swapVisible = (seat: TradeSeat) => {
              if (!mine) return ownSeat(seat);
              if (seatToken(seat) === seatToken(mine)) return true;
              return options.has(seatToken(seat));
            };
            const visible = kind === "swap" ? swapVisible : ownSeat;
            if (!Object.entries(view.sched[week]?.assign ?? {}).some(([slotKey, people]) => people.some((employeeId) => visible({ slotKey, employeeId })))) {
              return null;
            }
            return (
              <section key={item.id} className="flex flex-col gap-2">
                {sites.length > 1 ? <h3 className="text-sm font-semibold text-ink">{siteLabel(item.name, lang)}</h3> : null}
                <SeatGrid
                  state={view}
                  week={week}
                  lang={lang}
                  selfId={selfId}
                  picked={[mine, target].filter((seat): seat is TradeSeat => Boolean(seat)).map(seatToken)}
                  visible={visible}
                  pickable={(seat) => {
                    if (!mine) return ownSeat(seat);
                    if (kind !== "swap" || seat.employeeId === selfId) return false;
                    return options.has(seatToken(seat));
                  }}
                  onPick={(seat) => {
                    if (seat.employeeId === selfId) pickMine(item, seat);
                    else setTarget(target && seatToken(target) === seatToken(seat) ? null : seat);
                  }}
                />
              </section>
            );
          })}
        </div>
        {ready && mine && site ? (
          <div className="mt-4">
            <TradeCard state={{ ...site.state, week }} lang={lang} kind={kind} week={week} from={mine} to={target} />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger-text">
            {tradeError(lang, error)}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="trade-send"
            className={button.primary}
            disabled={!ready || busy}
            onClick={() => {
              if (!mine || !siteId) return;
              setBusy(true);
              setError(null);
              void api.create({ siteId, week, kind, slotKey: mine.slotKey, target: target ?? undefined }).then((code) => {
                setBusy(false);
                if (code) setError(code);
                else onClose();
              });
            }}
          >
            {kind === "swap" ? t.tradeSend : t.tradeOffer}
          </button>
          {mine ? (
            <button type="button" className={button.quiet} disabled={busy} onClick={reset}>
              {t.tradeBack}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function statusTone(status: ShiftTrade["status"]): string {
  if (status === "approved") return "bg-ok-soft text-ok-text";
  if (status === "rejected" || status === "declined") return "bg-danger-soft text-danger-text";
  if (status === "cancelled") return "bg-well text-muted";
  return "bg-warn-soft text-warn-text";
}

/**
 * The employee's side of swaps and giveaways: the two request buttons, their open and recent
 * requests, and the prompts for a swap someone asked of them or a giveaway they could take.
 */
export function StaffTrades({
  lang,
  selfId,
  week,
  sites,
  trades,
  takeable,
  panel,
  quiet,
  api,
}: {
  lang: Lang;
  selfId: string;
  week: string;
  sites: TradeSite[];
  trades: ShiftTrade[];
  takeable: string[];
  /** Show the buttons and the list. Prompts show either way. */
  panel: boolean;
  /** Another prompt is up, so hold ours back. */
  quiet: boolean;
  api: TradeApi;
}) {
  const t = copy[lang];
  const [composing, setComposing] = useState<TradeKind | null>(null);
  const later = useSetAside("later");
  const dismissed = useSetAside("dismissed");
  const [rowError, setRowError] = useState<{ id: string; code: string } | null>(null);
  const published = sites.filter((site) => site.state.sched[week]?.status === "published");
  const live = trades.filter((trade) => tradeStillHeld(trade, sites));
  const busySeats = new Set(
    live.filter((trade) => trade.requesterId === selfId && (trade.status === "open" || trade.status === "accepted")).map((trade) => `${trade.siteId}|${trade.slotKey}`),
  );
  const incoming = live.find((trade) => trade.kind === "swap" && trade.status === "open" && trade.targetId === selfId && !later.ids.includes(trade.id));
  const offer = live.find(
    (trade) => trade.kind === "giveaway" && trade.status === "open" && trade.requesterId !== selfId && takeable.includes(trade.id) && !later.ids.includes(trade.id) && !dismissed.ids.includes(trade.id),
  );
  const prompt = quiet || composing ? null : (incoming ?? offer ?? null);
  const promptSite = prompt ? sites.find((site) => site.id === prompt.siteId) : null;
  const own = trades
    .filter((trade) => trade.requesterId === selfId || trade.targetId === selfId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 10);

  return (
    <>
      {panel ? (
        <section data-testid="staff-trades" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-testid="trade-swap" className={button.quiet} disabled={published.length === 0} onClick={() => setComposing("swap")}>
              ⇄ {t.tradeSwap}
            </button>
            <button type="button" data-testid="trade-giveaway" className={button.quiet} disabled={published.length === 0} onClick={() => setComposing("giveaway")}>
              {lang === "he" ? "←" : "→"} {t.tradeGiveaway}
            </button>
          </div>
          {own.length > 0 ? (
            <div className={card}>
              <h2 className={cardTitle}>{t.tradeMine}</h2>
              <ul className="mt-3 flex flex-col gap-3">
                {own.map((trade) => {
                  const site = sites.find((item) => item.id === trade.siteId);
                  if (!site) return null;
                  const mineOpen = trade.requesterId === selfId && (trade.status === "open" || trade.status === "accepted");
                  const askMe = trade.kind === "swap" && trade.status === "open" && trade.targetId === selfId;
                  return (
                    <li key={trade.id} data-testid={`trade-row-${trade.id}`} className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{trade.kind === "swap" ? t.tradeSwap : t.tradeGiveaway}</span>
                        {sites.length > 1 ? <span className="text-xs text-muted">{siteLabel(site.name, lang)}</span> : null}
                        <span className={`${pill} ${statusTone(trade.status)}`}>{t.tradeStatus[trade.status]}</span>
                        <div className="ms-auto flex gap-2">
                          {askMe ? (
                            <>
                              <button
                                type="button"
                                className={button.small}
                                onClick={() => void api.answer(trade.id, true).then((code) => setRowError(code ? { id: trade.id, code } : null))}
                              >
                                {t.tradeApprove}
                              </button>
                              <button
                                type="button"
                                className={button.small}
                                onClick={() => void api.answer(trade.id, false).then((code) => setRowError(code ? { id: trade.id, code } : null))}
                              >
                                {t.tradeReject}
                              </button>
                            </>
                          ) : null}
                          {mineOpen ? (
                            <button
                              type="button"
                              data-testid={`trade-withdraw-${trade.id}`}
                              className={button.small}
                              onClick={() => void api.cancel(trade.id).then((code) => setRowError(code ? { id: trade.id, code } : null))}
                            >
                              {t.tradeWithdraw}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <TradeCard
                        state={{ ...site.state, week: trade.week }}
                        lang={lang}
                        kind={trade.kind}
                        week={trade.week}
                        from={{ slotKey: trade.slotKey, employeeId: trade.requesterId }}
                        to={trade.targetSlotKey && trade.targetId ? { slotKey: trade.targetSlotKey, employeeId: trade.targetId } : null}
                        takerId={trade.kind === "giveaway" ? trade.targetId : null}
                      />
                      {rowError?.id === trade.id ? (
                        <p role="alert" className="text-sm text-danger-text">
                          {tradeError(lang, rowError.code)}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
      {composing ? (
        <TradeComposer kind={composing} lang={lang} selfId={selfId} week={week} sites={published} busySeats={busySeats} api={api} onClose={() => setComposing(null)} />
      ) : null}
      {prompt && promptSite ? (
        <TradePrompt
          key={prompt.id}
          lang={lang}
          testId={prompt.kind === "swap" ? "trade-incoming" : "trade-offer"}
          title={prompt.kind === "swap" ? t.tradeSwap : t.tradeGiveaway}
          note={`${prompt.kind === "swap" ? t.tradeSwapAsk : t.tradeGiveawayAsk}${sites.length > 1 ? ` · ${siteLabel(promptSite.name, lang)}` : ""}`}
          actions={
            prompt.kind === "swap"
              ? [
                  { label: t.tradeApprove, tone: "primary", testId: "trade-accept", run: () => api.answer(prompt.id, true) },
                  { label: t.tradeReject, tone: "danger", testId: "trade-decline", run: () => api.answer(prompt.id, false) },
                  { label: t.tradeLater, tone: "quiet", testId: "trade-later", run: () => later.add(prompt.id) },
                ]
              : [
                  { label: t.tradeTake, tone: "primary", testId: "trade-take", run: () => api.answer(prompt.id, true) },
                  { label: t.tradeNotNow, tone: "quiet", testId: "trade-dismiss", run: () => dismissed.add(prompt.id) },
                ]
          }
        >
          <TradeCard
            state={{ ...promptSite.state, week: prompt.week }}
            lang={lang}
            kind={prompt.kind}
            week={prompt.week}
            from={{ slotKey: prompt.slotKey, employeeId: prompt.requesterId }}
            to={prompt.targetSlotKey && prompt.targetId ? { slotKey: prompt.targetSlotKey, employeeId: prompt.targetId } : null}
            takerId={prompt.kind === "giveaway" ? selfId : null}
          />
        </TradePrompt>
      ) : null}
    </>
  );
}

/** The shift manager's prompt once both people agreed, with the same card the employees saw. */
export function ManagerTradePrompt({
  trade,
  site,
  lang,
  onDecide,
  onLater,
}: {
  trade: ShiftTrade;
  site: TradeSite;
  lang: Lang;
  onDecide: (approve: boolean) => Promise<string | null>;
  onLater: () => void;
}) {
  const t = copy[lang];
  return (
    <TradePrompt
      key={trade.id}
      lang={lang}
      testId="trade-review"
      title={trade.kind === "swap" ? t.tradeSwap : t.tradeGiveaway}
      note={`${t.tradeBothAgreed} · ${siteLabel(site.name, lang)}`}
      actions={[
        { label: t.tradeApprove, tone: "primary", testId: "trade-approve", run: () => onDecide(true) },
        { label: t.tradeReject, tone: "danger", testId: "trade-reject", run: () => onDecide(false) },
        { label: t.tradeLater, tone: "quiet", testId: "trade-review-later", run: onLater },
      ]}
    >
      <TradeCard
        state={{ ...site.state, week: trade.week }}
        lang={lang}
        kind={trade.kind}
        week={trade.week}
        from={{ slotKey: trade.slotKey, employeeId: trade.requesterId }}
        to={trade.targetSlotKey && trade.targetId ? { slotKey: trade.targetSlotKey, employeeId: trade.targetId } : null}
        takerId={trade.kind === "giveaway" ? trade.targetId : null}
      />
    </TradePrompt>
  );
}
