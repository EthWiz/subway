import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { getMDXComponents } from "@/mdx-components";
import { source, docsNav } from "@/lib/source";

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) return {};
  return {
    title: `${page.data.title} — Subway docs`,
    description: page.data.description,
  };
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  // Previous/next, in the order meta.json declares.
  const nav = docsNav();
  const at = nav.findIndex((item) => item.url === page.url);
  const prev = at > 0 ? nav[at - 1] : undefined;
  const next = at >= 0 && at < nav.length - 1 ? nav[at + 1] : undefined;

  return (
    <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_170px]">
      <article className="max-w-[var(--maxw-prose)]">
        <h1 className="type-h1 mb-3 text-strong">{page.data.title}</h1>
        {page.data.description ? (
          <p className="type-body mb-8 text-muted">{page.data.description}</p>
        ) : null}

        <MDX components={getMDXComponents()} />

        {prev || next ? (
          <nav className="mt-14 flex gap-6 border-t border-subtle pt-5">
            {prev ? (
              <Link href={prev.url} className="plain-link group">
                <div className="type-label text-muted">Previous</div>
                <div className="type-body mt-1 text-strong">{prev.title}</div>
              </Link>
            ) : null}
            {next ? (
              <Link href={next.url} className="plain-link ml-auto text-right">
                <div className="type-label text-muted">Next</div>
                <div className="type-body mt-1 text-strong">{next.title}</div>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </article>

      <DocsToc toc={page.data.toc} />
    </div>
  );
}
