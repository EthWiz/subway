import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";
import { MockBanner } from "@/components/MockBanner";
import { JurisdictionGate } from "@/components/JurisdictionGate";

/*
 * The three families the design system names. It loads them with an `@import`
 * from the Google Fonts CDN; `next/font/google` fetches the same files at build
 * time and self-hosts them, which removes the render-blocking request and the
 * third-party origin. The variables are re-published as `--font-serif` /
 * `--font-ui` / `--font-num` / `--font-mono` in globals.css, which is what the
 * token files read.
 *
 * Substituted, not brand truth: Subway ships no licensed typefaces. Instrument
 * Serif carries the wordmark and page titles, Schibsted Grotesk stands in for a
 * Söhne-class grotesk, and IBM Plex Mono is addresses and code only.
 */
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--ff-serif",
});

const grotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--ff-ui",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--ff-mono",
});

export const metadata: Metadata = {
  title: "Subway — hedged stock-token LP",
  description:
    "Delta-hedged AMM liquidity provision on Robinhood Chain. Mock UI; nothing is deployed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${grotesk.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <SiteNav />
        <div className="mx-auto w-full max-w-[var(--maxw-page)] px-6 pb-20 pt-8 lg:px-[var(--page-pad)]">
          <MockBanner />
          <main className="mt-6">{children}</main>
          <footer className="type-body-sm mt-14 border-t border-subtle pt-5 text-muted">
            Unaudited and undeployed. Phase 0 returned NO-GO on AMC, HOOD and MSTR; every other name
            is ungraded. See <code>docs/plan.md</code> and{" "}
            <code>research/2026-09-16-hedgeability-and-pool-screen.md</code>.
          </footer>
        </div>
        <JurisdictionGate />
      </body>
    </html>
  );
}
