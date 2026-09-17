Binary toggle for settings that change one flag (auto-compound fees, testnet).

```jsx
<Switch checked={auto} onChange={setAuto} label="Auto-compound fees"
  description="Fees stay in the range instead of idling in the vault." />
```

For hedged vs unhedged use `SegmentedControl` — the two modes are different products, not a flag.
