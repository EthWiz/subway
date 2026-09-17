The system's action control; use `primary` for the single committing action in a panel (Deposit, Request redemption).

```jsx
<Button variant="primary" size="lg" fullWidth>Deposit</Button>
<Button variant="secondary" icon="external-link">View on Blockscout</Button>
```

Variants: `primary` (vermilion), `secondary` (bordered paper), `inverse` (ink, marketing CTAs), `ghost` (toolbars), `danger` (emergency redeem / panic paths). Hover lightens the accent; press nudges 0.5px down. Disabled drops to 42% opacity — used whenever a feed is stale or a cap binds.
