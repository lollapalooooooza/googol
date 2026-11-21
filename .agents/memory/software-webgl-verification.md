---
name: Software WebGL verification
description: Avoiding expensive image polling when checking interactive 3D camera behavior.
---

Observe the actual camera position/target for rotation and zoom assertions, then check a small number of screenshots and real image exports separately.

**Why:** Repeated full-resolution canvas PNG readbacks timed out in software-rendered tests even when failure screenshots showed that rotation had occurred. Longer timeouts and disabled trace filmstrips did not by themselves produce a reliable pass; renderer timeouts must not be reported as proven interaction failures or as successful verification.

**How to apply:** Keep GPU-heavy checks bounded and run them without simultaneous app edits or other 3D captures. Use camera state for gesture assertions, structural inspection for GLB exports, and an explicit screenshot/export check for visible output. A timed-out run remains unresolved until separately confirmed.
