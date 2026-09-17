In-screen view switcher: Position / Policy / Decisions log on a vault page.

```jsx
<Tabs value={tab} onChange={setTab} tabs={[{value:"pos",label:"Position"},{value:"queue",label:"Queue",count:3}]} />
```

2px vermilion underline marks the active tab. Do not use Tabs for hedged/unhedged — that is `SegmentedControl`.
