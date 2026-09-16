import Link from "next/link";
import { MOCK_ADDRESS } from "@/lib/mock";
import { shortAddress } from "@/lib/format";

export function Nav() {
  return (
    <header className="border-b border-line">
      <nav className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight text-ink">
          Subway
        </Link>
        <div className="flex items-center gap-6 text-sm text-ink-2">
          <Link href="/" className="transition-colors hover:text-ink">
            Vaults
          </Link>
          <Link href="/portfolio" className="transition-colors hover:text-ink">
            Portfolio
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-line bg-panel-2 px-3 py-1.5 text-xs text-ink-2">
          <span className="size-1.5 rounded-full bg-pos-solid" />
          <span className="tnum">{shortAddress(MOCK_ADDRESS)}</span>
          <span className="text-ink-3">(mock)</span>
        </div>
      </nav>
    </header>
  );
}
