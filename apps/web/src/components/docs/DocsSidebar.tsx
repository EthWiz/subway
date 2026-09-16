"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocsNavItem } from "@/lib/source";

/**
 * Docs navigation. Borrows the active-item treatment from the system's TopNav —
 * ink for the current page, a terracotta rule against it — rather than the
 * filled pill a docs theme would use, so it reads as the same product.
 */
export function DocsSidebar({ items }: { items: DocsNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Docs" className="lg:sticky lg:top-8">
      <div className="type-label mb-3 text-muted">Docs</div>
      <ul className="m-0 list-none space-y-px p-0">
        {items.map((item) => {
          const active = pathname === item.url;
          return (
            <li key={item.url}>
              <Link
                href={item.url}
                aria-current={active ? "page" : undefined}
                className="plain-link type-body-sm block py-1.5 transition-colors"
                style={{
                  paddingLeft: "10px",
                  borderLeft: `var(--bw-2) solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
                  color: active ? "var(--text-strong)" : "var(--text-muted)",
                  fontWeight: active ? "var(--fw-medium)" : "var(--fw-regular)",
                }}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
