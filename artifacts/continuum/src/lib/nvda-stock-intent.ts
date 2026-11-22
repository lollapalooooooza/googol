/**
 * Detects whether a prompt submitted from the bottom CommandDock while viewing
 * the Jensen Huang article/briefing is asking about NVDA / NVIDIA stock.
 */
const EXCLUDED_COMMANDS =
  /^(?:back|forward|reload|refresh|home|help|\?|select|draw|region|select region|selection|close tab|reopen|reopen tab|new tab|genie(?:\s+4)?\b|world\b|virtual tour\b|生成世界|世界模型)/i;

const STOCK_QUERY_PATTERNS: readonly RegExp[] = [
  // Direct ticker or stock keywords in English
  /\bnvda\b/i,
  /\bstocks?\b/i,
  /\bshare\s+price\b/i,
  /\bshares?\b/i,
  /\bmarket\s+cap\b/i,
  /\bticker\b/i,
  /\bvaluation\b/i,
  /\bnasdaq\b/i,
  // NVIDIA + price/chart/plunge/drop/reaction/performance
  /\bnvidia\b.*\b(?:price|chart|plunge|drop|crash|surge|rally|market|cap|reaction|impact|performance|trough|peak)\b/i,
  // Chinese stock/share/valuation queries
  /(?:股票|股价|股市|行情|市值|走势|暴跌|大跌)/,
];

export function isNvdaStockVideoIntent(rawInput: string): boolean {
  const cleaned = rawInput
    .trim()
    .replace(/^(?:@(?:argon|hydrogen)|\/(?:argon|hydrogen))\s+/i, "")
    .trim();
  if (!cleaned || cleaned.length > 160) return false;
  if (EXCLUDED_COMMANDS.test(cleaned)) return false;

  // Don't hijack explicit URLs or open/navigate commands unless clearly asking about stock
  if (/^https?:\/\//i.test(cleaned)) return false;

  return STOCK_QUERY_PATTERNS.some((pattern) => pattern.test(cleaned));
}
