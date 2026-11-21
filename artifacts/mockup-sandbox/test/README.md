# Resource-scale regressions

From the repository root:

```sh
pnpm --filter @workspace/mockup-sandbox test
pnpm --filter @workspace/mockup-sandbox run typecheck
```

The test command runs once and exits nonzero on failure. It does not need a
running preview server, `PORT`, `BASE_PATH`, external articles, or network access.

`ResourceScale.test.tsx` renders the real component in jsdom. Independent numeric
fixtures follow `src/components/mockups/resource-scale/SOURCES.md`. Assertions
cover the normalized 100 + 30 squares, unrounded annual and daily pool volumes,
fractional icon widths, accessible labels, the separate pumping ceiling, and
native keyboard activation and DOM focus. No component, calculation, or user
interaction is mocked; only unavailable browser media-query support is stubbed.

These checks do not replace visual checks of CSS layout or mobile scrolling in a
real browser.
