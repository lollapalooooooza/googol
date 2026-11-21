# Browser regression checks

Start the existing `artifacts/continuum: web` managed workflow, then run from the workspace root:

```sh
pnpm --filter @workspace/continuum test
pnpm --filter @workspace/continuum test:typecheck
pnpm --filter @workspace/continuum test:models
```

Install the matching browser once if needed:

```sh
pnpm --filter @workspace/continuum exec playwright install chromium
```

The tests use the shared proxy at `http://localhost:80` (override with
`CONTINUUM_TEST_URL` for an already-running preview). On hosts with a managed
Chromium executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` instead of
downloading a browser. Replit's managed Chromium is detected automatically.
The suite never starts a duplicate dev server.

## What is covered

Every scenario runs in desktop Chromium and a 390px touch viewport. Additional
320px assertions check control bounds, horizontal overflow, zoom permission, accessible names,
keyboard operation, and WCAG A/AA rules using axe.

- Tab switching, active/inactive closure, closing all tabs, empty-state recovery,
  background links, blank tabs, keyboard tab navigation, and minimizing/restoring.
- Independent back/forward stacks, forward-branch truncation, last-closed
  restoration including the history cursor, keyboard shortcuts, and reloads.
- Masthead, address, command and new-tab search; direct titles, Wikipedia URLs,
  blank queries and no-result states, including back/forward through results pages.
- Bookmark addition, navigation, removal, deduplication and reload persistence.
- Default reading style, every text-size choice, typeface changes, cross-article
  application, reload persistence, corrupt saved values and storage denial.
- Selection-triggered preview close/reopen and readiness, viewer expansion, focus trapping, Escape, focus return,
  no-WebGL fallback, and selection/help cancellation.
- Canonical Plant cell/Neuron identity, aliases resolved by the article API,
  unsupported subjects, initial loading guards, and clearing a pending reveal on navigation.
- Real WebGL neuron rendering, keyboard part inspection, isolate/hide/reset,
  rotation, canvas and selection persistence across expansion, PNG download, and
  GLB content/part-name inspection. The original plant-cell direct link is retained.

Each test gets an isolated browser context. Only `/api/wiki/*` responses,
third-party fonts/images and (by default) WebGL availability are substituted. Fixtures intentionally contain minimal
contract-shaped test HTML; the real reader, query hooks, sanitization, links,
storage, popovers, animations and keyboard handlers run unchanged. No live
Wikipedia dependency or personal storage is used. Neuron rendering tests opt into
real WebGL through the `webglEnabled` fixture option; Chromium uses its software
renderer for portable checks. They also save an expanded-view screenshot.
These checks do not validate Wikipedia's upstream API or physical-device GPU
performance. Visual anatomical accuracy still requires image inspection.

Failure screenshots, traces and the HTML report are written under the ignored
`generated-artifacts/continuum/` directory. Inspect a failed run with:

```sh
pnpm --filter @workspace/continuum exec playwright show-report ../../generated-artifacts/continuum/playwright-report
```
