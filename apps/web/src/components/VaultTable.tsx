"use client";

import { useRouter } from "next/navigation";
import { DataTable, StatusPill, TokenMark, Tooltip, type DataTableRow } from "@/ds";
import { PAIRS } from "@/lib/mock";
import { compactUsd, pct, usd, utc } from "@/lib/format";

/**
 * The vault list.
 *
 * The last four columns describe the hedged wrapper only, and read "—" until it
 * exists — which, on chain, is everywhere. Absent is shown as an em-dash rather
 * than a zero: a zero queue and no queue are different facts.
 */
export function VaultTable() {
  const router = useRouter();

  const columns = [
    { key: "share", label: "Share", mono: false, width: "24%" },
    { key: "tvl", label: "TVL", align: "right" as const },
    {
      key: "apr",
      label: (
        <Tooltip content="Extrapolated from one ~15-minute pre-open window on 2026-09-16, then annualised. Trailing, decays, and never netted against adverse selection. Not a return.">
          Fee APR 24h
        </Tooltip>
      ),
      align: "right" as const,
    },
    { key: "nav", label: "NAV / share", align: "right" as const },
    { key: "hedge", label: "Hedge ratio", align: "right" as const },
    { key: "floor", label: "Floor / attested", align: "right" as const },
    { key: "queue", label: "Queue", align: "right" as const },
    { key: "epoch", label: "Next epoch", align: "right" as const },
  ];

  const rows: (DataTableRow & { slug: string })[] = PAIRS.map((p) => {
    const h = p.hedgeAvailable ? p.h : null;
    return {
      id: p.slug,
      slug: p.slug,
      share: (
        <span className="flex items-center gap-3">
          <TokenMark
            ticker={p.base}
            size="sm"
            name={`${p.base}/${p.quote} · ${pct(p.feeTier, 3)} pool`}
          />
          {p.x.paused ? <StatusPill state="paused" label="Deposits paused" /> : null}
        </span>
      ),
      tvl: compactUsd(p.x.tvlUsd),
      apr: pct(p.trailingFeeApr, 1),
      nav: usd(p.x.navPerShare, 5),
      hedge: h ? h.hedgeRatio.toFixed(2) : "—",
      floor: h ? (
        <>
          {usd(h.floorNavPerShare, 4)}
          <span style={{ color: "var(--text-muted)" }}> / {usd(h.attestedNavPerShare, 4)}</span>
        </>
      ) : (
        "—"
      ),
      queue: h ? (h.queueDepthUsd > 0 ? compactUsd(h.queueDepthUsd) : "—") : "—",
      epoch: h ? utc(h.nextEpochIso).slice(5) : "—",
    };
  });

  return (
    <DataTable columns={columns} rows={rows} onRowClick={(r) => router.push(`/vault/${r.slug}`)} />
  );
}
