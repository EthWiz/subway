// Tests must never reach a venue or an RPC: a screen that silently depends on
// a live endpoint is not reproducible, and a red build caused by someone
// else's outage teaches you to ignore red builds.
//
// Every number under research/generated/ came from a real run recorded as an
// artefact; tests replay those artefacts and fixtures, never the network.
import { register } from "node:module";

globalThis.fetch = () => {
  throw new Error("network access is disabled in tests (tests/support/no-network.mjs)");
};

void register;
