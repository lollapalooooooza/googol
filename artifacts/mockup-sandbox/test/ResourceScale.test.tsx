import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ResourceScale } from "../src/components/mockups/resource-scale/ResourceScale";

type Period = "annual" | "daily";
type Resource = "electricity" | "water";
type User = ReturnType<typeof userEvent.setup>;

// Independent expected results from SOURCES.md, not the implementation's
// constants/helpers: 500–600 million US gal × 3.785411784 L / 2,500,000 L.
// Daily figures divide the unrounded annual totals by 365.
const waterCases = {
  annual: {
    range: "757–909pool volumes / year",
    unit: 25,
    legend: "1 full icon = 25 reference pool volumes",
    rows: [
      { end: "lower", pools: 757.0823568, accessible: "757.082357", label: "757.1 pool volumes / year", icons: 31, lastFill: 28.3294272 },
      { end: "upper", pools: 908.49882816, accessible: "908.498828", label: "908.5 pool volumes / year", icons: 37, lastFill: 33.99531264 },
    ],
  },
  daily: {
    range: "2.1–2.5pool volumes / day",
    unit: 1,
    legend: "1 full icon = 1 reference pool volume",
    rows: [
      { end: "lower", pools: 2.074198237808219, accessible: "2.074198", label: "2.07 pool volumes / day", icons: 3, lastFill: 7.4198237808219 },
      { end: "upper", pools: 2.489037885369863, accessible: "2.489038", label: "2.49 pool volumes / day", icons: 3, lastFill: 48.9037885369863 },
    ],
  },
} as const;

function expectElectricity() {
  const comparison = screen.getByTestId("comparison-electricity");
  const baseline = within(comparison).getByRole("img", { name: "100 countable normalized baseline units" });
  const addition = within(comparison).getByRole("img", { name: "30 countable additional normalized units" });

  expect(baseline.children).toHaveLength(100);
  expect(addition.children).toHaveLength(30);
  expect(baseline.children.length + addition.children.length).toBe(130);
  for (const grid of [baseline, addition]) {
    for (const square of grid.children) expect(square).toHaveAttribute("aria-hidden", "true");
  }
  expect(comparison).toHaveTextContent("+30on a baseline of 100");
  expect(comparison).toHaveTextContent("1 square = 1% of the normalized baseline · 130 units in total");
  expect(comparison).toHaveTextContent("A relative comparison, not a household count.");
  expect(comparison).toHaveTextContent("No absolute electricity conversion is made.");
  expect(screen.queryByTestId("comparison-water")).not.toBeInTheDocument();
}

function expectWater(period: Period) {
  const expected = waterCases[period];
  const comparison = screen.getByRole("region", { name: "Water volume comparison" });

  expect(screen.queryByTestId("comparison-electricity")).not.toBeInTheDocument();
  expect(screen.getByTestId("text-pool-range").textContent).toBe(expected.range);
  expect(comparison).toHaveTextContent(expected.legend);
  expect(comparison).toHaveTextContent("last icon filled proportionally");
  expect(comparison).toHaveTextContent("One reference pool = 50 × 25 × 2 m = 2.5 million litres.");
  expect(screen.getByRole("button", { name: "Annual" })).toHaveAttribute("aria-pressed", String(period === "annual"));
  expect(screen.getByRole("button", { name: "Daily" })).toHaveAttribute("aria-pressed", String(period === "daily"));

  for (const row of expected.rows) {
    const element = within(comparison).getByTestId(`comparison-${row.end}`);
    expect(element).toHaveTextContent(`${row.end === "lower" ? "Lower" : "Upper"} estimate`);
    expect(element).toHaveTextContent(row.label);
    const graphic = within(element).getByRole("img", {
      name: `${row.accessible} reference pool volumes; each full icon equals ${expected.unit} pool volumes, last icon fractionally filled.`,
    });
    const icons = Array.from(graphic.children);
    expect(icons).toHaveLength(row.icons);
    const widths = icons.map((icon) => {
      expect(icon).toHaveAttribute("aria-hidden", "true");
      const fill = icon.firstElementChild as HTMLElement;
      expect(fill.style.width).toMatch(/%$/);
      return Number.parseFloat(fill.style.width);
    });
    // A rounded caption must never drive the geometry: check every full icon,
    // the fractional final icon, and the total volume reconstructed from fills.
    for (const width of widths.slice(0, -1)) expect(width).toBe(100);
    // CSSOM serializes percentages to six significant figures. Allow only that
    // serialization loss; precise arithmetic is checked separately below.
    expect(widths.at(-1)).toBeCloseTo(row.lastFill, 4);
    expect(widths.reduce((sum, width) => sum + width / 100 * expected.unit, 0)).toBeCloseTo(row.pools, 4);
  }
}

