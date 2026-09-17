The vault list, queue and fills table. Hairline rows, mono numerics, no zebra striping.

```jsx
<DataTable
  columns={[{key:"pair",label:"Pair",mono:false},{key:"tvl",label:"TVL",align:"right"}]}
  rows={[{id:"nvda",pair:<TokenMark ticker="NVDA" size="sm" />,tvl:"$412,800"}]}
  onRowClick={(r) => …} />
```

Pass `mono:false` on columns holding names or components; everything numeric stays mono and right-aligned.
