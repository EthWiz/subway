"use client";

import { useState } from "react";
import type { Pair, HedgedVaultState } from "@/lib/mock";
import { AmountInput, Button, Callout, Card, KeyValue } from "@/ds";
import { num, usd, utc } from "@/lib/format";

export function HedgedDeposit({ pair, h }: { pair: Pair; h: HedgedVaultState }) {
  const [amount, setAmount] = useState("");
  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const shares = valid ? parsed / h.floorNavPerShare : 0;
  const atAttested = valid ? parsed / h.attestedNavPerShare : 0;
  const giveUp = shares - atAttested;

  return (
    <Card
      pad="lg"
      title="Deposit"
      subtitle={`Routes ${pair.quote} → x${pair.base} → h${pair.base} in one transaction.`}
    >
      <AmountInput
        label="Amount"
        asset={pair.quote}
        value={amount}
        onChange={setAmount}
        usdValue={valid ? `≈ ${usd(parsed)} at feed` : undefined}
      />

      <div className="h-4" />

      <KeyValue
        dense
        items={[
          { label: "Shares at floor NAV", value: valid ? num(shares, 4) : "—" },
          { label: "Floor NAV / share", value: usd(h.floorNavPerShare, 4) },
          { label: "Attested NAV / share", value: usd(h.attestedNavPerShare, 4), tone: "muted" },
        ]}
      />

      {valid ? (
        <>
          <div className="h-4" />
          <Callout tone="info" title="You mint at the floor">
            The floor deliberately undervalues the vault by excluding hedge equity it cannot price
            on-chain. You give up about {num(giveUp, 4)} shares ({usd(giveUp * h.floorNavPerShare)})
            versus the attested NAV. That gap protects existing holders from a mint against an
            unverifiable number.
          </Callout>
        </>
      ) : null}

      <div className="h-4" />

      <Button fullWidth size="lg" disabled title="No contract is deployed">
        Connect wallet to deposit
      </Button>
    </Card>
  );
}

type Stage = "idle" | "requested" | "claimable";

export function HedgedRedeem({
  pair,
  h,
  shares,
}: {
  pair: Pair;
  h: HedgedVaultState;
  shares: number;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [amount, setAmount] = useState("");
  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= shares;
  const over = Number.isFinite(parsed) && parsed > shares;

  return (
    <Card pad="lg" title="Redeem" subtitle="Request, settle at the epoch, then claim.">
      {stage === "idle" ? (
        <>
          <AmountInput
            label="Shares"
            asset={`h${pair.base}`}
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
              {
                label: "Estimated at floor NAV",
                value: valid ? usd(parsed * h.floorNavPerShare) : "—",
              },
              { label: "Settles at epoch", value: utc(h.nextEpochIso) },
            ]}
          />

          <div className="h-4" />

          <Callout tone="warning" title="This queues">
            Your slot settles at the epoch NAV, after the keeper reduces the hedge pro rata and the
            Lighter withdrawal matures. A Lighter secure withdrawal is not instant, so the queue is
            real waiting, not a UI delay.
          </Callout>

          <div className="h-4" />

          <Button
            fullWidth
            size="lg"
            variant="secondary"
            disabled={!valid}
            onClick={() => setStage("requested")}
          >
            Request redemption (mock)
          </Button>
        </>
      ) : null}

      {stage === "requested" ? (
        <>
          <Steps active={1} />
          <div className="h-4" />
          <KeyValue
            dense
            items={[
              { label: "Requested", value: valid ? `${num(parsed)} h${pair.base}` : "—" },
              { label: "Epoch", value: utc(h.nextEpochIso) },
              { label: "Priced at", value: "Floor NAV at settlement", tone: "muted" },
            ]}
          />
          <div className="h-4" />
          <Button fullWidth size="lg" variant="secondary" onClick={() => setStage("claimable")}>
            Simulate epoch settlement
          </Button>
        </>
      ) : null}

      {stage === "claimable" ? (
        <>
          <Steps active={2} />
          <div className="h-4" />
          <Callout tone="positive" title="Settled at floor NAV">
            Claim is a single transaction and needs no keeper. Claimable slots stay claimable —
            there is no expiry.
          </Callout>
          <div className="h-4" />
          <Button
            fullWidth
            size="lg"
            onClick={() => {
              setStage("idle");
              setAmount("");
            }}
          >
            Claim {valid ? usd(parsed * h.floorNavPerShare) : ""} (mock)
          </Button>
        </>
      ) : null}
    </Card>
  );
}

/** Request → settle → claim, the vocabulary the protocol uses for this path. */
function Steps({ active }: { active: number }) {
  const labels = ["Requested", "Queued", "Claimable"];
  return (
    <ol className="m-0 flex list-none items-center gap-2 p-0">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 flex-col gap-1.5">
          <div
            className="h-0.5 rounded-full"
            style={{ background: i <= active ? "var(--accent)" : "var(--bg-sunken)" }}
          />
          <span
            className="type-label"
            style={{ color: i <= active ? "var(--accent-ink)" : "var(--text-faint)" }}
          >
            {l}
          </span>
        </li>
      ))}
    </ol>
  );
}
