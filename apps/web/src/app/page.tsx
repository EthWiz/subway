import { Card, Stat } from "@/ds";
import { PAIRS, REJECTED } from "@/lib/mock";
import { compactUsd } from "@/lib/format";
import { VaultTable } from "@/components/VaultTable";

export default function VaultListPage() {
  const tvl = PAIRS.reduce((s, p) => s + p.x.tvlUsd, 0);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-[var(--maxw-prose)]">
          <div className="type-label mb-2 text-muted">Vaults · Robinhood Chain 4663</div>
          <h1 className="mb-2">LP a stock token. Keep the fees, drop the direction.</h1>
          <p className="type-body m-0 text-body">
            Every vault, its TVL, 24h fee APR, and share price.
          </p>
        </div>
        <div className="flex gap-8">
          <Stat label="TVL, all vaults" value={compactUsd(tvl)} align="right" hint="invented" />
          <Stat
            label="Names rejected"
            value={`${REJECTED.length} / ${REJECTED.length + PAIRS.length}`}
            align="right"
            hint="Phase 0, 2026-09-16"
          />
        </div>
      </header>

      <Card pad="none" style={{ padding: "var(--sp-5) 0 0", overflow: "hidden" }}>
        <VaultTable />
      </Card>
    </>
  );
}
