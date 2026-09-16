import Link from "next/link";
import { Badge, Card, DataTable, KeyValue, Stat, StatusPill, TokenMark } from "@/ds";
import {
  MOCK_ADDRESS,
  POSITIONS,
  getPair,
  impliedHedgeRatio,
  previewRedeemAmounts,
} from "@/lib/mock";
import { num, shortAddress, usd, utc } from "@/lib/format";

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

  // A queue exists only where the hedged side does; mapping first narrows both.
  const queueCards = rows
    .map(({ position, pair }) =>
      position.queued && pair.h
        ? { slug: position.slug, queued: position.queued, base: pair.base, h: pair.h }
        : null,
    )
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // One row per share token, per pair — the hedged row only where it exists.
  const shareRows = rows.flatMap(({ position, pair }) => {
    const hedgedLive = pair.hedgeAvailable && pair.h !== null;
    const out = previewRedeemAmounts(pair.x, position.xShares);
    return [
      {
        id: `${pair.slug}-x`,
        share: (
          <Link href={`/vault/${pair.slug}`} className="plain-link">
            <TokenMark ticker={pair.base} size="sm" name="Unhedged base vault" />
          </Link>
        ),
        balance: num(position.xShares),
        value: usd(position.xShares * pair.x.navPerShare),
        redeems: `${num(out.stockOut, 4)} ${pair.base} + ${num(out.usdgOut, 2)} ${pair.quote}`,
        hedge: "0.00",
      },
      ...(hedgedLive
        ? [
            {
              id: `${pair.slug}-h`,
              share: (
                <Link href={`/vault/${pair.slug}`} className="plain-link">
                  <TokenMark ticker={pair.base} hedged size="sm" name="Hedged wrapper" />
                </Link>
              ),
              balance: num(position.hShares),
              value: usd(position.hShares * (pair.h?.floorNavPerShare ?? 0)),
              redeems: "at floor NAV, queued",
              hedge: (pair.h?.hedgeRatio ?? 0).toFixed(2),
            },
          ]
        : [
            {
              id: `${pair.slug}-h-absent`,
              share: (
                <span className="flex items-center gap-3">
                  <TokenMark ticker={pair.base} hedged size="sm" name="Hedged wrapper" />
                  <Badge tone="warning">Not deployed</Badge>
                </span>
              ),
              balance: "—",
              value: "—",
              redeems: "—",
              hedge: "—",
            },
          ]),
    ];
  });

  return (
    <>
      <header className="mb-6 max-w-[var(--maxw-prose)]">
        <div className="type-label mb-2 text-muted">Portfolio · {shortAddress(MOCK_ADDRESS)}</div>
        <h1 className="mb-2">Your shares, and the hedge ratio they imply</h1>
        <p className="type-body m-0 text-body">
          Your share balances, their value, and any queued redemptions.
        </p>
      </header>

      {/*
       * The balance breakdown reads as part of the headline figure, not as a
       * panel beside the detail: the unhedged and hedged legs sum to the
       * position value, so they belong on the same rule as it. Each leg names
       * the price it is struck at, which the system asks of every figure.
       */}
      <Card pad="lg">
        <div className="ds-stat-band">
          <Stat size="lg" label="Position value" value={usd(total)} hint="feed-priced, invented" />
          <Stat size="sm" label="Unhedged" value={usd(xValue)} hint="full equity beta" />
          <Stat size="sm" label="Hedged" value={usd(hValue)} hint="at floor NAV" />
          <Stat
            size="sm"
            label="Claimable now"
            value={claimable > 0 ? usd(claimable) : "—"}
            hint={claimable > 0 ? "settled, at floor NAV" : "nothing settled"}
          />
          <Stat
            size="sm"
            label="Implied hedge ratio"
            value={blendedHedge.toFixed(2)}
            hint="0.00 = full beta, 1.00 = flat"
          />
        </div>
      </Card>

      {/* Full width: five columns do not fit beside the 380px panel column. */}
      <div className="mt-[var(--section-gap)]">
        <Card
          title="Shares"
          subtitle="One row per share token, per pair"
          pad="none"
          style={{ padding: "var(--card-pad) 0 0" }}
        >
          <DataTable
            columns={[
              { key: "share", label: "Share", mono: false, width: "28%" },
              { key: "balance", label: "Balance", align: "right" },
              { key: "value", label: "Value", align: "right" },
              { key: "hedge", label: "Hedge ratio", align: "right" },
              { key: "redeems", label: "Redeems to", align: "right", mono: false },
            ]}
            rows={shareRows}
          />
        </Card>
      </div>

      {/*
       * Queues pair up two across; with one open request the card keeps the
       * width it reads well at rather than stretching a four-row KeyValue over
       * the full page.
       */}
      {queueCards.length > 0 && (
        <div className="mt-[var(--section-gap)] grid gap-6 lg:grid-cols-2">
          {queueCards.map(({ slug, queued, base, h }) => (
            <Card
              key={slug}
              title="Redemption queue"
              subtitle={`h${base} · hedged side only`}
              actions={
                queued.status === "claimable" ? (
                  <StatusPill state="live" label="Claimable" />
                ) : (
                  <StatusPill state="pending" label="Queued" />
                )
              }
            >
              <KeyValue
                items={[
                  { label: "Shares requested", value: `${num(queued.shares)} h${base}` },
                  { label: "Requested", value: utc(queued.requestedAt) },
                  {
                    label: queued.status === "claimable" ? "Settled" : "Settles",
                    value: utc(queued.claimableAt),
                  },
                  {
                    label: "Value at floor NAV",
                    value: usd(queued.shares * h.floorNavPerShare),
                    note: "Priced at the epoch, not at request time",
                  },
                ]}
              />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
