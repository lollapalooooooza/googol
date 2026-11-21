---
name: Wikipedia reader scope
description: Why the reader does not reinterpret foreign-language article URLs, and a provider compatibility caveat.
---

Continuum currently reads English Wikipedia. A URL from another language must not be treated as a request for an English article with the same title.

**Why:** Identical titles can refer to different articles across language editions. Silently changing editions would misrepresent the requested source and its attribution.

**How to apply:** Keep foreign-language links external or explain the unsupported edition. Adding multilingual reading must carry the language through search, fetching, canonical URLs, revision links, and attribution together.

A failed refresh must not hide an already loaded Wikipedia article or search response.

**Why:** React Query can retain successful data while also reporting an error after a failed background request. Treating every error as a blocking failure hid genuine articles while their table of contents remained visible.

**How to apply:** Show a blocking failure only when no response is available for the current query. Keep previously loaded content visible with an honest refresh warning and retry control; never borrow another article's cached content or substitute authored samples.

The live MediaWiki provider announced deprecation of the older parse-section response in November 2026.

**Why:** Older API documentation and examples can still appear valid while the provider emits deprecation warnings.

**How to apply:** When extending content or table-of-contents handling, verify the current upstream response and warnings rather than assuming legacy examples are current.
