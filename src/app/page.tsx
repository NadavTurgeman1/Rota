import type { Metadata } from "next";
import { Landing } from "../components/landing/landing";
import { landingConfig } from "../landing/config";

export const metadata: Metadata = {
  title: landingConfig.seo.title,
  description: landingConfig.seo.description,
};

export default function HomePage() {
  return <Landing />;
}
