---
name: Accessible closable tabs
description: Avoiding invalid tablist ownership while retaining animated, independently closable tabs.
---

A generic or presentation wrapper does not remove its focusable close buttons from a tablist's owned children. Keep native close buttons separate from the tabs' semantic ownership; nesting them inside interactive tabs introduces a different accessibility failure.

**Why:** Browser accessibility trees flatten generic wrappers. A visually ordinary closable tab strip can therefore fail required-child rules even though each article button has the correct tab role.

**How to apply:** For future tab-strip changes, check semantic ownership as well as appearance. Preserve arrow-key navigation for tabs without intercepting modified history shortcuts. Animated removals must stop exposing the closing control as selected before their visual exit finishes.
