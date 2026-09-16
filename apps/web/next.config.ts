import path from "node:path";
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This app lives in a git worktree whose parent checkout has its own lockfile;
  // pin the trace root so Next does not guess the wrong one.
  outputFileTracingRoot: path.join(import.meta.dirname, "..", ".."),
};

// Compiles content/docs/**.mdx and regenerates `.source` on change.
const withMDX = createMDX();

export default withMDX(nextConfig);
