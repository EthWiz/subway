/**
 * A hover/focus tooltip that needs no JavaScript.
 *
 * Split into a trigger and a panel on purpose. The trigger lives in a table
 * header, inside a wrapper with `overflow-x: auto` — which forces the vertical
 * axis to clip too, so a panel rendered next to the trigger gets cut off by
 * the bottom of a short table. The panel therefore renders as a SIBLING of the
 * scroll container and is revealed with `group-has-*`, which is why the two
 * halves are wired by class name rather than by nesting.
 *
 * Put both inside one `group/tip relative` element:
 *
 *   <div className="group/tip relative">
 *     <div className="overflow-x-auto">…<InfoTipTrigger label="Fee APR*" />…</div>
 *     <InfoTipPanel>…</InfoTipPanel>
 *   </div>
 */
export function InfoTipTrigger({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <button
        type="button"
        aria-label={`How ${label} is calculated`}
        className="tip-trigger flex size-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-line-strong text-[9px] font-semibold leading-none text-ink-3 transition-colors hover:border-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-3"
      >
        ?
      </button>
    </span>
  );
}

export function InfoTipPanel({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none invisible absolute left-4 top-14 z-30 w-80 rounded-lg border border-line bg-panel p-3.5 text-left text-xs font-normal leading-relaxed text-ink-2 opacity-0 shadow-lg transition-opacity duration-150 group-has-[.tip-trigger:focus-visible]/tip:visible group-has-[.tip-trigger:focus-visible]/tip:opacity-100 group-has-[.tip-trigger:hover]/tip:visible group-has-[.tip-trigger:hover]/tip:opacity-100"
    >
      {children}
    </span>
  );
}
