"use client";

import { useState } from "react";
import type { Pair, HedgedVaultState } from "@/lib/mock";
import { Field, Row } from "@/components/Field";
import { num, usd, utc } from "@/lib/format";

export function HedgedDeposit({ pair, h }: { pair: Pair; h: HedgedVaultState }) {
  const [amount, setAmount] = useState("");
  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const shares = valid ? parsed / h.floorNavPerShare : 0;
  const atAttested = valid ? parsed / h.attestedNavPerShare : 0;
  const giveUp = shares - atAttested;

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <h3 className="text-sm font-semibold text-ink">Deposit</h3>
      <p className="mt-1 text-xs text-ink-3">
        Routes {pair.quote} → {pair.base}x → {pair.base}h in one transaction.
      </p>

      <div className="mt-4">
        <Field label="Amount" value={amount} onChange={setAmount} suffix={pair.quote} />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Shares at floor NAV" value={valid ? num(shares, 4) : "—"} />
        <Row label="Floor NAV / share" value={usd(h.floorNavPerShare, 4)} />
        <Row label="Attested NAV / share" value={usd(h.attestedNavPerShare, 4)} muted />
      </dl>

      {valid ? (
        <p className="mt-4 rounded-lg border border-info-line bg-info-soft p-3 text-xs leading-relaxed text-info">
          You mint at the <strong className="font-semibold">floor</strong>, which deliberately
          undervalues the vault by excluding hedge equity it cannot price on-chain. You give up
          about {num(giveUp, 4)} shares ({usd(giveUp * h.floorNavPerShare)}) versus the attested
          NAV. That gap protects existing holders from a mint against an unverifiable number.
        </p>
      ) : null}

      <button
        disabled
        className="mt-4 w-full cursor-not-allowed rounded-lg bg-disabled px-4 py-2.5 text-sm font-semibold text-ink-3"
      >
        Connect wallet to deposit
      </button>
    </div>
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

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">Redeem</h3>
        <span className="tnum text-xs text-ink-3">
          {num(shares)} {pair.base}h held
        </span>
      </div>

      {stage === "idle" ? (
        <>
          <div className="mt-4">
            <Field label="Shares" value={amount} onChange={setAmount} suffix={`${pair.base}h`} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Row
              label="Estimated at floor NAV"
              value={valid ? usd(parsed * h.floorNavPerShare) : "—"}
            />
            <Row label="Settles at epoch" value={utc(h.nextEpochIso)} />
          </dl>
          <button
            onClick={() => setStage("requested")}
            disabled={!valid}
            className="mt-4 w-full rounded-lg bg-inverse px-4 py-2.5 text-sm font-semibold text-on-inverse transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
          >
            Request redemption (mock)
          </button>
        </>
      ) : null}

      {stage === "requested" ? (
        <div className="mt-4">
          <Steps active={1} />
          <p className="mt-4 text-xs leading-relaxed text-ink-2">
            Queued for epoch {utc(h.nextEpochIso)}. The keeper unwinds the hedge and withdraws from
            Lighter before it can pay you. A Lighter secure withdrawal is not instant, so the queue
            is real waiting, not a UI delay.
          </p>
          <button
            onClick={() => setStage("claimable")}
            className="mt-4 w-full rounded-lg border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink"
          >
            Simulate epoch settlement
          </button>
        </div>
      ) : null}

      {stage === "claimable" ? (
        <div className="mt-4">
          <Steps active={2} />
          <p className="mt-4 text-xs leading-relaxed text-ink-2">
            Settled at floor NAV. Claim is a single transaction and needs no keeper.
          </p>
          <button
            onClick={() => {
              setStage("idle");
              setAmount("");
            }}
            className="mt-4 w-full rounded-lg bg-pos-solid px-4 py-2.5 text-sm font-semibold text-on-inverse"
          >
            Claim {valid ? usd(parsed * h.floorNavPerShare) : ""} (mock)
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Steps({ active }: { active: number }) {
  const labels = ["Requested", "Queued", "Claimable"];
  return (
    <ol className="flex items-center gap-2">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 flex-col gap-1.5">
          <div className={`h-0.5 rounded ${i <= active ? "bg-pos-solid" : "bg-disabled"}`} />
          <span className={`text-[11px] ${i <= active ? "text-pos" : "text-ink-4"}`}>{l}</span>
        </li>
      ))}
    </ol>
  );
}
