const { Card, Button, SegmentedControl, AmountInput, KeyValue, RangeMeter, StatusPill, Stat, Callout, Tabs, TokenMark, Badge, EpochTimer, DataTable, Dialog, Tooltip, Switch, IconButton } = window.SubwayDesignSystem_44ed98;

function DepositPanel({ pair, mode }) {
  const hedged = mode === "h";
  const [amt, setAmt] = React.useState("");
  const [stock, setStock] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const [action, setAction] = React.useState("deposit");
  return (
    <Card pad="lg" style={{ position: "sticky", top: "var(--sp-5)" }}>
      <SegmentedControl fullWidth value={action} onChange={setAction} options={[{ value: "deposit", label: "Deposit" }, { value: "redeem", label: hedged ? "Request redemption" : "Withdraw" }]} style={{ marginBottom: "var(--sp-6)" }} />
      {action === "deposit" ? (
        <>
          <AmountInput label="USDG" asset="USDG" value={amt} onChange={setAmt} balance="12,480.00" usdValue="≈ $12,480 at feed" onMax={() => setAmt("12480")} />
          <div style={{ height: "var(--sp-4)" }} />
          <AmountInput label={`${pair.ticker} token`} asset={pair.ticker} value={stock} onChange={setStock} balance="0.00" hint="Single-asset is fine — the keeper rebalances the mix at the next range move." />
          <div style={{ height: "var(--sp-5)" }} />
          <KeyValue dense items={[
            { label: "You receive", value: `≈ ${amt ? (Number(amt.replace(/,/g, "")) / 1.0412).toFixed(2) : "0.00"} ${hedged ? "h" : "x"}${pair.ticker}` },
            { label: hedged ? "Minted at" : "Priced at", value: hedged ? "Floor NAV" : "Feed price" },
            { label: "Approvals", value: "1 Permit2 signature" },
          ]} />
          <div style={{ height: "var(--sp-5)" }} />
          <Button fullWidth size="lg" onClick={() => setConfirm(true)} disabled={!amt && !stock}>{hedged ? `Deposit into h${pair.ticker}` : `Deposit into x${pair.ticker}`}</Button>
        </>
      ) : (
        <>
          <AmountInput label="Shares to redeem" asset={`${hedged ? "h" : "x"}${pair.ticker}`} value={amt} onChange={setAmt} balance="11,904.12" onMax={() => setAmt("11904.12")} />
          <div style={{ height: "var(--sp-5)" }} />
          {hedged ? (
            <Callout tone="warning" title="This queues">Your slot settles at the next epoch NAV, after the keeper reduces the hedge pro rata and the Lighter withdrawal matures. Minutes normally; up to 14 days through the escape hatch.</Callout>
          ) : (
            <Callout tone="positive" title="Immediate">Your shares are paid out of your pro-rata slice of the range, including your share of accrued fees. No queue, no buffer, no keeper.</Callout>
          )}
          <div style={{ height: "var(--sp-5)" }} />
          <Button fullWidth size="lg" variant={hedged ? "secondary" : "primary"} onClick={() => setConfirm(true)} disabled={!amt}>{hedged ? "Request redemption" : "Withdraw"}</Button>
        </>
      )}
      <p style={{ margin: "var(--sp-4) 0 0", font: "var(--type-body-sm)", color: "var(--text-muted)" }}>
        {hedged ? "Wrapping does not close or reopen any LP position." : "You hold equity beta: this tracks the stock, plus fees, minus arb loss."}
      </p>
      <Dialog open={confirm} width={420} title={action === "deposit" ? "Confirm deposit" : hedged ? "Confirm request" : "Confirm withdrawal"} onClose={() => setConfirm(false)}
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button><Button onClick={() => setConfirm(false)}>Sign and send</Button></>}>
        <KeyValue dense items={[
          { label: "Route", value: hedged ? "Router → xVault → hVault" : "Router → xVault" },
          { label: "Amount", value: `${amt || "0.00"} ${action === "deposit" ? "USDG" : (hedged ? "h" : "x") + pair.ticker}` },
          { label: "Price source", value: "Chainlink feed" },
          { label: "Recipient", value: "your address (no recipient parameter exists)", tone: "muted" },
        ]} />
      </Dialog>
    </Card>
  );
}

