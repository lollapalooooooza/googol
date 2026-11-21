# Resource scale: two documented cases and their boundaries

Research checked November 14, 2026. This is a dated reading prototype, not a current operating dashboard.

## Selection and comparability rule

The selector keeps each case's phase, source date, electricity baseline and water boundary visible **before** its scale illustration. Switching cases unmounts the previous reading: no Louisiana range, scene, normalized electricity grid, or capacity ceiling is reused as Google data. Water's reference pool is a common **volume unit**, not a shared environmental-impact measure.

- Louisiana: a reported **2028 projection**, with an unspecified withdrawal/net-consumption boundary.
- The Dalles: **2023 operational accounts**, reported by location, with separate withdrawal, discharge and net-consumption totals.
- These are **not like-for-like project footprints**. No ranking, ratio, combined total or cross-project subtraction is offered.
- No compatible absolute electricity baseline is established for either reading. Retain Louisiana's relative-only illustration, and explicitly show unavailable site electricity data for Google. Missing is not zero.
- This remains a manually researched, sandbox-only prototype; no collection service or scraping engine was added.

## Reported case

- Josie Abugov, NOLA.com, **December 21, 2025**, “Meta details water needs for Louisiana AI data center.”
- [Original article](https://www.nola.com/news/environment/meta-louisiana-data-center-water-ai/article_d27dea17-d571-453c-b5a5-0deb571ea272.html); [AMP version with visible publication date](https://www.nola.com/news/environment/meta-louisiana-data-center-water-ai/article_d27dea17-d571-453c-b5a5-0deb571ea272.amp.html).
- Company projection reported for operation in 2028: 500–600 million US gallons per year; approximately 1.5 million gallons per day on average.
- Registered maximum pumping capacity exceeds 23 million gallons per day. This is a separate operational ceiling, not typical use, an annual forecast, or a statistical upper bound.
- Around 30% increase in Entergy's Louisiana electricity needs. The article does not specify its baseline year or whether “needs” denotes peak power or annual energy. Normalize only: 100 baseline units plus 30 added units.

## Primary-source scope checks

- [Entergy, December 6, 2024](https://www.entergy.com/news/entergy-louisiana-power-meta-s-data-center-in-richland-parish): three combined-cycle turbines, combined capacity 2,260 MW, supporting the campus **and** wider economic development/customer growth. Generation capacity cannot be substituted for facility load.
- [Meta, December 4, 2024](https://datacenters.atmeta.com/2024/12/hello-louisiana): initial four-million-square-foot campus, with at least 1,500 MW of new renewable resources. Again, not an absolute load measurement.
- Later expansion announcements must not be folded into the December 2025 water projection.
- No compatible absolute facility load, time basis, utilization assumption, and household-energy baseline were established. A household-equivalent claim is deliberately omitted.

## Reproducible conversions

- 1 US gallon = 3.785411784 litres.
- Reference pool: 50 × 25 × 2 metres = 2,500 cubic metres = 2,500,000 litres.
- Annual lower bound: 500,000,000 × 3.785411784 ÷ 2,500,000 = **757.0823568 pool volumes**.
- Annual upper bound: 600,000,000 × 3.785411784 ÷ 2,500,000 = **908.49882816 pool volumes**.
- Rounded outward to whole pool volumes: approximately **757–909 annually**.
- Average day uses annual totals divided by **365**, not the article's separately rounded 1.5 million/day figure: **2.0741982378–2.4890378854 pool volumes**, or **1.369863–1.643836 million US gallons**.
- Pool fractions encode volume linearly, not perspective or apparent surface area.

## Interpretation

These are reported projections, not observed consumption. Water use is seasonal; dividing by 365 gives an annualized average, not a forecast for any particular day. “Use,” “consumption,” and pumping language in the article do not establish a net-consumption/withdrawal accounting boundary. Compare reported direct site water only; indirect electricity-generation water is excluded. The pool analogy neither describes pools actually filled nor determines local environmental harm.

## Second case: Google, The Dalles, Oregon

### Dated primary disclosures

- [Google, “Our 2024 Environmental Report,” July 2, 2024](https://blog.google/outreach-initiatives/sustainability/2024-environmental-report/) establishes the publication date and links directly to the report.
- [Google 2024 Environmental Report, original PDF](https://www.gstatic.com/gumdrop/sustainability/google-2024-environmental-report.pdf), reporting period **January 1–December 31, 2023** (About this report).
- **Printed page 79 / PDF page 80**, “Water use by data center location,” **The Dalles, OR** row:
  - Withdrawal: **383.7 million gallons**; all listed as **potable water**.
  - Discharge: **81.3 million gallons**.
  - Consumption: **302.4 million gallons**.
- These were checked in the actual PDF with layout-preserving text extraction, not taken only from search-result snippets.

### Phase and physical scope

This is a historical **location aggregate**, not a single building, planned nameplate capacity, an AI-only allocation, or a forecast for a completed expansion. Printed page 45 describes existing data centers and work on a new campus; printed page 53 describes construction beginning on a third campus in 2023. The report does not allocate the water row to each campus. Do not imply the row describes the eventual full build-out or a future operating year.

### Electricity boundary: comparison withheld

The report's energy totals are fleet-wide. Printed page 77's campus PUE table lists The Dalles facilities, but PUE is a total-facility-energy / IT-energy ratio. It supplies neither the absolute IT energy nor location annual MWh or peak MW. No location-specific electricity baseline has been established from these selected disclosures. A fleet total, PUE, generation capacity or renewable procurement announcement cannot replace that missing value.

Accordingly the Google electricity panel explicitly states **unavailable**, rather than importing Louisiana's ≈30%, inventing a household equivalent, estimating annual energy from MW, or presenting zero electricity use.

### Water accounting

**Printed page 73 / PDF page 74**, “Water metrics”:

- Consumption is **withdrawal minus discharge**. 383.7 − 81.3 = 302.4 million gallons.
- Operational accounting covers assets under operational control; seawater is excluded.
- Withdrawal is based on actual metered/invoiced data where available.
- Where actual discharge is unavailable, domestic/non-IT-cooling potable discharge may be estimated with a 90% discharge factor and irrigation with a 0% discharge factor. Do not call all consumption directly metered.
- Reported water metrics are rounded to the nearest hundred thousand gallons (0.1 million).
- These are direct operational water accounts, not indirect water associated with electricity generation.
- Replenishment is a separate metric, not a credit subtracted from either withdrawal or consumption.

The selected measure (withdrawal **or** net consumption) is converted alone. The two values are not bounds of an uncertainty range and must never be added. Discharge remains separately identified in the accounting equation.

### Reproducible water conversion

Use the same US-gallon and 2,500,000-litre pool definitions as Louisiana:

| Measure | Reported annual US gallons | Pool volumes / year | Pool volumes / average day |
| --- | ---: | ---: | ---: |
| Withdrawal | 383,700,000 | 580.98500060832 | 1.5917397277 |
| Net consumption | 302,400,000 | 457.88340939264 | 1.2544750942 |

Geometry uses unrounded calculations: annual gallons × 3.785411784 ÷ 2,500,000; daily = annual ÷ **365** (2023 is not a leap year). Annual icons encode 25 pool volumes; daily icons encode one. The final icon is fractionally filled. Display precision does not imply additional source precision.

### Why no project ranking?

Louisiana's expected 2028 site “use” does not establish net consumption versus withdrawal. Neither of Google's defined accounting measures can be silently treated as equivalent. Different years, operating phases, workload mixes and local watersheds also prevent interpreting volume ratios as an environmental-impact ranking. The selector enables independent reading, not an unsupported winner/loser comparison.
