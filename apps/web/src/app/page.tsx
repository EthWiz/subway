import Link from "next/link";
import { PAIRS, PHASE0_MODEL } from "@/lib/mock";
import { compactUsd, pct, usd, utc } from "@/lib/format";
import { InfoTipTrigger, InfoTipPanel } from "@/components/InfoTip";

export default function VaultListPage() {
  const anyHedged = PAIRS.some((p) => p.hedgeAvailable);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Vaults</h1>
      {/* Native <details>: collapsible with no JS, no hydration risk, and
          keyboard-accessible for free. Folded by default — the table is the
          point of the page, and the two-token explanation is here for whoever
          wants it rather than in everyone's way. */}
      <details className="group mt-2 max-w-2xl">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded text-sm font-medium text-ink-3 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className="size-3 shrink-0 transition-transform duration-150 group-open:rotate-90"
          >
            <path d="M4 2.5 L8 6 L4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          How this works
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Each pair is two share-issuing vaults. <strong className="text-ink">xAMC</strong> LPs a
          Robinhood Stock Token against USDG on Uniswap and is unhedged — deposits and withdrawals
          are immediate. <strong className="text-ink">hAMC</strong> wraps it, shorts the delta on
          Lighter RH, and mints at a conservative floor NAV with a redemption queue.
        </p>
      </details>

      <div className="group/tip relative mt-8">
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-3">
                <Th>Pair</Th>
                <Th right>TVL</Th>
                <Th right>
                  <InfoTipTrigger label="Fee APR*" />
                </Th>
                <Th right>NAV / share</Th>
                <Th right hedged>
                  Hedge ratio
                </Th>
                <Th right hedged>
                  Floor / attested
                </Th>
                <Th right hedged>
                  Queue
                </Th>
                <Th right hedged>
                  Next epoch
                </Th>
              </tr>
            </thead>
            <tbody>
              {PAIRS.map((p) => (
                <tr key={p.slug} className="border-b border-line-soft last:border-0 hover:bg-hover">
                  <td className="px-4 py-3.5">
                    <Link href={`/vault/${p.slug}`} className="group flex items-center gap-2.5">
                      <span className="font-semibold text-ink group-hover:underline">
                        {p.base}/{p.quote}
                      </span>
                      {p.x.paused ? (
                        <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warn">
                          Paused
                        </span>
                      ) : null}
                    </Link>
                    <div className="mt-0.5 text-xs text-ink-3">{pct(p.feeTier, 3)} pool</div>
                  </td>
                  <Td>{compactUsd(p.x.tvlUsd)}</Td>
                  <Td>{pct(p.trailingFeeApr, 1)}</Td>
                  <Td>{usd(p.x.navPerShare, 5)}</Td>
                  {p.h && p.hedgeAvailable ? (
                    <>
                      <Td>{p.h.hedgeRatio.toFixed(2)}</Td>
                      <Td>
                        {usd(p.h.floorNavPerShare, 4)}
                        <span className="text-ink-3"> / {usd(p.h.attestedNavPerShare, 4)}</span>
                      </Td>
                      <Td>{p.h.queueDepthUsd > 0 ? compactUsd(p.h.queueDepthUsd) : "—"}</Td>
                      <Td>{utc(p.h.nextEpochIso).slice(5)}</Td>
                    </>
                  ) : (
                    <td colSpan={4} className="px-4 py-3.5 text-right text-xs text-ink-4">
                      hAMC not deployed
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sibling of the scroll container, not a child of it — see InfoTip. */}
        <InfoTipPanel>
          <span className="font-semibold text-ink">Not a realised return.</span> Measured by{" "}
          <code className="text-ink">research/scan.ts</code> over one{" "}
          {PHASE0_MODEL.windowMinutes.toFixed(0)}-minute pre-open window on 2026-09-16:
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Sum the quote-side notional of every swap in the window, times the fee tier.</li>
            <li>
              Scale that to a day (×{(1440 / PHASE0_MODEL.windowMinutes).toFixed(0)}), then to a
              year (×365).
            </li>
            <li>
              Take the vault&rsquo;s cut, <code className="text-ink">e / (active + e)</code>, where{" "}
              <code className="text-ink">e</code> is {compactUsd(PHASE0_MODEL.vaultTvlUsd)} ×{" "}
              {PHASE0_MODEL.concentrationMultiplier} — its dollars count that many times over
              because it is concentrated at ±{pct(PHASE0_MODEL.rangeHalfWidth, 0)} against the
              pool&rsquo;s full-range-equivalent active liquidity.
            </li>
            <li>Divide by the {compactUsd(PHASE0_MODEL.vaultTvlUsd)} vault size.</li>
          </ol>
          <span className="mt-2 block">
            Annualising 15 minutes is why these are enormous. No markout was ever run, so none of it
            is net of adverse selection.
          </span>
        </InfoTipPanel>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        The last four columns describe <strong className="text-ink-2">hAMC</strong> only and are
        empty until the hedged vault exists.{" "}
        {anyHedged
          ? "One pair above previews the hedged UI so it is reachable at all. That preview is a UI fixture: on chain, hedgeAvailable() is a constant false and answers false for every pair, including that one."
          : "hedgeAvailable() is a constant false and answers false for every pair."}
      </p>

      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        * Extrapolated from a {PHASE0_MODEL.windowMinutes.toFixed(0)}-minute pre-open window on
        2026-09-16 against a {compactUsd(PHASE0_MODEL.vaultTvlUsd)} vault at ±
        {pct(PHASE0_MODEL.rangeHalfWidth, 0)}. Annualising a 15-minute sample produces very large
        numbers; treat them as a screen, not a forecast. The gate was{" "}
        {pct(PHASE0_MODEL.minVaultFeeApr)} — twice the {pct(PHASE0_MODEL.hedgeCarryApr)} hedge
        carry.
      </p>
    </div>
  );
}

function Th({
  children,
  right,
  hedged,
}: {
  children: React.ReactNode;
  right?: boolean;
  hedged?: boolean;
}) {
  return (
    <th
      className={`px-4 py-2.5 font-medium ${right ? "text-right" : ""} ${hedged ? "text-ink-4" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="tnum px-4 py-3.5 text-right text-ink">{children}</td>;
}
