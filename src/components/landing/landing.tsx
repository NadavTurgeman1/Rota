"use client";

import { useEffect } from "react";
import { landingConfig as config } from "../../landing/config";
import { Benefits } from "./benefits";
import { Compare } from "./compare";
import { Faq } from "./faq";
import { FinalCta } from "./final-cta";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { Navbar, useLandingTheme } from "./navbar";
import { Meeting } from "./meeting";
import { Problem } from "./problem";
import { Proof } from "./proof";
import { Roi } from "./roi";
import { Steps } from "./steps";
import { Testimonials } from "./testimonials";

export function Landing() {
  const { theme, toggle } = useLandingTheme();

  useEffect(() => {
    const { hash, search } = window.location;
    const recovery = `${hash} ${search}`.includes("type=recovery") || hash.includes("access_token");
    if (recovery) window.location.replace(`${config.loginUrl}${search}${hash}`);
  }, []);

  return (
    <div id="top" className="min-h-dvh bg-page text-ink">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        {config.skip}
      </a>
      <Navbar theme={theme} onToggle={toggle} />
      <main id="content">
        <Hero />
        <Proof />
        <Problem />
        <Steps />
        <Benefits />
        <Roi />
        <Compare />
        <Testimonials />
        <Meeting />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
