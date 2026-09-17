import { loader } from "fumadocs-core/source";
import { docs } from "../../.source";

/**
 * Fumadocs' content source. `.source` is generated from content/docs by
 * `fumadocs-mdx` — see the postinstall script and next.config.ts.
 *
 * Only the content pipeline, page tree, TOC and slug routing come from
 * fumadocs; none of its UI package is installed. Docs pages are rendered with
 * the Subway design system so the app has one visual language, not two.
 */
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export type DocsNavItem = { url: string; title: string };

/** Flatten the page tree into the sidebar's order, as plain serialisable data. */
export function docsNav(): DocsNavItem[] {
  const out: DocsNavItem[] = [];
  const walk = (nodes: typeof source.pageTree.children) => {
    for (const node of nodes) {
      if (node.type === "page") out.push({ url: node.url, title: String(node.name) });
      else if (node.type === "folder") walk(node.children);
    }
  };
  walk(source.pageTree.children);
  return out;
}