async function chooseWater(user: User, period: Period) {
  await user.click(screen.getByRole("button", { name: "Water" }));
  if (period === "daily") await user.click(screen.getByRole("button", { name: "Daily" }));
}

async function openPassage(user: User, resource: Resource) {
  await user.click(screen.getByTestId(`button-passage-${resource}`));
  await waitFor(() => expect(screen.getByRole("complementary", { name: `${resource} scale explanation` })).toHaveFocus());
}

describe("source-grounded resource quantities", () => {
  it("renders exactly 100 baseline squares plus 30 additional squares, never households or absolute power", () => {
    render(<ResourceScale />);
    expectElectricity();
    expect(screen.getByRole("img", { name: /Houses do not encode households powered/ })).toBeInTheDocument();
    expect(screen.getByTestId("comparison-electricity")).toHaveTextContent("baseline year, MW or MWh basis, or precise denominator");
  });

  it.each(["annual", "daily"] as const)("keeps exact %s conversions, labels, grouped icon counts, and fractional fills in agreement", async (period) => {
    const user = userEvent.setup();
    render(<ResourceScale />);
    await chooseWater(user, period);
    expectWater(period);
    const comparison = screen.getByTestId("comparison-water");
    if (period === "annual") {
      expect(comparison).toHaveTextContent("The headline is an enclosing rounded range.");
    } else {
      expect(comparison).toHaveTextContent("Daily values are annual totals ÷ 365, not a uniform daily pattern; cooling is seasonal.");
    }
  });

  it("publishes the exact conversion factors and independently reproducible eight-decimal results", async () => {
    const user = userEvent.setup();
    render(<ResourceScale />);
    await chooseWater(user, "annual");
    await user.click(screen.getByTestId("button-inspect-sources"));
    const details = screen.getByTestId("details-sources");
    expect(details).toHaveAttribute("open");
    const arithmetic = details.querySelector("code");
    expect(arithmetic).toHaveTextContent("1 US gal = 3.785411784 L");
    expect(arithmetic).toHaveTextContent("Reference pool = 50 × 25 × 2 × 1,000 = 2,500,000 L");
    expect(arithmetic).toHaveTextContent("Annual pools = annual US gal × 3.785411784 ÷ 2,500,000");
    expect(arithmetic).toHaveTextContent("757.08235680–908.49882816 pools/year");
    expect(arithmetic).toHaveTextContent("Daily pools = annual pools ÷ 365");
    expect(arithmetic).toHaveTextContent("2.07419824–2.48903789 pools/day");
    expect(details).toHaveTextContent("with no rounding before geometry.");
  });

  it.each(["annual", "daily"] as const)("keeps the pumping-capacity ceiling separate from %s expected use", async (period) => {
    const user = userEvent.setup();
    render(<ResourceScale />);
    await chooseWater(user, period);
    const comparison = screen.getByTestId("comparison-water");
    const ceiling = within(comparison).getByText("Separate capacity ceiling: >23 million US gallons/day.");
    expect(ceiling.parentElement).toHaveTextContent("Registered maximum pumping, not expected use or an uncertainty bound.");
    expect(ceiling.parentElement).toHaveTextContent(period === "annual"
      ? "Expected site use: 500–600 million US gallons/year."
      : "Derived average: 1.37–1.64 million US gallons/day; article rounded to ≈1.5 million.");
    for (const end of ["lower", "upper"]) {
      expect(within(comparison).getByTestId(`comparison-${end}`)).not.toHaveTextContent(/23 million|capacity|pumping/i);
    }
    // Also enforce the original estimates, so accidentally feeding the pumping
    // limit (or the article's rounded 1.5 million/day) into geometry fails here.
    expectWater(period);
  });
});

