The hedged/unhedged switcher and any 2–3 mode choice. Switching it swaps the whole panel, because the two modes genuinely differ.

```jsx
<SegmentedControl fullWidth value={mode} onChange={setMode}
  options={[{value:"x",label:"Unhedged",sublabel:"xNVDA"},{value:"h",label:"Hedged",sublabel:"hNVDA"}]} />
```
