Modal for transaction confirmation, wallet connect and the jurisdiction gate.

```jsx
<Dialog title="Confirm deposit" subtitle="One Permit2 signature, one transaction"
  onClose={close} footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button>Deposit</Button></>}>
  …
</Dialog>
```

Omit `onClose` for gates the user must answer. Scrim is ink at 44% with a 2px blur.
