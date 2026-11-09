import type { Metadata, Viewport } from "next";
import { Heebo, Inter } from "next/font/google";
import type { ReactNode } from "react";
import { NativeZoomLock } from "../native/zoom-lock";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${inter.variable}`}>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var explicit=localStorage.getItem("rota.theme.explicit")==="1";var saved=localStorage.getItem("rota.theme");var dark=explicit?saved==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",dark)}catch(e){}`,
          }}
        />
        <NativeZoomLock />
        {children}
      </body>
    </html>
  );
}
