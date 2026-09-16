const { DataTable, TokenMark, StatusPill, Stat, Card, Tag, Callout, Badge, Button } = window.SubwayDesignSystem_44ed98;

function VaultList({ onOpen }) {
  const [filter, setFilter] = React.useState("all");
  const pairs = window.SUBWAY_DATA.pairs;
  const shown = filter === "hedgeable" ? pairs.filter((p) => p.hedged) : filter === "live" ? pairs.filter((p) => p.state === "live") : pairs;
  const columns = [
    { key: "pair", label: "Share", mono: false, width: "30%" },
    { key: "tvl", label: "TVL", align: "right" },
    { key: "apr", label: "Fee APR 24h", align: "right" },
    { key: "hedge", label: "Hedge depth", align: "right" },
    { key: "share", label: "Share price", align: "right" },
    { key: "state", label: "State", align: "right", mono: false },
  ];
  const rows = shown.map((p) => ({
    id: p.id,
    pair: <TokenMark ticker={p.ticker} size="sm" name={p.pool} />,
    tvl: p.tvl, apr: p.apr, hedge: p.hedge, share: p.share,
    state: <StatusPill state={p.state} label={p.stateLabel} />,
    _pair: p,
  }));
  return (
    <>
      <PageHead
        eyebrow="Vaults · Robinhood Chain 4663"
        title="LP a stock token. Keep the fees, drop the direction."
        lede="Deposit a Robinhood Stock Token, USDG, or both. You receive a fungible share: xNVDA is equity beta plus fees, hNVDA is the same position with the delta hedged on Lighter."
        aside={<div style={{ display: "flex", gap: "var(--sp-8)" }}>
          <Stat label="TVL, all vaults" value="$689,380" align="right" hint="closed beta, own capital" />
          <Stat label="Names cleared" value="3 / 194" align="right" hint="of 18 hedgeable" />
        </div>}
      />
      <Callout tone="warning" title="Pre-launch. Nothing is deployed and no pair has been shown to be profitable." style={{ marginBottom: "var(--sp-7)" }}>
        The evidence gate rejected the three pairs this project started from. The figures below are from a 15-minute pre-open window and are extrapolations, not returns.
      </Callout>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-5)" }}>
        <Tag selected={filter === "all"} onClick={() => setFilter("all")}>All pairs</Tag>
        <Tag selected={filter === "hedgeable"} onClick={() => setFilter("hedgeable")}>Hedgeable</Tag>
        <Tag selected={filter === "live"} onClick={() => setFilter("live")}>In range</Tag>
        <span style={{ marginLeft: "auto", font: "var(--type-body-sm)", color: "var(--text-muted)" }}>Screened 2026-09-16 · 194 registered tokens, 57 Lighter RH perps</span>
      </div>
      <Card pad="none" style={{ padding: "var(--sp-5) 0 0", overflow: "hidden" }}>
        <DataTable columns={columns} rows={rows} onRowClick={(r) => onOpen(r._pair)} />
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "var(--gutter)", marginTop: "var(--sp-7)" }}>
        <Card title="Shares are the product" subtitle="ERC-4626, one per pair">
          <p style={{ margin: 0, font: "var(--type-body-sm)", color: "var(--text-body)" }}>A pooled vault mints a token you can post as collateral or wrap. Per-user vaults cannot produce that.</p>
        </Card>
        <Card title="Priced at the feed" subtitle="Never the pool tick">
          <p style={{ margin: 0, font: "var(--type-body-sm)", color: "var(--text-body)" }}>A pool tick is something an attacker can move with capital. A share price built on one is a share price they can print.</p>
        </Card>
        <Card title="No operator custody" subtitle="Lighter account owned by the vault">
          <p style={{ margin: 0, font: "var(--type-body-sm)", color: "var(--text-body)" }}>Secure withdrawals land only at the L1 owner, which is the contract. The keeper's key is trade-only by construction.</p>
        </Card>
      </div>
    </>
  );
}

Object.assign(window, { VaultList });
