import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OPEN_GRAPH, REPOSITORY_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, siteUrl } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";
import "./ui.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "evelab",
    "AI agent builder",
    "visual IDE for AI agents",
    "multi-agent systems",
    "Eve agents",
    "MCP",
    "TypeScript agents",
    "Vercel",
    "open source",
  ],
  authors: [{ name: "anishfn", url: "https://github.com/anishfn" }],
  creator: "anishfn",
  category: "developer tools",
  openGraph: OPEN_GRAPH,
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  // Transparent PNGs, one per tab colour: dark ink on light tabs, light ink on dark ones.
  icons: {
    icon: [
      { url: "/favicon-light.png", type: "image/png", sizes: "96x96", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.png", type: "image/png", sizes: "96x96", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  other: { "github:repository": REPOSITORY_URL },
};

/** The browser chrome matches the page: the light and dark backgrounds from globals.css. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The head script sets data-theme before hydration, so React is told to expect it.
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
          <TooltipProvider delayDuration={400}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
