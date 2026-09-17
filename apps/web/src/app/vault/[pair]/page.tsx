import { notFound } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/ds";
import { DECISIONS, PAIRS, POSITIONS, getPair } from "@/lib/mock";
import { VaultView } from "@/components/VaultView";

export function generateStaticParams() {
  return PAIRS.map((p) => ({ pair: p.slug }));
}

export default async function VaultPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair: slug } = await params;
  const pair = getPair(slug);
  if (!pair) notFound();

  return (
    <>
      <Link
        href="/"
        className="plain-link type-body-sm mb-5 inline-flex items-center gap-1.5 text-muted transition-colors hover:text-strong"
      >
        <Icon name="arrow-left" size={14} />
        Vaults
      </Link>

      <VaultView
        pair={pair}
        position={POSITIONS.find((p) => p.slug === pair.slug)}
        decisions={DECISIONS[pair.slug] ?? []}
      />
    </>
  );
}
