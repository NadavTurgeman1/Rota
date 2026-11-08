"use client";

import { useState } from "react";
import { RailIcon } from "./rail-icon";

type Tab = { id: string; label: string; short?: string };

const PREFERRED = ["dashboard", "attendance", "schedule", "team", "reports"];

/** Bottom tab bar for a phone. At most four screens, then More. No sideways scroll. */
export function PhoneTabBar({
  tabs,
  active,
  moreLabel,
  onSelect,
}: {
  tabs: Tab[];
  active: string | null;
  moreLabel: string;
  onSelect: (id: string) => void;
}) {
  const [more, setMore] = useState(false);
  if (tabs.length === 0) return null;
  const preferred = PREFERRED.flatMap((id) => {
    const tab = tabs.find((item) => item.id === id);
    return tab ? [tab] : [];
  });
  const showAll = tabs.length <= 5;
  const bar = showAll ? tabs : preferred.slice(0, 4);
  const rest = showAll ? [] : tabs.filter((tab) => !bar.some((item) => item.id === tab.id));
  const moreActive = rest.some((tab) => tab.id === active);

  function choose(id: string) {
    setMore(false);
    onSelect(id);
  }

  return (
    <>
      {more && rest.length > 0 ? (
        <button type="button" className="phone-tabbar-scrim md:hidden" aria-label={moreLabel} onClick={() => setMore(false)} />
      ) : null}
      {more && rest.length > 0 ? (
        <div className="phone-more md:hidden" role="menu">
          {rest.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="menuitem"
              className={`phone-more-item ${tab.id === active ? "phone-more-item-active" : ""}`}
              onClick={() => choose(tab.id)}
            >
              <RailIcon name={tab.id as "schedule"} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      <nav className="phone-tabbar md:hidden" aria-label="Rota">
        <div className="phone-tabbar-surface" role="tablist">
          {bar.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === active}
              className={`phone-tab ${tab.id === active ? "phone-tab-active" : ""}`}
              onClick={() => choose(tab.id)}
            >
              <RailIcon name={tab.id as "schedule"} />
              <span>{tab.short ?? tab.label}</span>
            </button>
          ))}
          {rest.length > 0 ? (
            <button
              type="button"
              role="tab"
              aria-selected={moreActive}
              aria-expanded={more}
              className={`phone-tab ${moreActive ? "phone-tab-active" : ""}`}
              onClick={() => setMore((open) => !open)}
            >
              <RailIcon name="more" />
              <span>{moreLabel}</span>
            </button>
          ) : null}
        </div>
      </nav>
    </>
  );
}
