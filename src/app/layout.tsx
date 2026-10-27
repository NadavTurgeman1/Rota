import type { Metadata } from "next";
import { Heebo, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  display: "swap",
  variable: "--font-heebo",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Rota",
  description: "סידור משמרות",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
