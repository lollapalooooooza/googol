---
name: Continuum reference fidelity
description: User-defined visual and content requirements for the browser and plant-cell experience.
---

The user requires the Runway Continuum demo's desktop/browser composition, rather than a loosely inspired reading app: tabs outside the browser, a separate bottom command box, a drag-selection rectangle with floating tools, and a feathered portal beside the selection.

**Why:** The user explicitly rejected the original approximation and requested the same design as their first supplied screenshot.

**How to apply:** Preserve this composition in subsequent UI changes. Use the supplied reference images when available, and do not claim pixel-perfect equivalence unless verified.

Exception to the original screenshots: omit the top-right desktop clock and account avatar.

**Why:** The user explicitly requested their removal after the reference-based header was built.

**How to apply:** Do not restore them when matching the older Runway references; allow the tab strip to use the freed header space.

Wikipedia content must come from real Wikipedia pages, with working article navigation, rather than authored summaries. Originally the starting topics were Plant cell, Neuron, Bacteria, and Animal cell; on 2026-11-14 the user requested Mars third and a sourced news/video page fourth.

**Why:** Real Wikipedia browsing was an explicit correction from the user, not an optional enhancement.

**How to apply:** Retain source attribution and redirects; explain that account/editing actions go to Wikipedia rather than simulating them. Distinguish any authored news briefing from genuine Wikipedia content rather than passing it off as an encyclopedia page.

The Jensen news page should follow a clean, professional newspaper layout with a white background and New York Times-inspired typography, not the cream scientific-exhibit styling. It must not contain an inner Wikipedia search bar.

**Why:** The user repeated these specific article-design requirements on 2026-11-14 after the initial briefing used exhibit colors and a search form.

**How to apply:** Keep the browser's outer address bar and other Wikipedia pages unchanged. Do not imply New York Times authorship. The user wants the news link to be `/news/jensen-huang`, without "continuum", and a dated, sourced relationship timeline rather than treating video captions as facts. For the portrait video, use soft edges and corners and a separate blurred playback dock below the image. Autoplay once after the reveal, muted for browser compatibility; never override a user's pause during enlargement.

Jensen timeline-entry selections should choose the relevant video scenes, including multiple clips when a selection spans entries. Other article text plays the entire uploaded video from the beginning; a timeline entry without a matching scene also falls back to the full video, with its limitation stated.

**Why:** The user requested smart clip picking, then explicitly clarified on 2026-11-15 that selecting other text should play the complete video. Reviewing its captions revealed conflicting ages and dates, so literal date matching would misrepresent the sourced article.

**How to apply:** Match by scene subject, keep the article's sourced chronology authoritative, label related illustrations as context rather than evidence, and say when a selected event has no corresponding scene. Do not promote unsupported romance, adoption, age or date captions into article facts.

The bottom command box should say exactly "ask veil anything".

**Why:** The user explicitly specified this product-facing wording on 2026-11-15.

**How to apply:** Preserve the lowercase wording; this is not a request to rename every existing Continuum reference.

The plant-cell reference is a detailed sculptural 3D cutaway, not a flat diagram. The user wants detailed organelles and meaningful interactive inspection.

**Why:** The user's second screenshot establishes the target model's physical depth, material detail, and control surface.

**How to apply:** Keep rotation, zoom, selection, and inspection functional; do not replace 3D geometry with a screenshot or SVG.

Each authored biology model must match the loaded article. Unsupported topics must say no model is available instead of borrowing a plant cell or inferring a subject from incidental words.

**Why:** The user prioritized a genuine neuron in the Neuron tab after the original portal reused the plant scene. Selecting text is a way to open a supported educational exhibit, not a promise of arbitrary AI generation.

**How to apply:** Use explicit resolved article identities. Keep illustrative anatomy, proportions, and non-universal features such as myelination clearly qualified, with sources available in part explanations.

The inline visualization portal must stay hidden until a user finishes dragging a valid region on an article page. It then takes three seconds to appear, using a breathing blur that resolves from blurred to clear. Supported visualizations may be authored 3D or a supplied video.

**Why:** The user explicitly corrected the always-visible preview and specified the exact reveal timing and animation.

**How to apply:** Never auto-open the inline portal on page load, search, or navigation. New selections restart the reveal; clearing or cancelling a selection also dismisses its portal. The user explicitly wants searching Mars to show the real article first, with the model appearing only after a drag.

Selection mode belongs inside the existing URL capsule, which becomes the dark “Select anywhere to generate” pill with a cancel button. Do not add separate selection-notification capsules.

**Why:** The user supplied a further Runway screenshot specifically to correct the location and appearance of this state.

**How to apply:** Restore the URL after selection ends or is cancelled, and keep article content clear of instructional pills.

Capsule transitions must resize the actual container width while text fades out/in at a fixed size. Keep selection mode relatively wide rather than dramatically compressing the URL field.

**Why:** The user rejected text stretching and exaggerated shrinking in the previous capsule animation.

**How to apply:** Do not use transform-based layout scaling on the capsule or text; use width interpolation with opacity-only content transitions.

Header tabs should resize like Google Chrome tabs when more are opened, rather than keeping fixed widths and immediately overflowing.

**Why:** The user explicitly requested Chrome-like automatic resizing while refining the header capsules.

**How to apply:** Distribute available width across tabs, truncate labels without scaling text, and keep the new-tab and close controls reachable when space runs out.

Portal controls should be minimal: border-hover move/resize handles, smooth centered expansion with the feathered border retained, icon-only actions at the top left, a compact view selector, and a horizontally scrollable organelle capsule at the bottom.

**Why:** The user explicitly asked for a cleaner, simpler UI and rejected the previous hard-edged expanded view and large control blocks. They repeated on 2026-11-14 that enlargement must not feel like a sudden refresh.

**How to apply:** Preserve the active 3D scene or video element, camera angle and playback position while resizing or expanding; do not replace the window with a separate full-screen viewer or re-run its loading reveal on collapse. Expansion should be one coordinated enlargement and move to the viewport center, with no bouncy overshoot or abrupt border/control changes.

Keep a stable WebGL drawing buffer during enlargement and uniformly scale the live scene rather than reallocating its buffer on every animation frame.

**Why:** The user again requested smoother enlargement on 2026-11-15; resizing the actual canvas with the portal made its GPU work compete with the window animation.

**How to apply:** Preserve the model's aspect ratio, orbit and interactive hit testing while animating its display size. Keep controls at their normal text/icon scale and reveal them after the move settles.

The bottom organelle capsule's chevron buttons must have circular backgrounds and equal outer padding, including the disabled buttons.

**Why:** The user specifically corrected the earlier oval buttons and uneven capsule insets.

**How to apply:** Keep the two arrow buttons square before applying a circular radius, and center them vertically within the capsule rather than within only its chip row.
