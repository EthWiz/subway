"use client";

import { useState } from "react";
import type { DecisionEntry, Pair, Position } from "@/lib/mock";
import {
  Badge,
  Button,
  Callout,
  Card,
  DataTable,
  KeyValue,
  RangeMeter,
  SegmentedControl,
  Stat,
  StatusPill,
  Tabs,
  TokenMark,
  Tooltip,
} from "@/ds";
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
  const [mode, setMode] = useState<"x" | "h">("x");
  const [tab, setTab] = useState("position");

  const h = pair.h;
  // Mirrors `Router.hedgeAvailable(stock)`; the hedged paths revert without it.
  const canHedge = pair.hedgeAvailable && h !== null;
  const showHedged = mode === "h" && canHedge && h !== null;

  const xShares = position?.xShares ?? 0;
  const hShares = position?.hShares ?? 0;
  const inRange = pair.x.spot >= pair.x.rangeLower && pair.x.spot <= pair.x.rangeUpper;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <TokenMark
          ticker={pair.base}
          hedged={showHedged}
          size="lg"
          name={`${pair.base}/${pair.quote} · ${pct(pair.feeTier, 3)} pool`}
        />
        <StatusPill
          state={pair.x.paused ? "paused" : inRange ? "live" : "pending"}
          label={pair.x.paused ? "Deposits paused" : inRange ? "In range" : "Out of range"}
          pulse={!pair.x.paused && inRange}
        />
        {!canHedge ? <Badge tone="warning">Hedged side not deployed</Badge> : null}

        <div className="ml-auto flex flex-wrap gap-8">
          {showHedged ? (
            <>
              <Stat
                label="hAMC TVL"
                value={compactUsd(h.tvlUsd)}
                align="right"
                size="sm"
                hint="invented"
              />
              <Stat
                label="Hedge ratio"
                value={h.hedgeRatio.toFixed(2)}
                align="right"
                size="sm"
                hint="target 1.00"
              />
              <Stat
                label="Floor NAV"
                value={usd(h.floorNavPerShare, 4)}
                align="right"
                size="sm"
                hint={`attested ${usd(h.attestedNavPerShare, 4)}`}
              />
              <Stat
                label="Queue"
                value={compactUsd(h.queueDepthUsd)}
                align="right"
                size="sm"
                hint={`${h.queuedRedemptions} requests · ${utc(h.nextEpochIso).slice(5)}`}
              />
            </>
          ) : (
            <>
              <Stat
                label="xAMC TVL"
                value={compactUsd(pair.x.tvlUsd)}
                align="right"
                size="sm"
                hint="invented"
              />
              <Stat
                label="Fee APR 24h"
                value={pct(pair.trailingFeeApr, 1)}
                align="right"
                size="sm"
                hint="trailing, decays"
              />
              <Stat
                label="NAV / share"
                value={usd(pair.x.navPerShare, 5)}
                align="right"
                size="sm"
                hint="feed prices, pool mix"
              />
              <Stat
                label="TVL ceiling"
                value={compactUsd(pair.maxVaultTvlUsd)}
                align="right"
                size="sm"
                hint={`perp does ${compactUsd(pair.perpDailyQuoteVolumeUsd)}/24h`}
              />
            </>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as "x" | "h")}
          ariaLabel="Share type"
          options={[
            { value: "x", label: "Unhedged", sublabel: `x${pair.base}` },
            {
              value: "h",
              label: "Hedged",
              sublabel: `h${pair.base}`,
              disabled: !canHedge,
              title: canHedge
                ? undefined
                : "hedgeAvailable() is false — the hedged vault does not exist yet",
            },
          ]}
        />
        <p className="type-body-sm m-0 text-muted">
          {canHedge ? (
            <>
              Toggling is a wrap or unwrap — no LP position is closed or reopened. Preview only: on
              chain <code>hedgeAvailable()</code> is false for this pair too.
            </>
          ) : (
            <>
              <code>hedgeAvailable()</code> is false — the hedged vault is not built yet, and its
              deposit and redeem paths revert <code>HedgedVaultNotDeployed</code>.
            </>
          )}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-6">
          <Card
            title="Range vs feed"
            subtitle={`The LP position lives in x${pair.base} either way — the hedged vault holds shares of it, not a second position.`}
          >
            <RangeMeter
              lower={pair.x.rangeLower}
              upper={pair.x.rangeUpper}
              price={pair.x.spot}
              inRange={inRange}
              lowerLabel={usd(pair.x.rangeLower)}
              upperLabel={usd(pair.x.rangeUpper)}
              priceLabel={`${usd(pair.x.spot)} at feed`}
            />

            <div className="h-5" />

            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "position", label: "Position" },
                ...(showHedged
                  ? [{ value: "queue", label: "Queue", count: h.queuedRedemptions }]
                  : []),
                { value: "decisions", label: "Decisions", count: decisions.length },
              ]}
            />

            <div className="pt-4">
              {tab === "position" && (
                <KeyValue
                  items={[
                    {
                      label: "Fees earned",
                      value: signedUsd(pair.x.feesEarnedUsd),
                      tone: "positive",
                    },
                    { label: "Arb loss", value: signedUsd(pair.x.arbLossUsd), tone: "negative" },
                    ...(showHedged
                      ? [
                          {
                            label: "Hedge PnL, unsettled",
                            value: signedUsd(h.hedgePnlUsd),
                            note: "Counted as zero in the floor",
                          },
                          {
                            label: "Funding paid",
                            value: signedUsd(h.fundingPaidUsd),
                            tone: "negative" as const,
                          },
                          { label: "Hedge ratio", value: `${h.hedgeRatio.toFixed(2)} of LP delta` },
                        ]
                      : [
                          { label: `${pair.base} move, 30d`, value: pct(pair.x.stockMovePct, 1) },
                          { label: "Equity beta", value: `1.00 — tracks ${pair.base}` },
                          { label: "convertToAssets", value: "exact, feed-priced" },
                        ]),
                  ]}
                />
              )}

              {tab === "queue" && showHedged && (
                <KeyValue
                  items={[
                    { label: "Depth", value: compactUsd(h.queueDepthUsd) },
                    { label: "Requests", value: String(h.queuedRedemptions) },
                    { label: "Settles at", value: utc(h.nextEpochIso) },
                    {
                      label: "Priced at",
                      value: "Floor NAV at the epoch",
                      note: "Not the NAV at the time you requested",
                    },
                  ]}
                />
              )}

              {tab === "decisions" && (
                <DataTable
                  emptyLabel="No keeper decisions recorded"
                  columns={[
                    { key: "at", label: "Time", width: "22%" },
                    { key: "vault", label: "Vault", mono: false, width: "12%" },
                    { key: "action", label: "Action", mono: false, width: "18%" },
                    { key: "detail", label: "Why", mono: false, wrap: true },
                  ]}
                  rows={decisions.map((d) => ({
                    id: `${d.at}-${d.action}`,
                    at: utc(d.at),
                    vault: d.vault,
                    action: d.action,
                    detail: <span style={{ color: "var(--text-body)" }}>{d.detail}</span>,
                  }))}
                />
              )}
            </div>
          </Card>

          {showHedged ? (
            <Card
              title="Share price"
              subtitle="Two NAVs, because only one of them is provable on-chain"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <div className="type-label text-muted">Floor NAV</div>
                  <div className="type-num-lg mt-1.5 text-strong">{usd(h.floorNavPerShare, 4)}</div>
                  <p className="type-body-sm m-0 mt-2 text-muted">
                    Built only from what the contract can price on-chain. Mints and redemptions use
                    this.
                  </p>
                </div>
                <div>
                  <div className="type-label text-muted">Attested NAV</div>
                  <div className="type-num-lg mt-1.5 text-muted">
                    {usd(h.attestedNavPerShare, 4)}
                  </div>
                  <p className="type-body-sm m-0 mt-2 text-muted">
                    Includes hedge equity inside Lighter&rsquo;s rollup, which Robinhood Chain
                    cannot read. Display only.
                  </p>
                </div>
              </div>

              <div className="h-5" />

              <Callout tone="info" title="The gap is not a fee">
                <Tooltip content="Idle balances + xShare value at the feed + margin × (1 − haircut). Unsettled hedge PnL counts as zero.">
                  The floor
                </Tooltip>{" "}
                sits {pct(h.attestedNavPerShare / h.floorNavPerShare - 1)} below the attested NAV.
                That is the part of the vault nobody can prove on-chain, so the contract refuses to
                sell it to you or buy it back from you. Depositors mint at the floor, so they are
                mildly underpaid — which is exactly what makes deposit-time manipulation pointless.
              </Callout>
            </Card>
          ) : (
            <Callout tone="warning" title="This is equity beta, not a stable claim">
              x{pair.base} tracks {pair.base}, plus fees, minus what arbitrageurs take when the pool
              lags the feed. If {pair.base} falls 20%, this falls roughly 20%. Hedging removes
              direction, not impermanent loss.
            </Callout>
          )}
        </div>

        <div className="grid gap-6 lg:sticky lg:top-5">
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

          <Card title="Your balances" tone="sunken">
            <KeyValue
              dense
              items={[
                { label: `x${pair.base} · unhedged`, value: num(xShares) },
                {
                  label: `h${pair.base} · hedged`,
                  value: canHedge ? num(hShares) : "not deployed",
                  tone: canHedge ? "default" : "muted",
                },
              ]}
            />
            <div className="h-4" />
            <Button
              variant="secondary"
              fullWidth
              icon="external-link"
              disabled
              title="No contract is deployed"
            >
              View pool on Blockscout
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
