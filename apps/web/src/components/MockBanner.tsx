import { Callout, Icon } from "@/ds";

/**
 * The standing notice that none of this is real.
 *
 * "Mock data." is the whole claim, and it is the part that has to be read; the
 * enumeration of what exactly is invented is a second question, so it sits
 * behind a disclosure that is closed on arrival. The warning band stays open
 * either way — the system puts risks in the flow, not in fine print, and a
 * notice nobody can see is fine print.
 */
export function MockBanner() {
  return (
    <Callout tone="warning">
      <details className="ds-disclosure">
        <summary style={{ color: "var(--warn)" }}>
          Mock data.
          {/* Wrapped rather than classed: the system's Icon takes name/size/style only. */}
          <span className="ds-disclosure-chevron inline-flex" style={{ opacity: 0.7 }}>
            <Icon name="chevron-down" size={14} />
          </span>
        </summary>
        <p className="m-0">
          No contract is deployed on Robinhood Chain, no addresses are pinned, and the keeper does
          not exist. The hedged vault (hAMC) does not exist yet — on-chain,{" "}
          <code>hedgeAvailable()</code> is false for every pair and the hedged paths revert. Fee
          APRs are extrapolated from one ~15-minute pre-open window on 2026-09-16, and decay.
          Balances, NAV, queues and PnL are invented.
        </p>
      </details>
    </Callout>
  );
}
