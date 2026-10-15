import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  display: "swap",
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "Rota",
  description: "סידור משמרות",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body>{children}</body>
    </html>
  );
}
