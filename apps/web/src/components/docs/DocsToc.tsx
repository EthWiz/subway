import type { ReactNode } from "react";

export type TocEntry = { title: ReactNode; url: string; depth: number };

/** On-this-page list. Depth 2 and 3 only; deeper headings do not earn a line. */
export function DocsToc({ toc }: { toc: TocEntry[] }) {
  const items = toc.filter((t) => t.depth <= 3);
  if (items.length === 0) return null;

  return (
    <aside aria-label="On this page" className="hidden xl:block xl:sticky xl:top-8 xl:self-start">
      <div className="type-label mb-3 text-muted">On this page</div>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {items.map((item) => (
          <li key={item.url} style={{ paddingLeft: item.depth > 2 ? "12px" : 0 }}>
            <a
              href={item.url}
              className="plain-link type-body-sm block text-muted transition-colors hover:text-strong"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
