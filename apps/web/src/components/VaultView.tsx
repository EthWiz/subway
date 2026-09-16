"use client";

import { useState } from "react";
import type { DecisionEntry, Pair, Position } from "@/lib/mock";
import { Stat } from "@/components/Stat";
import { Row } from "@/components/Field";
import { UnhedgedDeposit, UnhedgedWithdraw } from "@/components/UnhedgedPanels";
import { HedgedDeposit, HedgedRedeem } from "@/components/HedgedPanels";
import { compactUsd, num, pct, signedUsd, usd, utc } from "@/lib/format";

export function VaultView({
  pair,
  position,
  decisions,
}: {
  pair: Pair;
  position: Position | undefined;
  decisions: DecisionEntry[];
}) {
  const [hedged, setHedged] = useState(false);
  const h = pair.h;
  // Mirrors `Router.hedgeAvailable(stock)`; the hedged paths revert without it.
  const canHedge = pair.hedgeAvailable && h !== null;
  const showHedged = hedged && canHedge && h !== null;

  const xShares = position?.xShares ?? 0;
  const hShares = position?.hShares ?? 0;
  const inRange = pair.x.spot >= pair.x.rangeLower && pair.x.spot <= pair.x.rangeUpper;

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Toggle hedged={showHedged} setHedged={setHedged} disabled={!canHedge} pair={pair} />
        {!canHedge ? (
          <p className="text-xs text-ink-3">
            <code className="text-ink-2">hedgeAvailable()</code> is false — the hedged vault is not
            built yet and its deposit and redeem paths revert{" "}
            <code className="text-ink-2">HedgedVaultNotDeployed</code>.
          </p>
        ) : (
          <p className="text-xs text-ink-3">
            Toggling is a wrap/unwrap — no LP position is closed or reopened.{" "}
            <span className="text-warn">
              Preview only: on chain <code>hedgeAvailable()</code> is false for this pair too.
            </span>
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {showHedged ? (
          <>
            <Stat label="hAMC TVL" value={compactUsd(h.tvlUsd)} sub="invented" />
            <Stat label="Hedge ratio" value={h.hedgeRatio.toFixed(2)} sub="target 1.00" />
            <Stat
              label="Floor NAV"
              value={usd(h.floorNavPerShare, 4)}
              sub={`attested ${usd(h.attestedNavPerShare, 4)}`}
            />
            <Stat
              label="Queue"
              value={compactUsd(h.queueDepthUsd)}
              sub={`${h.queuedRedemptions} requests · ${utc(h.nextEpochIso).slice(5)}`}
              tone="muted"
            />
          </>
        ) : (
          <>
            <Stat label="xAMC TVL" value={compactUsd(pair.x.tvlUsd)} sub="invented" />
            <Stat
              label="Fee APR"
              value={pct(pair.trailingFeeApr, 1)}
              sub="extrapolated, 15-min window"
            />
            <Stat
              label="NAV / share"
              value={usd(pair.x.navPerShare, 5)}
              sub="feed prices, pool mix"
            />
            <Stat
              label="TVL ceiling"
              value={compactUsd(pair.maxVaultTvlUsd)}
              sub={`perp does ${compactUsd(pair.perpDailyQuoteVolumeUsd)}/24h`}
              tone="muted"
            />
          </>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {!showHedged ? (
            <section>
              <h2 className="text-sm font-semibold text-ink">What you are holding</h2>
              <div className="mt-3 rounded-xl border border-warn-line bg-warn-soft p-5">
                <p className="text-sm leading-relaxed text-warn">
                  {pair.base}x is <strong className="font-semibold">unhedged</strong>. It is equity
                  beta: you take the full move in {pair.base}, plus trading fees, minus what
                  arbitrageurs take when the pool lags the feed. If {pair.base} falls 20%, this
                  falls roughly 20%.
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <Row label={`${pair.base} 30d`} value={pct(pair.x.stockMovePct, 1)} />
                  <Row label="Fees" value={signedUsd(pair.x.feesEarnedUsd)} tone="positive" />
                  <Row label="Arb loss" value={signedUsd(pair.x.arbLossUsd)} tone="negative" />
                </dl>
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="text-sm font-semibold text-ink">Position</h2>
            <div className="mt-3 rounded-xl border border-line bg-panel p-5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink-3">Range vs feed</span>
                <span className={inRange ? "text-pos" : "text-neg"}>
                  {inRange ? "In range" : "Out of range"}
                </span>
              </div>
              <RangeBar lower={pair.x.rangeLower} upper={pair.x.rangeUpper} spot={pair.x.spot} />
              <div className="tnum mt-2 flex justify-between text-xs text-ink-3">
                <span>{usd(pair.x.rangeLower)}</span>
                <span className="text-ink">spot {usd(pair.x.spot)}</span>
                <span>{usd(pair.x.rangeUpper)}</span>
              </div>
              <p className="mt-3 text-xs text-ink-3">
                The LP position lives in {pair.base}x either way — the hedged vault holds shares of
                it, not a second position.
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm">
                <Row label="Fees earned" value={signedUsd(pair.x.feesEarnedUsd)} tone="positive" />
                <Row label="Arb loss" value={signedUsd(pair.x.arbLossUsd)} tone="negative" />
                {showHedged ? (
                  <>
                    <Row label="Hedge PnL" value={signedUsd(h.hedgePnlUsd)} tone="positive" />
                    <Row label="Funding" value={signedUsd(h.fundingPaidUsd)} tone="negative" />
                  </>
                ) : null}
              </dl>
            </div>
          </section>

          {showHedged ? (
            <section>
              <h2 className="text-sm font-semibold text-ink">Share price</h2>
              <div className="mt-3 rounded-xl border border-line bg-panel p-5">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-3">Floor NAV</div>
                    <div className="tnum mt-1 text-xl font-semibold text-ink">
                      {usd(h.floorNavPerShare, 4)}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-3">
                      Built only from what the contract can price on-chain. Mints and redemptions
                      use this.
                    </p>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-3">
                      Attested NAV
                    </div>
                    <div className="tnum mt-1 text-xl font-semibold text-ink-2">
                      {usd(h.attestedNavPerShare, 4)}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-3">
                      Includes hedge equity inside Lighter&rsquo;s rollup, which Robinhood Chain
                      cannot read. Display only.
                    </p>
                  </div>
                </div>
                <p className="mt-4 rounded-lg border border-line bg-inset p-3 text-xs leading-relaxed text-ink-2">
                  The gap is{" "}
                  <span className="tnum text-ink">
                    {pct(h.attestedNavPerShare / h.floorNavPerShare - 1)}
                  </span>
                  . It is not a fee — it is the part of the vault nobody can prove on-chain, so the
                  contract refuses to sell it to you or buy it back from you.
                </p>
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="text-sm font-semibold text-ink">Decisions</h2>
            <ol className="mt-3 space-y-px overflow-hidden rounded-xl border border-line">
              {decisions.map((d) => (
                <li
                  key={`${d.at}-${d.action}`}
                  className="flex flex-wrap gap-x-4 gap-y-1 bg-panel px-4 py-3 text-sm"
                >
                  <span className="tnum w-36 shrink-0 text-xs text-ink-3">{utc(d.at)}</span>
                  <span className="w-14 shrink-0 text-xs font-medium text-ink-2">{d.vault}</span>
                  <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-ink-2">
                    {d.action}
                  </span>
                  <span className="flex-1 text-ink-2">{d.detail}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-5">
          {showHedged ? (
            <>
              <HedgedDeposit pair={pair} h={h} />
              <HedgedRedeem pair={pair} h={h} shares={hShares} />
            </>
          ) : (
            <>
              <UnhedgedDeposit pair={pair} />
              <UnhedgedWithdraw pair={pair} shares={xShares} />
            </>
          )}

          <div className="rounded-xl border border-line bg-panel p-5 text-sm">
            <h3 className="text-sm font-semibold text-ink">Your balances</h3>
            <dl className="mt-3 space-y-2">
              <Row label={`${pair.base}x (unhedged)`} value={num(xShares)} />
              <Row
                label={`${pair.base}h (hedged)`}
                value={canHedge ? num(hShares) : "not deployed"}
                muted={!canHedge}
              />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  hedged,
  setHedged,
  disabled,
  pair,
}: {
  hedged: boolean;
  setHedged: (v: boolean) => void;
  disabled: boolean;
  pair: Pair;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-inset p-1">
      <button
        onClick={() => setHedged(false)}
        className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
          !hedged ? "bg-inverse text-on-inverse" : "text-ink-2 hover:text-ink"
        }`}
      >
        Unhedged · {pair.base}x
      </button>
      <button
        onClick={() => setHedged(true)}
        disabled={disabled}
        title={
          disabled ? "hedgeAvailable() is false — the hedged vault does not exist yet" : undefined
        }
        className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
          hedged ? "bg-inverse text-on-inverse" : "text-ink-2 hover:text-ink"
        } disabled:cursor-not-allowed disabled:text-ink-4 disabled:hover:text-ink-4`}
      >
        Hedged · {pair.base}h
      </button>
    </div>
  );
}

function RangeBar({ lower, upper, spot }: { lower: number; upper: number; spot: number }) {
  // Pad the axis so the range occupies the middle ~70% of the bar.
  const span = upper - lower;
  const min = lower - span * 0.2;
  const max = upper + span * 0.2;
  const toPct = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div className="relative mt-4 h-9">
      <div className="absolute inset-x-0 top-4 h-1 rounded bg-disabled" />
      <div
        className="absolute top-4 h-1 rounded bg-info-solid"
        style={{ left: `${toPct(lower)}%`, width: `${toPct(upper) - toPct(lower)}%` }}
      />
      <div
        className="absolute top-2 h-5 w-0.5 -translate-x-1/2 rounded bg-inverse"
        style={{ left: `${toPct(spot)}%` }}
      />
    </div>
  );
}
