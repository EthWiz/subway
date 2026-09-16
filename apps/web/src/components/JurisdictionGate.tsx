"use client";

import { useEffect, useState } from "react";
import { Button, Callout, Checkbox, Dialog, KeyValue } from "@/ds";

const KEY = "subway.jurisdiction.attested";

/**
 * Self-attestation gate. Stock tokens are not offered to US/UK/CA/CH persons.
 *
 * Mock only: the real gate pairs this attestation with a geo check server-side.
 * localStorage is best-effort — if it throws, the gate simply shows again.
 *
 * `onClose` is deliberately not passed: the system marks a `Dialog` without it
 * as non-dismissable, which is what a gate is.
 */
export function JurisdictionGate() {
  const [ready, setReady] = useState(false);
  const [attested, setAttested] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setAttested(window.localStorage.getItem(KEY) === "1");
    } catch {
      setAttested(false);
    }
    setReady(true);
  }, []);

  function accept() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // Non-fatal: the gate reappears next load.
    }
    setAttested(true);
  }

  if (!ready || attested) return null;

  return (
    <Dialog
      width={460}
      title="Before you go on"
      subtitle="Robinhood Stock Tokens are issued by Robinhood Assets (Jersey) and are not offered everywhere."
    >
      <Callout tone="danger" title="Jurisdiction">
        Not available to US, UK, Canadian or Swiss persons. This is a self-attestation; in
        production it is paired with a server-side geo check and checked again on deposit.
      </Callout>

      <div className="h-4" />

      <KeyValue
        dense
        items={[
          { label: "Chain", value: "Robinhood Chain · 4663" },
          { label: "Contracts", value: "Unaudited, undeployed", tone: "negative" },
          { label: "This app", value: "Mock data, no wallet", tone: "muted" },
        ]}
      />

      <div className="h-4" />

      <Checkbox
        checked={checked}
        onChange={setChecked}
        label="I am not a US, UK, Canadian or Swiss person"
        description="And I understand this software is unaudited, undeployed, and custodies nothing."
      />

      <div className="h-5" />

      <Button fullWidth size="lg" disabled={!checked} onClick={accept}>
        Continue
      </Button>
    </Dialog>
  );
}
