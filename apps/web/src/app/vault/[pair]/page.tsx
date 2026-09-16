import { notFound } from "next/navigation";
import Link from "next/link";
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
    <div>
      <Link href="/" className="text-xs text-ink-3 hover:text-ink-2">
        ← Vaults
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {pair.base}/{pair.quote}
        </h1>
        {pair.x.paused ? (
          <span className="rounded bg-warn-soft px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-warn">
            Deposits paused
          </span>
        ) : null}
        <a
          href={`https://explorer.chain.robinhood.com/address/${pair.pool}`}
          target="_blank"
          rel="noreferrer"
          className="tnum text-xs text-ink-3 hover:text-ink-2"
        >
          pool {pair.pool.slice(0, 10)}…
        </a>
      </div>

      <VaultView
        pair={pair}
        position={POSITIONS.find((p) => p.slug === pair.slug)}
        decisions={DECISIONS[pair.slug] ?? []}
      />
    </div>
  );
}
