"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "@/ds";
import { MOCK_ADDRESS } from "@/lib/mock";
import { shortAddress } from "@/lib/format";

/**
 * Binds the design system's `TopNav` to the router.
 *
 * The address is a fixture, not a connection — there is no wallet here and
 * nothing to connect to, so the connect slot is never rendered and the chip
 * says so instead of implying a live session.
 */
export function SiteNav() {
  const pathname = usePathname() ?? "/";
  return (
    <TopNav
      active={pathname}
      items={[
        { href: "/", label: "Vaults" },
        { href: "/portfolio", label: "Portfolio" },
        { href: "/docs", label: "Docs" },
      ]}
      address={`${shortAddress(MOCK_ADDRESS)} · mock`}
      chainLabel="Robinhood Chain · 4663"
    />
  );
}
