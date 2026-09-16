export function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</label>
      <div className="mt-1.5 flex items-center rounded-lg border border-line bg-inset focus-within:border-line-strong">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="tnum w-full bg-transparent px-3 py-2.5 text-lg text-ink outline-none placeholder:text-ink-4"
        />
        <span className="px-3 text-xs font-medium text-ink-3">{suffix}</span>
      </div>
    </div>
  );
}

export function Row({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "positive" | "negative";
}) {
  const cls =
    tone === "positive"
      ? "text-pos"
      : tone === "negative"
        ? "text-neg"
        : muted
          ? "text-ink-3"
          : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-3">{label}</dt>
      <dd className={`tnum ${cls}`}>{value}</dd>
    </div>
  );
}
