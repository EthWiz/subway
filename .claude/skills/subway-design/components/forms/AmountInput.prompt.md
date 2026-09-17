Deposit/redeem amount field — 40px mono figure, ticker chip, balance and MAX.

```jsx
<AmountInput label="Deposit" asset="USDG" value={amt} onChange={setAmt}
  balance="12,480.00" usdValue="≈ $12,480 at feed" onMax={() => setAmt("12480")} />
```

Dual-asset deposits stack two of these with a hairline between. The `usdValue` line always names the price source ("at feed"), never an implied market price.
