import Link from "next/link";
import {
  MOCK_ADDRESS,
  POSITIONS,
  getPair,
  impliedHedgeRatio,
  previewRedeemAmounts,
} from "@/lib/mock";
import { Stat } from "@/components/Stat";
import { num, pct, shortAddress, usd, utc } from "@/lib/format";

export default function PortfolioPage() {
  const rows = POSITIONS.map((position) => {
    const pair = getPair(position.slug);
    return pair ? { position, pair } : null;
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  const xValue = rows.reduce((s, r) => s + r.position.xShares * r.pair.x.navPerShare, 0);
  const hValue = rows.reduce(
    (s, r) => s + r.position.hShares * (r.pair.h?.floorNavPerShare ?? 0),
    0,
  );
  const claimable = rows
    .filter((r) => r.position.queued?.status === "claimable")
    .reduce((s, r) => s + (r.position.queued?.shares ?? 0) * (r.pair.h?.floorNavPerShare ?? 0), 0);
  const total = xValue + hValue;
  const blendedHedge =
    total === 0
      ? 0
      : rows.reduce(
          (s, r) =>
            s +
            impliedHedgeRatio(r.pair, r.position) *
              ((r.position.xShares * r.pair.x.navPerShare +
                r.position.hShares * (r.pair.h?.floorNavPerShare ?? 0)) /
                total),
          0,
        );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Portfolio</h1>
      <p className="tnum mt-2 text-sm text-ink-3">{shortAddress(MOCK_ADDRESS)}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Unhedged (xAMC)" value={usd(xValue)} sub="full equity beta" />
        <Stat label="Hedged (hAMC)" value={usd(hValue)} sub="at floor NAV" />
        <Stat
          label="Implied hedge ratio"
          value={blendedHedge.toFixed(2)}
          sub="0.00 = full beta, 1.00 = flat"
          tone={blendedHedge > 0 ? "default" : "muted"}
        />
        <Stat
          label="Claimable now"
          value={usd(claimable)}
          tone={claimable > 0 ? "positive" : "muted"}
        />
      </div>

      <p className="mt-4 rounded-lg border border-info-line bg-info-soft p-3 text-xs leading-relaxed text-info">
        Moving between {"xAMC"} and {"hAMC"} is a <strong className="font-semibold">wrap</strong>,
        not an exit and re-entry. Your LP position is never closed or reopened — the hedged vault
        simply holds your base-vault shares and shorts the delta against them. You choose how much
        of your exposure is hedged by choosing the mix.
      </p>

      <div className="mt-8 space-y-3">
        {rows.map(({ position, pair }) => {
          const ratio = impliedHedgeRatio(pair, position);
          const out = previewRedeemAmounts(pair.x, position.xShares);
          return (
            <div key={position.slug} className="rounded-xl border border-line bg-panel p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Link
                  href={`/vault/${pair.slug}`}
                  className="font-semibold text-ink hover:underline"
                >
                  {pair.base}/{pair.quote}
                </Link>
                <span className="tnum text-sm text-ink-2">
                  implied hedge{" "}
                  <span className={ratio > 0 ? "text-ink" : "text-ink-3"}>{ratio.toFixed(2)}</span>
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-line bg-inset px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wider text-ink-3">
                    {pair.base}x · unhedged
                  </div>
                  <div className="tnum mt-1 text-sm text-ink">
                    {num(position.xShares)} shares · {usd(position.xShares * pair.x.navPerShare)}
                  </div>
                  <div className="tnum mt-1 text-xs text-ink-3">
                    redeems to {num(out.stockOut, 4)} {pair.base} + {num(out.usdgOut, 2)}{" "}
                    {pair.quote}
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-inset px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wider text-ink-3">
                    {pair.base}h · hedged
                  </div>
                  {pair.hedgeAvailable && pair.h ? (
                    <>
                      <div className="tnum mt-1 text-sm text-ink">
                        {num(position.hShares)} shares ·{" "}
                        {usd(position.hShares * pair.h.floorNavPerShare)}
                      </div>
                      <div className="tnum mt-1 text-xs text-ink-3">
                        vault hedge ratio {pair.h.hedgeRatio.toFixed(2)}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 text-sm text-ink-4">
                      Not deployed — <code className="text-ink-3">hedgeAvailable()</code> is false
                    </div>
                  )}
                </div>
              </div>

              {position.queued && pair.h ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-inset px-4 py-3 text-sm">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                      position.queued.status === "claimable"
                        ? "bg-pos-soft text-pos"
                        : "bg-neutral-soft text-ink-2"
                    }`}
                  >
                    {position.queued.status}
                  </span>
                  <span className="tnum text-ink-2">
                    {num(position.queued.shares)} {pair.base}h requested{" "}
                    {utc(position.queued.requestedAt)}
                  </span>
                  {position.queued.status === "claimable" ? (
                    <button
                      disabled
                      className="ml-auto cursor-not-allowed rounded-lg bg-disabled px-3 py-1.5 text-xs font-semibold text-ink-3"
                    >
                      Claim (no contract)
                    </button>
                  ) : (
                    <span className="tnum ml-auto text-xs text-ink-3">
                      settles {utc(position.queued.claimableAt)}
                    </span>
                  )}
                </div>
              ) : null}

              <div className="mt-3 text-xs text-ink-4">
                Unhedged exposure tracks {pair.base} one-for-one ({pct(pair.x.stockMovePct, 1)} over
                30d).
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
