const { Card, Stat, TokenMark, DataTable, KeyValue, Button, Badge, Callout, SegmentedControl, StatusPill, EpochTimer } = window.SubwayDesignSystem_44ed98;

function Portfolio({ onOpen }) {
  const d = window.SUBWAY_DATA;
  const [ratio, setRatio] = React.useState("25");
  return (
    <>
      <PageHead
        eyebrow="Portfolio · 0x4f2a…9c1b"
        title="Your shares, and the hedge ratio they imply"
        lede="Toggling hedge is a wrap or unwrap between the two share tokens. No LP position is closed or reopened."
        aside={<div style={{ display: "flex", gap: "var(--sp-8)" }}>
          <Stat label="Position value" value="$18,957" align="right" delta="+1.2%" hint="feed-priced" />
          <Stat label="Implied hedge ratio" value="24" unit="%" align="right" hint="hINTC ÷ total" />
        </div>}
      />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: "var(--gutter)", alignItems: "start" }}>
        <div style={{ display: "grid", gap: "var(--gutter)" }}>
          <Card title="Shares" subtitle="One row per share token, per pair" pad="none" style={{ padding: "var(--card-pad) 0 0" }}>
            <DataTable
              columns={[
                { key: "mark", label: "Share", mono: false, width: "34%" },
                { key: "balance", label: "Balance", align: "right" },
                { key: "value", label: "Value", align: "right" },
                { key: "pnl", label: "PnL", align: "right" },
                { key: "act", label: "", align: "right", mono: false },
              ]}
              rows={d.positions.map((p) => ({
                id: p.id,
                mark: <TokenMark ticker={p.ticker} hedged={p.hedged} size="sm" name={p.hedged ? "Hedged wrapper" : "Unhedged base vault"} />,
                balance: p.balance,
                value: p.value,
                pnl: <span style={{ color: p.pnlTone === "negative" ? "var(--neg)" : "var(--pos)" }}>{p.pnl}</span>,
                act: <Button size="sm" variant="secondary" onClick={() => onOpen(d.pairs.find((x) => x.ticker === p.ticker))}>Open</Button>,
              }))} />
          </Card>

          <Card title="Redemption queue" subtitle="Hedged side only">
            <EpochTimer epoch={412} countdown="04:12:08" progress={68} note="Claimable slots stay claimable — there is no expiry." />
            <div style={{ height: "var(--sp-5)" }} />
            <DataTable
              columns={[{ key: "slot", label: "Slot" }, { key: "shares", label: "Shares" }, { key: "requested", label: "Requested" }, { key: "status", label: "", mono: false, align: "right" }]}
              rows={d.queue.map((q) => ({
                ...q,
                status: q.status === "Claimable" ? <Button size="sm">Claim</Button> : <StatusPill state="pending" label="Queued" />,
              }))} />
          </Card>

          <Callout tone="info" title="Exits do not depend on the pool being unwound">
            An emergency exit from the hedged wrapper pays out in x-shares, not USDG — and the unhedged share is always redeemable out of the range.
          </Callout>
        </div>

        <div style={{ display: "grid", gap: "var(--gutter)" }}>
          <Card title="Set hedge ratio" subtitle="Wrap or unwrap, one transaction" pad="lg">
            <SegmentedControl fullWidth value={ratio} onChange={setRatio} options={[{ value: "0", label: "0%" }, { value: "25", label: "25%" }, { value: "50", label: "50%" }]} />
            <div style={{ height: "var(--sp-5)" }} />
            <KeyValue dense items={[
              { label: "Wrap", value: `${(Number(ratio) * 40).toFixed(0)} xINTC → hINTC` },
              { label: "LP touched", value: "none", tone: "positive" },
              { label: "Cap", value: "hINTC ≤ 50% of xINTC supply" },
            ]} />
            <div style={{ height: "var(--sp-5)" }} />
            <Button fullWidth size="lg">Apply ratio</Button>
          </Card>
          <Card title="Collateral" subtitle="Morpho Blue on Robinhood Chain" tone="sunken">
            <KeyValue dense items={[
              { label: "hINTC market", value: "not live yet", tone: "muted" },
              { label: "Oracle", value: "floor NAV via adapter" },
              { label: "LLTV", value: "conservative, TBD" },
            ]} />
            <div style={{ height: "var(--sp-4)" }} />
            <Button variant="secondary" fullWidth icon="external-link" disabled>Use as collateral</Button>
          </Card>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Portfolio });