describe("keyboard controls keep selection, quantities, and units synchronized", () => {
  it.each(["{Enter}", " "] as const)("switches both resources with %s and preserves keyboard focus", async (key) => {
    const user = userEvent.setup();
    render(<ResourceScale />);
    const electricity = screen.getByRole("button", { name: "Electricity" });
    const water = screen.getByRole("button", { name: "Water" });
    electricity.focus();
    await user.tab();
    expect(water).toHaveFocus();
    await user.keyboard(key);
    expect(water).toHaveFocus();
    expect(water).toHaveAttribute("aria-pressed", "true");
    expect(electricity).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("complementary", { name: "water scale explanation" })).toBeInTheDocument();
    expectWater("annual");

    await user.tab({ shift: true });
    expect(electricity).toHaveFocus();
    await user.keyboard(key);
    expect(electricity).toHaveFocus();
    expect(electricity).toHaveAttribute("aria-pressed", "true");
    expect(water).toHaveAttribute("aria-pressed", "false");
    expectElectricity();
    expect(screen.queryByRole("group", { name: "Water time basis" })).not.toBeInTheDocument();
  });

  it.each(["{Enter}", " "] as const)("switches annual/daily units with %s and restores exact annual geometry", async (key) => {
    const user = userEvent.setup();
    render(<ResourceScale />);
    await chooseWater(user, "annual");
    const water = screen.getByRole("button", { name: "Water" });
    const annual = screen.getByRole("button", { name: "Annual" });
    const daily = screen.getByRole("button", { name: "Daily" });
    expect(water).toHaveFocus();
    await user.tab();
    expect(annual).toHaveFocus();
    await user.tab();
    expect(daily).toHaveFocus();
    await user.keyboard(key);
    expect(daily).toHaveFocus();
    expectWater("daily");
    await user.tab({ shift: true });
    expect(annual).toHaveFocus();
    await user.keyboard(key);
    expect(annual).toHaveFocus();
    expectWater("annual");
  });

  it("retains the chosen water period across an electricity round trip without stale unit labels", async () => {
    const user = userEvent.setup();
    render(<ResourceScale />);
    await chooseWater(user, "daily");
    await user.click(screen.getByRole("button", { name: "Electricity" }));
    expectElectricity();
    await user.tab();
    await user.keyboard("{Enter}");
    expectWater("daily");
  });

  it.each([
    { command: "water", resource: "water", period: "annual" },
    { command: "electricity", resource: "electricity", period: null },
    { command: "annual", resource: "water", period: "annual" },
    { command: "daily", resource: "water", period: "daily" },
  ] as const)("submits the $command command with Enter and focuses the correctly labeled explanation", async ({ command, resource, period }) => {
    const user = userEvent.setup();
    render(<ResourceScale />);
    // Start on the opposite resource/time basis to catch commands that don't
    // actually switch state (including annual accidentally remaining daily).
    if (command === "electricity" || command === "annual") await chooseWater(user, "daily");
    const input = screen.getByRole("textbox", { name: "Reading command" });
    await user.type(input, `${command}{Enter}`);
    await waitFor(() => expect(screen.getByRole("complementary", { name: `${resource} scale explanation` })).toHaveFocus());
    expect(input).toHaveValue("");
    if (period) expectWater(period);
    else expectElectricity();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("panel-explanation")).not.toBeInTheDocument();
    expect(screen.getByTestId(`button-passage-${resource}`)).toHaveFocus();
  });
});

describe("closing and reopening the explanation returns focus to the right passage", () => {
  for (const resource of ["electricity", "water"] as const) {
    it.each(["escape", "close-enter", "close-space"] as const)(`returns focus to ${resource} after %s, including after switching resources`, async (method) => {
      const user = userEvent.setup();
      render(<ResourceScale />);
      await openPassage(user, resource === "water" ? "electricity" : "water");
      const switcher = screen.getByRole("button", { name: resource === "water" ? "Water" : "Electricity" });
      switcher.focus();
      await user.keyboard("{Enter}");
      if (method === "escape") {
        // Escape must bubble from a child control, not just the aside itself.
        await user.keyboard("{Escape}");
      } else {
        screen.getByRole("button", { name: "Close explanation and return to passage" }).focus();
        await user.keyboard(method === "close-enter" ? "{Enter}" : " ");
      }
      expect(screen.queryByTestId("panel-explanation")).not.toBeInTheDocument();
      const passage = screen.getByTestId(`button-passage-${resource}`);
      expect(passage).toHaveFocus();
      expect(passage).toHaveAttribute("aria-expanded", "false");
      await user.keyboard("{Enter}");
      await waitFor(() => expect(screen.getByRole("complementary", { name: `${resource} scale explanation` })).toHaveFocus());
      expect(passage).toHaveAttribute("aria-expanded", "true");
      if (resource === "water") expectWater("annual");
      else expectElectricity();
    });
  }
});
