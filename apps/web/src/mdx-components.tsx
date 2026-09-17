import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { Callout, Card, DataTable, KeyValue, Stat } from "@/ds";
import { RejectedPairs } from "@/components/docs/RejectedPairs";

/**
 * How MDX renders inside the Subway design system.
 *
 * Fumadocs supplies the content pipeline; every element below is styled from
 * the system's own tokens rather than a docs theme. The rules that matter here
 * are the type ones: one serif per screen, so `h1` is the page title in
 * Instrument Serif and every heading under it is the grotesk.
 *
 * The named components are available to any MDX file without importing them.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    h1: (props) => <h1 className="type-h1 mb-3 text-strong" {...props} />,
    h2: (props) => <h2 className="type-h2 mt-10 mb-3 scroll-mt-24 text-strong" {...props} />,
    h3: (props) => <h3 className="type-h3 mt-8 mb-2 scroll-mt-24 text-strong" {...props} />,
    p: (props) => <p className="type-body mb-4 text-body" {...props} />,
    ul: (props) => (
      <ul className="type-body mb-4 list-disc space-y-1.5 pl-5 text-body" {...props} />
    ),
    ol: (props) => (
      <ol className="type-body mb-4 list-decimal space-y-1.5 pl-5 text-body" {...props} />
    ),
    li: (props) => <li {...props} />,
    strong: (props) => <strong style={{ fontWeight: "var(--fw-semibold)" }} {...props} />,
    hr: () => <hr className="my-10 border-0 border-t border-subtle" />,
    a: ({ href, ...props }) => {
      const internal = typeof href === "string" && href.startsWith("/");
      return internal ? (
        <Link href={href} {...props} />
      ) : (
        <a href={href} target="_blank" rel="noreferrer" {...props} />
      );
    },
    pre: (props) => (
      <pre
        className="type-code mb-4 overflow-x-auto p-4"
        style={{
          background: "var(--bg-sunken)",
          border: "var(--bw-1) solid var(--border-subtle)",
          borderRadius: "var(--radius-card)",
          color: "var(--text-strong)",
        }}
        {...props}
      />
    ),
    blockquote: (props) => (
      <blockquote
        className="type-body mb-4 pl-4 text-muted"
        style={{ borderLeft: "var(--bw-2) solid var(--border-default)" }}
        {...props}
      />
    ),
    // Available to every MDX file without an import.
    Callout,
    Card,
    DataTable,
    KeyValue,
    Stat,
    RejectedPairs,
    ...components,
  };
}
