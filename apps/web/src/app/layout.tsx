import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import "./ui.css";

// IBM Plex: open, even letterforms that stay readable at the small sizes a canvas and an IDE live at.
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "EveLab",
  description: "The open-source visual IDE for Eve agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <MotionProvider>
          <TooltipProvider delayDuration={400}>{children}</TooltipProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