function VaultDetail({ pair, onBack }) {
  const [mode, setMode] = React.useState("x");
  const [tab, setTab] = React.useState("position");
  const hedged = mode === "h";
  const d = window.SUBWAY_DATA;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", marginBottom: "var(--sp-6)" }}>
        <IconButton name="arrow-left" label="Back to vaults" variant="outline" onClick={onBack} />
        <TokenMark ticker={pair.ticker} hedged={hedged} size="lg" name={pair.pool} />
        <StatusPill state={pair.state} label={pair.stateLabel} pulse={pair.state === "live"} />
        {!pair.hedged && <Badge tone="warning">Hedged side unavailable</Badge>}
        <div style={{ marginLeft: "auto", display: "flex", gap: "var(--sp-8)" }}>
          <Stat label="TVL" value={pair.tvl} align="right" size="sm" />
          <Stat label="Fee APR 24h" value={pair.apr} align="right" size="sm" hint="trailing, decays" />
          <Stat label="Share price" value={pair.share} align="right" size="sm" hint={hedged ? "floor NAV" : "exact, on-chain"} />
        </div>
      </div>

      <SegmentedControl value={mode} onChange={setMode} style={{ marginBottom: "var(--sp-6)" }}
        options={[{ value: "x", label: "Unhedged", sublabel: `x${pair.ticker}` }, { value: "h", label: "Hedged", sublabel: `h${pair.ticker}` }]} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: "var(--gutter)", alignItems: "start" }}>
        <div style={{ display: "grid", gap: "var(--gutter)" }}>
          <Card title="Range vs feed" subtitle={`±6% around the feed, recentred at ±3% drift · feed ${pair.feedAge} old`}
            actions={<Button size="sm" variant="secondary" icon="external-link">Pool</Button>}>
            <RangeMeter lower={pair.lower} upper={pair.upper} price={pair.price} inRange={pair.state === "live"}
              lowerLabel={`$${pair.lower.toFixed(2)} −6%`} upperLabel={`$${pair.upper.toFixed(2)} +6%`} priceLabel={`$${pair.price.toFixed(2)} feed`} />
            <div style={{ height: "var(--sp-6)" }} />
            <Tabs value={tab} onChange={setTab} tabs={[{ value: "position", label: "Position" }, { value: "policy", label: "Policy" }, { value: "queue", label: "Queue", count: hedged ? d.queue.length : undefined }, { value: "log", label: "Decisions log" }]} />
            <div style={{ paddingTop: "var(--sp-5)" }}>
              {tab === "position" && (
                <KeyValue items={hedged ? [
                  { label: "Holds", value: `${pair.supply} x${pair.ticker}` },
                  { label: "Fees, trailing 24h", value: pair.fees24h, tone: "positive" },
                  { label: "Impermanent loss vs hold", value: pair.il, tone: "negative" },
                  { label: "Hedge ratio", value: "0.98 of LP delta" },
                  { label: "Hedge PnL, unsettled", value: "−$204", tone: "negative", note: "Counted as zero in the floor" },
                  { label: "Funding, 8h", value: "0.021%", note: "Unhedges above 0.1%" },
                  { label: "Margin ledger", value: "$38,400 of $46,000 cap" },
                  { label: "Floor NAV vs attested", value: "$1.0412 / $1.0448", tone: "muted" },
                ] : [
                  { label: "Stock in range", value: `${pair.supply} ${pair.ticker}` },
                  { label: "Fees, trailing 24h", value: pair.fees24h, tone: "positive" },
                  { label: "Impermanent loss vs hold", value: pair.il, tone: "negative" },
                  { label: "Equity beta", value: "1.00 — tracks the stock" },
                  { label: "Idle balances", value: "$2,104 USDG" },
                  { label: "convertToAssets", value: "exact, feed-priced" },
                  { label: "Pool share", value: `${pair.cap}` },
                ]} />
              )}
              {tab === "policy" && (
                <KeyValue items={[
                  { label: "Range preset", value: "±6% around feed, recenter at ±3%" },
                  { label: "Open gap", value: "pull 15 min before US open, reopen 10 min after" },
                  { label: "Weekend", value: "pull Fri 20:00 ET → Sun 20:00 ET" },
                  { label: "Feed staleness", value: "hold rebalances above 2h in RTH" },
                  { label: "Hedge band", value: "rehedge when |Δ| > 10% of notional" },
                  { label: "Hedge leverage", value: "3x · top up at 4x · alert at 5x" },
                  { label: "Caps", value: "vault ≤ 15% of pool TVL · maxMargin ≤ 40% of TVL" },
                  { label: "Hedged share cap", value: `h${pair.ticker} ≤ 50% of x${pair.ticker} supply` },
                ]} />
              )}
              {tab === "queue" && (hedged ? (
                <>
                  <EpochTimer epoch={pair.epoch} countdown="04:12:08" progress={68} note="Settles daily at 21:00 ET, after the close." />
                  <div style={{ height: "var(--sp-5)" }} />
                  <DataTable
                    columns={[{ key: "slot", label: "Slot" }, { key: "shares", label: "Shares" }, { key: "requested", label: "Requested" }, { key: "status", label: "Status", mono: false, align: "right" }]}
                    rows={d.queue.map((q) => ({ ...q, status: <StatusPill state={q.state} label={q.status} /> }))} />
                </>
              ) : (
                <Callout tone="positive" title="No queue on the unhedged side">Withdrawals settle out of the range synchronously. There is no epoch and no state a holder can be trapped in.</Callout>
              ))}
              {tab === "log" && (
                <DataTable
                  columns={[{ key: "at", label: "Time" }, { key: "what", label: "Action", mono: false }, { key: "why", label: "Why", mono: false, wrap: true }, { key: "tx", label: "Tx", align: "right" }]}
                  rows={d.log} />
              )}
            </div>
          </Card>

          {hedged ? (
            <Callout tone="info" title="Your share price is a floor">
              <Tooltip content="Idle balances + xShare value at the Chainlink feed + margin × (1 − haircut). Unsettled hedge PnL counts as zero.">The floor</Tooltip> can be too low, never too high. Depositors mint at it, so they are mildly underpaid — which is exactly what makes deposit-time manipulation pointless.
            </Callout>
          ) : (
            <Callout tone="warning" title="This is equity beta, not a stable claim">
              x{pair.ticker} tracks {pair.ticker}, plus fees, minus arbitrage loss. Hedging removes direction, not impermanent loss.
            </Callout>
          )}
        </div>

        <div style={{ display: "grid", gap: "var(--gutter)" }}>
          <DepositPanel pair={pair} mode={mode} />
          <Card title="Keeper" subtitle="Changes shape, never destination" tone="sunken">
            <KeyValue dense items={[
              { label: "Role", value: "bounded operator" },
              { label: "Can", value: "range, hedge size, margin within cap" },
              { label: "Cannot", value: "move funds anywhere" },
              { label: "Lighter key", value: "trade-only by construction" },
            ]} />
            <div style={{ height: "var(--sp-4)" }} />
            <Switch checked label="Auto-compound fees" description="Fees return to the range at the next move." />
          </Card>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { VaultDetail, DepositPanel });
