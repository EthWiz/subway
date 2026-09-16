# research

Phase 0 evidence for `docs/plan.md` — a shared ERC-4626
vault that LPs a Robinhood Stock Token against USDG on Robinhood Chain (id 4663) and hedges the delta with a short on Lighter's Robinhood Chain perp
instance (`lighter-rh`).

**The verdict lives in the report, not in this index.** This directory holds
the dated report, its machine-emitted evidence, and the tooling that produced
it. The project README summarises what the report concluded.

## Reports

- `2026-09-16-hedgeability-and-pool-screen.md` — the structural screen. The
  current record for this family.

## Tooling

| File                  | Job                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `probe.ts`            | Registry × Lighter RH order books → per-name hedge depth, expressed as the largest vault each book can carry. One round trip.                        |
| `scan.ts`             | Discovers v3 pools from swap logs, classifies tokens by address, and measures fee income, active liquidity and the yield a $25K vault would receive. |
| `lib/hedgeability.ts` | Pure screen and `classifyPoolToken`.                                                                                                                 |
| `lib/markout.ts`      | Pure markout, horizon grading, and the plan's go/no-go.                                                                                              |
| `lib/poolscan.ts`     | Pure v3 decode, concentrated-liquidity valuation, range-splitting `fetchLogs`.                                                                       |
| `lib/rpcClient.ts`    | Serialised, backing-off JSON-RPC for chain 4663.                                                                                                     |
| `generated/`          | Machine outputs cited by the report.                                                                                                                 |

Tests are `tests/phase0.test.ts` and run on fixtures — no venue or
RPC access.

```bash
npx tsx research/probe.ts                    # structural screen
npx tsx research/scan.ts --minutes 15        # pool scan
```

The public RPC caps `eth_getLogs` at 10,000 matched logs and escalates from
429 to a 403 block under sustained load; `--gap-ms` widens the request spacing.
See the skill for the full operational notes.
