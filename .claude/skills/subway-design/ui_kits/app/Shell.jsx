const { TopNav, Callout, Button, Card, Checkbox, Dialog, KeyValue, Badge } = window.SubwayDesignSystem_44ed98;

function Shell({ route, onNavigate, address, onConnect, children }) {
  return (
    <div style={{ minHeight: "100%", background: "var(--bg-page)" }}>
      <TopNav active={route} onNavigate={onNavigate} address={address} onConnect={onConnect} chainLabel={window.SUBWAY_DATA.chain} />
      <div style={{ maxWidth: "var(--maxw-page)", margin: "0 auto", padding: "var(--sp-8) var(--page-pad) var(--sp-11)" }}>{children}</div>
    </div>
  );
}

function PageHead({ eyebrow, title, lede, aside }) {
  return (
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--sp-8)", marginBottom: "var(--sp-7)", flexWrap: "wrap" }}>
      <div style={{ maxWidth: "var(--maxw-prose)" }}>
        {eyebrow && <div style={{ font: "var(--type-label)", letterSpacing: "var(--ls-label)", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>{eyebrow}</div>}
        <h1 style={{ marginBottom: lede ? "var(--sp-3)" : 0 }}>{title}</h1>
        {lede && <p style={{ margin: 0, font: "var(--type-body)", color: "var(--text-body)" }}>{lede}</p>}
      </div>
      {aside}
    </header>
  );
}

function ConnectGate({ open, onAccept }) {
  const [ack, setAck] = React.useState(false);
  return (
    <Dialog open={open} width={460} title="Before you connect" subtitle="Robinhood Stock Tokens are issued by Robinhood Assets (Jersey) and are not offered everywhere.">
      <Callout tone="danger" title="Jurisdiction">
        Not available to US, UK, Canadian or Swiss persons. Connecting is a self-attestation, checked again on deposit.
      </Callout>
      <div style={{ height: "var(--sp-5)" }} />
      <KeyValue dense items={[
        { label: "Chain", value: "Robinhood Chain · 4663" },
        { label: "Contracts", value: "Unaudited, undeployed", tone: "negative" },
        { label: "Status", value: "Closed beta, own capital" },
      ]} />
      <div style={{ height: "var(--sp-5)" }} />
      <Checkbox checked={ack} onChange={setAck} label="I am not a US, UK, Canadian or Swiss person" description="And I understand this software is unaudited." />
      <div style={{ height: "var(--sp-6)" }} />
      <Button fullWidth size="lg" disabled={!ack} onClick={onAccept} icon="wallet">Connect wallet</Button>
      <p style={{ margin: "var(--sp-4) 0 0", font: "var(--type-body-sm)", color: "var(--text-muted)", textAlign: "center" }}>Robinhood Wallet connects over WalletConnect.</p>
    </Dialog>
  );
}

Object.assign(window, { Shell, PageHead, ConnectGate });
