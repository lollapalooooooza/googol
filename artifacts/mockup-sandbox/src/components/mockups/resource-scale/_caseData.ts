/** Manually verified, dated fixtures. Never merge these accounting boundaries. */
export const GOOGLE_REPORT = "https://www.gstatic.com/gumdrop/sustainability/google-2024-environmental-report.pdf";
export const GOOGLE_ANNOUNCEMENT = "https://blog.google/outreach-initiatives/sustainability/2024-environmental-report/";
export const US_GALLON_LITRES = 3.785411784;
export const REFERENCE_POOL_LITRES = 2_500_000;

export type WaterMetric = "withdrawal" | "consumption";
export type WaterPeriod = "annual" | "daily";

export const DALLES = {
  name: "Google · The Dalles, Oregon",
  disclosureDate: "July 2, 2024",
  reportingPeriod: "January 1–December 31, 2023",
  days: 365,
  // Report p. 79: WATER USE BY DATA CENTER LOCATION, The Dalles, OR.
  withdrawal: 383_700_000,
  discharge: 81_300_000,
  consumption: 302_400_000,
  phase: "2023 operational location aggregate; not the new campus’s future full build-out",
  electricity: {
    status: "unavailable",
    explanation: "The selected disclosure gives no location-specific annual MWh, peak MW, or electricity baseline for The Dalles. Fleet totals and facility PUE ratios cannot supply that missing denominator.",
  },
} as const;

export function dallesWater(metric: WaterMetric, period: WaterPeriod) {
  const gallons = DALLES[metric] / (period === "daily" ? DALLES.days : 1);
  return {
    gallons,
    pools: gallons * US_GALLON_LITRES / REFERENCE_POOL_LITRES,
    poolsPerIcon: period === "daily" ? 1 : 25,
  };
}

export const COMPARISON_BOUNDARY = {
  electricity: "No electricity ranking: Louisiana’s reported ≈30% has no MW/MWh baseline; The Dalles has no compatible site electricity total in the selected disclosure. Generation MW, annual MWh and PUE are not interchangeable.",
  water: "No water ranking or combined total: Louisiana is a 2028 projection with an unspecified withdrawal/consumption boundary. The Dalles reports 2023 operational withdrawal and net consumption separately. The shared pool unit compares volume only, not equivalent demand or environmental impact.",
} as const;
