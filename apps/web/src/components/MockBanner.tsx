export function MockBanner() {
  return (
    <div className="border-b border-warn-line bg-warn-soft px-6 py-2.5 text-[13px] leading-relaxed text-warn">
      <span className="font-semibold text-warn-strong">Mock data.</span> No contract is deployed on
      Robinhood Chain, no addresses are pinned, and the keeper does not exist. The hedged vault
      (hAMC) does not exist yet — on-chain, <code>hedgeAvailable()</code> is false for every pair
      and the hedged paths revert. Fee APRs are extrapolated from one ~15-minute pre-open window on
      2026-09-16. Balances, NAV, queues and PnL are invented.
    </div>
  );
}
