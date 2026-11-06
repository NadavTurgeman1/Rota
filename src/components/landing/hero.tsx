import { landingConfig as config } from "../../landing/config";
import { PrimaryLink, RichText } from "./chrome";

const tone = {
  morning: "bg-slot-m",
  afternoon: "bg-slot-a",
  night: "bg-slot-n",
};

export function Hero() {
  const hero = config.hero;
  return (
    <div className="landing-hero relative overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="landing-rise text-sm font-semibold text-brand-text" style={{ animationDelay: "0ms" }}>
            {hero.eyebrow}
          </p>
          <h1 className="landing-rise mt-3 max-w-xl text-4xl font-bold leading-tight tracking-tight text-balance text-ink sm:text-6xl" style={{ animationDelay: "80ms" }}>
            {hero.title}
          </h1>
          <p className="landing-rise mt-5 max-w-xl text-lg leading-8 text-muted" style={{ animationDelay: "160ms" }}>
            <RichText text={hero.subtitle} />
          </p>
          <div className="landing-rise mt-8" style={{ animationDelay: "240ms" }}>
            <PrimaryLink href={config.meetingUrl}>{hero.primary}</PrimaryLink>
          </div>
        </div>
        <figure id="product" aria-label={hero.mockupLabel} className="landing-rise scroll-mt-28" style={{ animationDelay: "320ms" }}>
          <div aria-hidden="true" className="rounded-3xl border border-line bg-card p-4 shadow-pop sm:p-5">
            <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-1.5">
              <span />
              {hero.days.map((day) => (
                <span key={day} className="text-center text-xs font-semibold text-muted">
                  {day}
                </span>
              ))}
              {hero.shifts.map((shift) => (
                <div key={shift.name} className="contents">
                  <span className="flex items-center text-[11px] font-medium text-muted">{shift.name}</span>
                  {shift.cells.map((name, index) => (
                    <span key={`${shift.name}-${hero.days[index]}`} className={`flex h-12 items-center justify-center rounded-lg text-[11px] font-medium text-ink ${tone[shift.tone]}`}>
                      {name}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </figure>
      </div>
    </div>
  );
}
