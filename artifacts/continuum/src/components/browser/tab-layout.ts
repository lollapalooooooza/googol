/** The new-tab button stays outside the scrolling strip at every density. */
export function tabLayout(available: number, count: number) {
  const gaps = Math.max(0, count - 1) * 4;
  const overflow = available > 0 && count * 56 + gaps > available - 38;
  const room = Math.max(0, available - 38 - (overflow ? 62 : 0));
  const width = available ? Math.max(56, Math.min(230, (room - gaps) / Math.max(1, count))) : 200;
  return { overflow, width };
}
