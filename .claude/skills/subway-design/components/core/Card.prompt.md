Paper container for one idea — a deposit panel, a position block, a vault row group.

```jsx
<Card title="Deposit" subtitle="Dual-asset, valued at the Chainlink feed" actions={<Button size="sm" variant="ghost">Max</Button>}>
  …
</Card>
```

14px radius, 1px subtle border, `--shadow-1` at rest. `interactive` adds a 1px lift and `--shadow-2` on hover. Never stack two default Cards — nest with `tone="sunken"`.
