import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { MockBanner } from "@/components/MockBanner";
import { JurisdictionGate } from "@/components/JurisdictionGate";

export const metadata: Metadata = {
  title: "Subway — hedged stock-token LP",
  description:
    "Delta-hedged AMM liquidity provision on Robinhood Chain. Mock UI; nothing is deployed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <MockBanner />
        <Nav />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 pb-12 text-xs leading-relaxed text-ink-4">
          Unaudited and undeployed. Phase 0 returned NO-GO on AMC, HOOD and MSTR; every other name
          is ungraded. See docs/plan.md and research/2026-09-16-hedgeability-and-pool-screen.md.
        </footer>
        <JurisdictionGate />
      </body>
    </html>
  );
}
