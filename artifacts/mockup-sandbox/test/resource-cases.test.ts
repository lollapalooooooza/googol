import assert from "node:assert/strict";
import { test } from "vitest";
import {
  COMPARISON_BOUNDARY,
  DALLES,
  GOOGLE_ANNOUNCEMENT,
  GOOGLE_REPORT,
  REFERENCE_POOL_LITRES,
  US_GALLON_LITRES,
  dallesWater,
} from "../src/components/mockups/resource-scale/_caseData";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test("dated primary sources distinguish disclosure year from accounting year", () => {
  assert.equal(DALLES.disclosureDate, "July 2, 2024");
  assert.equal(DALLES.reportingPeriod, "January 1–December 31, 2023");
  assert.match(GOOGLE_ANNOUNCEMENT, /^https:\/\/blog\.google\//);
  assert.match(GOOGLE_REPORT, /^https:\/\/www\.gstatic\.com\/.+2024.+\.pdf$/);
});

test("Google's three accounting values reproduce the primary table exactly", () => {
  assert.equal(DALLES.withdrawal, 383_700_000);
  assert.equal(DALLES.discharge, 81_300_000);
  assert.equal(DALLES.consumption, 302_400_000);
  assert.equal(DALLES.withdrawal - DALLES.discharge, DALLES.consumption);
});

test("withdrawal and net consumption convert separately, never as estimate bounds", () => {
  close(dallesWater("withdrawal", "annual").pools, 580.98500060832);
  close(dallesWater("consumption", "annual").pools, 457.88340939264);
  assert.notEqual(dallesWater("withdrawal", "annual").pools, dallesWater("consumption", "annual").pools);
});

test("daily values use 365 days of 2023 and retain the selected accounting measure", () => {
  for (const metric of ["withdrawal", "consumption"] as const) {
    const annual = dallesWater(metric, "annual");
    const daily = dallesWater(metric, "daily");
    assert.equal(daily.gallons, DALLES[metric] / 365);
    close(daily.pools, annual.pools / 365);
  }
});

test("pool dimensions and US-gallon units remain identical between cases", () => {
  assert.equal(REFERENCE_POOL_LITRES, 50 * 25 * 2 * 1000);
  assert.equal(US_GALLON_LITRES, 3.785411784);
});

test("icon count and fractional fill preserve volume without display rounding", () => {
  for (const metric of ["withdrawal", "consumption"] as const) {
    for (const period of ["annual", "daily"] as const) {
      const { pools, poolsPerIcon } = dallesWater(metric, period);
      const icons = pools / poolsPerIcon;
      const fills = Array.from({ length: Math.ceil(icons) }, (_, i) => Math.min(1, icons - i));
      assert.ok(fills.every(fill => fill > 0 && fill <= 1));
      close(fills.reduce((sum, fill) => sum + fill, 0) * poolsPerIcon, pools);
      assert.equal(poolsPerIcon, period === "annual" ? 25 : 1);
    }
  }
});

test("missing electricity is explicit, not a numeric zero or inherited Louisiana percentage", () => {
  assert.equal(DALLES.electricity.status, "unavailable");
  assert.match(DALLES.electricity.explanation, /no location-specific annual MWh, peak MW/);
  assert.match(DALLES.electricity.explanation, /Fleet totals.*PUE/);
  assert.equal(Object.values(DALLES.electricity).some(value => typeof value === "number"), false);
});

test("cross-case guardrails prohibit rankings and incompatible totals", () => {
  assert.match(COMPARISON_BOUNDARY.electricity, /No electricity ranking/);
  assert.match(COMPARISON_BOUNDARY.electricity, /MW.*MWh.*PUE/);
  assert.match(COMPARISON_BOUNDARY.water, /No water ranking or combined total/);
  assert.match(COMPARISON_BOUNDARY.water, /2028 projection/);
  assert.match(COMPARISON_BOUNDARY.water, /2023 operational/);
  assert.match(COMPARISON_BOUNDARY.water, /withdrawal and net consumption separately/);
});
