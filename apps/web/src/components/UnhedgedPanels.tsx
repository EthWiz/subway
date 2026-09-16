"use client";

import { useState } from "react";
import type { Pair } from "@/lib/mock";
import { previewRedeemAmounts } from "@/lib/mock";
import { Field, Row } from "@/components/Field";
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
    <div className="rounded-xl border border-line bg-panel p-5">
      <h3 className="text-sm font-semibold text-ink">Deposit</h3>
      <p className="mt-1 text-xs text-ink-3">
        Either token, or both. Immediate — there is no queue on {pair.base}x.
      </p>

      <div className="mt-4 space-y-3">
        <Field label="Stock" value={stock} onChange={setStock} suffix={pair.base} />
        <Field label="Quote" value={usdg} onChange={setUsdg} suffix={pair.quote} />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Deposit value" value={valid ? usd(valueUsd) : "—"} />
        <Row label="Shares out" value={valid ? num(shares, 4) : "—"} />
        <Row label="NAV / share" value={usd(pair.x.navPerShare, 5)} muted />
      </dl>

      <button
        disabled
        className="mt-4 w-full cursor-not-allowed rounded-lg bg-disabled px-4 py-2.5 text-sm font-semibold text-ink-3"
      >
        {pair.x.paused ? "Deposits paused" : "Connect wallet to deposit"}
      </button>
      <p className="mt-2 text-center text-[11px] text-ink-4">
        Disabled: no contract deployed. Real flow is one Permit2 signature + one tx.
      </p>
      <p className="mt-2 rounded-lg border border-warn-line bg-warn-soft p-2.5 text-[11px] leading-relaxed text-warn">
        Deposit pricing is not settled. First-deposit donation, no <code>minShares</code>, and a
        value-space mint against a quantity-space redeem are all open in{" "}
        <code>docs/decisions.md</code>. Treat the share count above as indicative.
      </p>
    </div>
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
  const out = previewRedeemAmounts(pair.x, valid ? parsed : 0);

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">Withdraw</h3>
        <span className="tnum text-xs text-ink-3">{num(shares)} held</span>
      </div>

      <div className="mt-4">
        <Field label="Shares" value={amount} onChange={setAmount} suffix={`${pair.base}x`} />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label={`You receive (${pair.base})`} value={valid ? num(out.stockOut, 6) : "—"} />
        <Row label={`You receive (${pair.quote})`} value={valid ? num(out.usdgOut, 2) : "—"} />
        <Row
          label="Approx. value"
          value={valid ? usd(out.stockOut * pair.x.spot + out.usdgOut) : "—"}
          muted
        />
      </dl>

      <p className="mt-4 rounded-lg border border-line bg-inset p-3 text-xs leading-relaxed text-ink-2">
        You are paid in <strong className="font-semibold text-ink">both</strong> tokens, as a
        pro-rata slice of what the vault holds — idle balances, the range&rsquo;s pending fees, and
        your share of the LP principal. That split moves with the pool. Redemption reads no price at
        all, so a stale feed cannot trap you.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
        Fees earned by the range are swept into the vault before your slice is measured, so you are
        paid your share of them and no more. Redeeming early does not hand you the range&rsquo;s
        whole fee balance.
      </p>

      <button
        disabled
        className="mt-4 w-full cursor-not-allowed rounded-lg bg-disabled px-4 py-2.5 text-sm font-semibold text-ink-3"
      >
        Connect wallet to withdraw
      </button>
      <p className="mt-2 text-center text-[11px] text-ink-4">
        Immediate: one transaction, no epoch, no keeper.
      </p>
    </div>
  );
}
