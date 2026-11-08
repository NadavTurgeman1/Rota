import type { Metadata } from "next";
import { Landing } from "../components/landing/landing";
import { landingConfig } from "../landing/config";

export const metadata: Metadata = {
  metadataBase: new URL("https://rota-schedule.com"),
  title: landingConfig.seo.title,
  description: landingConfig.seo.description,
  openGraph: {
    title: landingConfig.seo.shareTitle,
    description: landingConfig.seo.shareDescription,
    url: "/",
    siteName: landingConfig.name,
    locale: "he_IL",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: landingConfig.seo.shareTitle,
    description: landingConfig.seo.shareDescription,
  },
};

export default function HomePage() {
  return <Landing />;
}
