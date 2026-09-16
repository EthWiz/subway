import { DataTable } from "@/ds";
import { REJECTED } from "@/lib/mock";

/**
 * The Phase 0 verdicts, read from the same fixture the app renders — so the
 * docs cannot drift from the screen a reader is looking at.
 */
export function RejectedPairs() {
  return (
    <DataTable
      columns={[
        { key: "base", label: "Pair", mono: false, width: "16%" },
        { key: "reason", label: "Verdict", mono: false, wrap: true },
      ]}
      rows={REJECTED.map((r) => ({
        id: r.base,
        base: <span style={{ color: "var(--neg)" }}>{r.base}</span>,
        reason: r.reason,
      }))}
    />
  );
}
