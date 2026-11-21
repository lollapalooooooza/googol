---
name: DOM numeric precision
description: Avoid treating serialized CSS percentages as full-precision numerical results in resource comparison regressions.
---

In DOM-based resource comparison tests, distinguish numerical conversion precision
from serialized CSS percentage precision.

**Why:** The jsdom CSS implementation serializes inline percentage widths to six
significant figures. Correct fractional-icon geometry can therefore lose decimal
places when read back through `style.width`, even though the calculation was not
rounded.

**How to apply:** Check precise conversions through independently expected
numeric labels or arithmetic output. Allow CSS serialization precision when
checking icon widths and reconstructed volume, while keeping tolerance much
smaller than rounding a pool total to the displayed caption.
