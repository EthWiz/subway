"use client";

import { useState } from "react";
import type { Pair } from "@/lib/mock";
import { previewRedeemAmounts } from "@/lib/mock";
import { AmountInput, Button, Callout, Card, KeyValue } from "@/ds";
import { num, usd } from "@/lib/format";

/**
 * `Router.deposit(stock, stockAmount, usdgAmount, false, receiver)`.
 * Both legs are optional, but at least one must be non-zero.
 */
export function UnhedgedDeposit({ pair }: { pair: Pair }) {
  const [stock, setStock] = useState("");
  const [usdg, setUsdg] = useState("");

  const s = Number.parseFloat(stock);
  const u = Number.parseFloat(usdg);
  const sv = Number.isFinite(s) && s > 0 ? s : 0;
  const uv = Number.isFinite(u) && u > 0 ? u : 0;
  const valueUsd = sv * pair.x.spot + uv;
  const shares = valueUsd / pair.x.navPerShare;
  const valid = valueUsd > 0;

  return (
    <Card
      pad="lg"
      title="Deposit"
      subtitle={`Either token, or both. Immediate — there is no queue on x${pair.base}.`}
    >
      <AmountInput
        label="Stock"
        asset={pair.base}
        value={stock}
        onChange={setStock}
        usdValue={sv > 0 ? `≈ ${usd(sv * pair.x.spot)} at feed` : undefined}
      />

      <div className="h-3" />

      <AmountInput label="Quote" asset={pair.quote} value={usdg} onChange={setUsdg} />

      <div className="h-4" />

      <KeyValue
        dense
        items={[
          { label: "Deposit value", value: valid ? usd(valueUsd) : "—" },
          { label: "Shares out", value: valid ? num(shares, 4) : "—" },
          { label: "NAV / share", value: usd(pair.x.navPerShare, 5), tone: "muted" },
        ]}
      />

      <div className="h-4" />

      <Callout tone="warning" title="Deposit pricing is not settled">
        First-deposit donation, no <code>minShares</code>, and a value-space mint against a
        quantity-space redeem are all open in <code>docs/decisions.md</code>. Treat the share count
        above as indicative.
      </Callout>

      <div className="h-4" />

      <Button fullWidth size="lg" disabled title="No contract is deployed">
        {pair.x.paused ? "Deposits paused" : "Connect wallet to deposit"}
      </Button>
      <p className="type-body-sm m-0 mt-3 text-center text-muted">
        Disabled: no contract deployed. The real flow is one Permit2 signature and one transaction.
      </p>
    </Card>
  );
}

/**
 * `BaseVault.redeem` pays BOTH tokens, pro-rata on quantities. The single-asset
 * ERC-4626 `withdraw`/`redeem` overloads revert `UseDualAssetRedeem`, so this
 * panel never shows one number.
 */
export function UnhedgedWithdraw({ pair, shares }: { pair: Pair; shares: number }) {
  const [amount, setAmount] = useState("");
  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= shares;
  const over = Number.isFinite(parsed) && parsed > shares;
  const out = previewRedeemAmounts(pair.x, valid ? parsed : 0);

  return (
    <Card pad="lg" title="Withdraw" subtitle="Immediate: one transaction, no epoch, no keeper.">
      <AmountInput
        label="Shares"
        asset={`x${pair.base}`}
        value={amount}
        onChange={setAmount}
        balance={num(shares)}
        onMax={() => setAmount(String(shares))}
        invalid={over}
        hint={over ? "More than you hold." : undefined}
      />

      <div className="h-4" />

      <KeyValue
        dense
        items={[
          { label: `You receive · ${pair.base}`, value: valid ? num(out.stockOut, 6) : "—" },
          { label: `You receive · ${pair.quote}`, value: valid ? num(out.usdgOut, 2) : "—" },
          {
            label: "Approximate value",
            value: valid ? usd(out.stockOut * pair.x.spot + out.usdgOut) : "—",
            tone: "muted",
          },
        ]}
      />

      <div className="h-4" />

      <Callout tone="positive" title="You are paid in both tokens">
        A pro-rata slice of what the vault holds — idle balances, the range&rsquo;s pending fees,
        and your share of the LP principal. That split moves with the pool. Redemption reads no
        price at all, so a stale feed cannot trap you. Fees are swept into the vault before your
        slice is measured, so you are paid your share of them and no more.
      </Callout>

      <div className="h-4" />

      <Button fullWidth size="lg" disabled title="No contract is deployed">
        Connect wallet to withdraw
      </Button>
    </Card>
  );
}
