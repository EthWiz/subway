import { defineConfig, defineDocs } from "fumadocs-mdx/config";

/**
 * Fumadocs' content collection. Frontmatter is the default schema — `title`
 * and `description` — and `meta.json` beside the files sets the order.
 */
export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig();
