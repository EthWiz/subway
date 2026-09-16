"use client";

import { useEffect, useState } from "react";

const KEY = "subway.jurisdiction.attested";

/**
 * Self-attestation gate. Stock tokens are not offered to US/UK/CA/CH persons.
 *
 * Mock only: the real gate pairs this attestation with a geo check server-side.
 * localStorage is best-effort — if it throws, the gate simply shows again.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-line bg-panel p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-ink">Eligibility</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Robinhood Stock Tokens are not offered to persons in the United States, the United
          Kingdom, Canada or Switzerland. This app does not custody your assets and does not provide
          investment advice.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          In production this attestation is paired with a server-side geo check. Here it gates
          nothing but the mock UI.
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 size-4 accent-pos-solid"
          />
          <span>
            I confirm I am not a US, UK, Canadian or Swiss person, and I understand this is
            unaudited, undeployed software.
          </span>
        </label>

        <button
          onClick={accept}
          disabled={!checked}
          className="mt-5 w-full rounded-lg bg-inverse px-4 py-2.5 text-sm font-semibold text-on-inverse transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
